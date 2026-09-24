import { bodyJson, json, sameValue, sha256Hex } from '../../../lib/booking.js';

function propertyValue(data, path) {
  return path.split('.').reduce((value, key) => value?.[key], data);
}

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.WOMPI_EVENTS_SECRET || !['test', 'prod'].includes(env.WOMPI_ENV)) return json({ error: 'Webhook no configurado.' }, 503);
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
    const booking = await env.DB.prepare('SELECT id, status, amount_cents, wompi_transaction_id FROM bookings WHERE payment_reference = ?').bind(transaction.reference).first();
    if (!booking || booking.amount_cents !== transaction.amount_in_cents) return json({ error: 'Referencia o importe no coincide.' }, 409);
    if (booking.wompi_transaction_id && booking.wompi_transaction_id !== transaction.id) return json({ error: 'Transacción duplicada.' }, 409);
    if (booking.status === 'confirmed' && booking.wompi_transaction_id === transaction.id) return json({ ok: true });
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
