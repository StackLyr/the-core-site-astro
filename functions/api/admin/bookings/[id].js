import { bodyJson, isAdmin, json, sameOrigin } from '../../../../lib/booking.js';

export async function onRequestPatch({ request, env, params }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  try {
    const body = await bodyJson(request);
    const next = body.status;
    if (!['confirmed', 'cancelled', 'no_show'].includes(next)) return json({ error: 'Estado no permitido.' }, 400);
    const booking = await env.DB.prepare('SELECT status FROM bookings WHERE id = ?').bind(params.id).first();
    if (!booking) return json({ error: 'Reserva no encontrada.' }, 404);
    if (booking.status === 'cancelled' || booking.status === 'payment_failed' || booking.status === 'review') return json({ error: 'Esta reserva necesita revisión manual.' }, 409);
    if (next === 'confirmed' && booking.status !== 'requested') return json({ error: 'No se puede confirmar manualmente un pago pendiente.' }, 409);
    if (next === 'no_show' && booking.status !== 'confirmed') return json({ error: 'Solo una reserva confirmada puede marcarse como ausencia.' }, 409);
    await env.DB.prepare('UPDATE bookings SET status = ?, cancelled_at = CASE WHEN ? = ? THEN ? ELSE cancelled_at END WHERE id = ?').bind(next, next, 'cancelled', new Date().toISOString(), params.id).run();
    await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), params.id, next, 'admin').run();
    return json({ ok: true });
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }
}
