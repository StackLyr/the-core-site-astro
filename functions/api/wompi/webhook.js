import { bodyJson, json, sameValue, sha256Hex } from '../../../lib/booking.js';
import { classDate, queueEmail, sendQueuedEmail } from '../../../lib/email.js';

function propertyValue(data, path) {
  return path.split('.').reduce((value, key) => value?.[key], data);
}

async function notifyBooking(env, bookingId, waitUntil) {
  try {
    const row = await env.DB.prepare('SELECT c.name, c.email, s.class_name, s.starts_at FROM bookings b JOIN clients c ON c.id = b.client_id JOIN sessions s ON s.id = b.session_id WHERE b.id = ?').bind(bookingId).first();
    if (!row) return;
    const key = `booking-confirmed/${bookingId}`;
    await queueEmail(env, { key, to: row.email, subject: 'Tu clase está confirmada — The Core Site', text: `Hola ${row.name},\n\nTu reserva para ${row.class_name} quedó confirmada para el ${classDate(row.starts_at)} (hora de Panamá).\n\nTe esperamos en The Core Site, Plaza JBC, David.\n\nThe Core Site` });
    waitUntil(sendQueuedEmail(env, key));
  } catch { /* El pago no se revierte si falla el correo; queda visible para revisión. */ }
}

async function notifyMembership(env, membershipId, waitUntil) {
  try {
    const row = await env.DB.prepare('SELECT c.name, c.email, p.name AS plan_name, m.class_credits, m.expires_at FROM memberships m JOIN clients c ON c.id = m.client_id JOIN membership_plans p ON p.id = m.plan_id WHERE m.id = ?').bind(membershipId).first();
    if (!row) return;
    const key = `membership-active/${membershipId}`;
    await queueEmail(env, { key, to: row.email, subject: 'Tu membresía está activa — The Core Site', text: `Hola ${row.name},\n\nTu membresía ${row.plan_name} está activa e incluye ${row.class_credits} clases. Vigencia hasta el ${classDate(row.expires_at)}.\n\nPara utilizar tus clases, contacta al estudio y menciona este número de membresía: ${membershipId}.\n\nThe Core Site` });
    waitUntil(sendQueuedEmail(env, key));
  } catch { /* El panel muestra los correos pendientes. */ }
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.DB || !['test', 'prod'].includes(env.WOMPI_ENV) || !env.WOMPI_EVENTS_SECRET?.startsWith(`${env.WOMPI_ENV}_events_`)) return json({ error: 'Webhook no configurado.' }, 503);
  try {
    const event = await bodyJson(request);
    if (event.event !== 'transaction.updated' || event.environment !== env.WOMPI_ENV || !Array.isArray(event.signature?.properties) || event.signature.properties.length < 1 || event.signature.properties.length > 20 || !Number.isInteger(event.timestamp)) return json({ error: 'Evento inválido.' }, 400);
    const values = event.signature.properties.map(path => typeof path === 'string' ? propertyValue(event.data, path) : undefined);
    if (values.some(value => !['string', 'number', 'boolean'].includes(typeof value))) return json({ error: 'Firma inválida.' }, 400);
    const expected = (await sha256Hex(`${values.join('')}${event.timestamp}${env.WOMPI_EVENTS_SECRET}`)).toUpperCase();
    const supplied = String(event.signature.checksum || '').toUpperCase();
    const header = request.headers.get('X-Event-Checksum');
    if (!sameValue(expected, supplied) || (header && !sameValue(expected, header.toUpperCase()))) return json({ error: 'Firma inválida.' }, 401);

    const transaction = event.data?.transaction;
    if (!transaction?.id || !transaction?.reference || transaction.currency !== 'USD' || !Number.isInteger(transaction.amount_in_cents)) return json({ error: 'Transacción inválida.' }, 400);
    if (!/^tcs-(class|plan)-/.test(transaction.reference)) return json({ ok: true, ignored: true });
    const booking = await env.DB.prepare('SELECT id, status, amount_cents, wompi_transaction_id FROM bookings WHERE payment_reference = ?').bind(transaction.reference).first();
    if (!booking) {
      const membership = await env.DB.prepare('SELECT m.id, m.status, m.amount_cents, m.wompi_transaction_id, p.validity_days FROM memberships m JOIN membership_plans p ON p.id = m.plan_id WHERE m.payment_reference = ?').bind(transaction.reference).first();
      if (!membership || membership.amount_cents !== transaction.amount_in_cents) return json({ error: 'Referencia o importe no coincide.' }, 409);
      if (membership.wompi_transaction_id && membership.wompi_transaction_id !== transaction.id) return json({ error: 'Transacción duplicada.' }, 409);
      if (membership.status === 'active' && membership.wompi_transaction_id === transaction.id) { await notifyMembership(env, membership.id, waitUntil); return json({ ok: true }); }
      if (transaction.status === 'APPROVED') {
        const now = new Date();
        const expires = new Date(now.getTime() + membership.validity_days * 86400000).toISOString();
        const result = await env.DB.prepare("UPDATE memberships SET status = 'active', credits_remaining = class_credits, purchased_at = ?, expires_at = ?, wompi_transaction_id = ? WHERE id = ? AND status = 'pending_payment'")
          .bind(now.toISOString(), expires, transaction.id, membership.id).run();
        if (result.meta.changes !== 1) return json({ error: 'Membresía requiere revisión.' }, 409);
        await notifyMembership(env, membership.id, waitUntil);
      } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status) && membership.status === 'pending_payment') {
        await env.DB.prepare("UPDATE memberships SET status = 'payment_failed', wompi_transaction_id = ? WHERE id = ? AND status = 'pending_payment'").bind(transaction.id, membership.id).run();
      }
      return json({ ok: true });
    }
    if (booking.amount_cents !== transaction.amount_in_cents) return json({ error: 'Referencia o importe no coincide.' }, 409);
    if (booking.wompi_transaction_id && booking.wompi_transaction_id !== transaction.id) return json({ error: 'Transacción duplicada.' }, 409);
    if (booking.status === 'confirmed' && booking.wompi_transaction_id === transaction.id) { await notifyBooking(env, booking.id, waitUntil); return json({ ok: true }); }
    if (transaction.status === 'APPROVED') {
      const result = await env.DB.prepare(`UPDATE bookings SET status = 'confirmed', wompi_transaction_id = ?
        WHERE id = ? AND status = 'pending_payment' AND
        (SELECT COUNT(*) FROM bookings other WHERE other.session_id = bookings.session_id AND other.id <> bookings.id
          AND (other.status IN ('requested', 'confirmed') OR (other.status = 'pending_payment' AND other.hold_expires_at > ?)))
        < (SELECT capacity FROM sessions WHERE id = bookings.session_id)`)
        .bind(transaction.id, booking.id, new Date().toISOString()).run();
      if (result.meta.changes !== 1) {
        await env.DB.prepare("UPDATE bookings SET status = 'review', wompi_transaction_id = ? WHERE id = ? AND status <> 'confirmed'").bind(transaction.id, booking.id).run();
        await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), booking.id, 'review', 'Pago aprobado: revisar cupo o cancelación').run();
      } else {
        await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), booking.id, 'confirmed', 'Wompi').run();
        await notifyBooking(env, booking.id, waitUntil);
      }
    } else if (['DECLINED', 'VOIDED', 'ERROR'].includes(transaction.status) && booking.status === 'pending_payment') {
      await env.DB.prepare("UPDATE bookings SET status = 'payment_failed', wompi_transaction_id = ? WHERE id = ? AND status = 'pending_payment'").bind(transaction.id, booking.id).run();
      await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), booking.id, 'payment_failed', 'Wompi').run();
    }
    return json({ ok: true });
  } catch {
    return json({ error: 'No se pudo procesar el evento.' }, 400);
  }
}
