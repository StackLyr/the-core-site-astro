import { allowPublicRequest, bodyJson, cleanText, json, sameOrigin } from '../../lib/booking.js';
import { classDate, queueEmail, sendQueuedEmail } from '../../lib/email.js';
import { demoPaymentsEnabled } from '../../lib/payment.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^demo-(class|plan)-[0-9a-f-]{36}$/i;

async function notify(waitUntil, promise) {
  try { waitUntil(promise); } catch { await promise; }
}

async function settleBooking({ env, id, token, outcome, waitUntil }) {
  const booking = await env.DB.prepare(`SELECT b.id, b.status, b.hold_expires_at, b.payment_reference,
      s.class_name, s.starts_at, s.capacity, c.name, c.email
      FROM bookings b JOIN sessions s ON s.id = b.session_id JOIN clients c ON c.id = b.client_id
      WHERE b.id = ?`).bind(id).first();
  if (!booking || booking.payment_reference !== token) return json({ error: 'Pago demo no encontrado.' }, 404);
  if (booking.status === 'confirmed') return json({ ok: true, status: 'confirmed' });
  if (booking.status !== 'pending_payment') return json({ error: 'Este pago demo ya no está pendiente.' }, 409);
  if (!booking.hold_expires_at || booking.hold_expires_at <= new Date().toISOString()) return json({ error: 'La reserva demo expiró. Vuelve a elegir la clase.' }, 409);
  if (outcome === 'declined') {
    await env.DB.prepare("UPDATE bookings SET status = 'payment_failed' WHERE id = ? AND status = 'pending_payment'").bind(id).run();
    await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, 'payment_demo_declined', 'Simulación DEMO — sin cobro').run();
    return json({ ok: true, status: 'payment_failed' });
  }
  const now = new Date().toISOString();
  const result = await env.DB.prepare(`UPDATE bookings SET status = 'confirmed'
      WHERE id = ? AND status = 'pending_payment' AND hold_expires_at > ? AND
      (SELECT COUNT(*) FROM bookings other WHERE other.session_id = bookings.session_id AND other.id <> bookings.id
        AND (other.status IN ('requested', 'confirmed') OR (other.status = 'pending_payment' AND other.hold_expires_at > ?))) < ?`)
    .bind(id, now, now, booking.capacity).run();
  if (result.meta.changes !== 1) return json({ error: 'La clase ya no tiene cupo. El estudio revisará la solicitud.' }, 409);
  await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), id, 'payment_demo_approved', 'Simulación DEMO — sin cobro').run();
  const key = `booking-demo-confirmed/${id}`;
  await queueEmail(env, { key, to: booking.email, subject: 'Reserva demo confirmada — The Core Site', text: `Hola ${booking.name},\n\nTu reserva demo para ${booking.class_name} del ${classDate(booking.starts_at)} quedó confirmada. Esta simulación no realizó ningún cobro.\n\nThe Core Site` });
  await notify(waitUntil, sendQueuedEmail(env, key));
  return json({ ok: true, status: 'confirmed' });
}

async function settleMembership({ env, id, token, outcome, waitUntil }) {
  const membership = await env.DB.prepare(`SELECT m.id, m.status, m.payment_reference, m.class_credits,
      p.name AS plan_name, p.validity_days, c.name, c.email
      FROM memberships m JOIN membership_plans p ON p.id = m.plan_id JOIN clients c ON c.id = m.client_id
      WHERE m.id = ?`).bind(id).first();
  if (!membership || membership.payment_reference !== token) return json({ error: 'Pago demo no encontrado.' }, 404);
  if (membership.status === 'active') return json({ ok: true, status: 'active' });
  if (membership.status !== 'pending_payment') return json({ error: 'Este pago demo ya no está pendiente.' }, 409);
  if (outcome === 'declined') {
    await env.DB.prepare("UPDATE memberships SET status = 'payment_failed' WHERE id = ? AND status = 'pending_payment'").bind(id).run();
    return json({ ok: true, status: 'payment_failed' });
  }
  const purchasedAt = new Date();
  const expiresAt = new Date(purchasedAt.getTime() + membership.validity_days * 86400000);
  await env.DB.prepare("UPDATE memberships SET status = 'active', credits_remaining = class_credits, purchased_at = ?, expires_at = ? WHERE id = ? AND status = 'pending_payment'")
    .bind(purchasedAt.toISOString(), expiresAt.toISOString(), id).run();
  const key = `membership-demo-active/${id}`;
  await queueEmail(env, { key, to: membership.email, subject: 'Membresía demo activa — The Core Site', text: `Hola ${membership.name},\n\nLa membresía demo ${membership.plan_name} quedó activa con ${membership.class_credits} clases. Esta simulación no realizó ningún cobro.\n\nThe Core Site` });
  await notify(waitUntil, sendQueuedEmail(env, key));
  return json({ ok: true, status: 'active' });
}

export async function onRequestPost({ request, env, waitUntil = () => {} }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!demoPaymentsEnabled(env)) return json({ error: 'El simulador de pagos está deshabilitado.' }, 503);
  if (!env.DB || !env.ADMIN_SESSION_SECRET) return json({ error: 'Demo no configurada.' }, 503);
  if (!(await allowPublicRequest(request, env, 'demo-payment', 20, 60 * 60 * 1000))) return Response.json({ error: 'Demasiados intentos. Espera antes de continuar.' }, { status: 429, headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' } });
  try {
    const body = await bodyJson(request);
    const kind = cleanText(body.kind, 20);
    const id = cleanText(body.id, 40);
    const token = cleanText(body.token, 80);
    const outcome = cleanText(body.outcome, 20);
    if (!['booking', 'membership'].includes(kind) || !UUID_PATTERN.test(id) || !TOKEN_PATTERN.test(token) || !['approved', 'declined'].includes(outcome)) return json({ error: 'Solicitud demo inválida.' }, 400);
    return kind === 'booking'
      ? settleBooking({ env, id, token, outcome, waitUntil })
      : settleMembership({ env, id, token, outcome, waitUntil });
  } catch {
    return json({ error: 'No se pudo completar la simulación.' }, 400);
  }
}
