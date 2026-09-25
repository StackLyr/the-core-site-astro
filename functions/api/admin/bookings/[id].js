import { bodyJson, isAdmin, json, sameOrigin } from '../../../../lib/booking.js';
import { classDate, queueEmail, sendQueuedEmail } from '../../../../lib/email.js';

export async function onRequestPatch({ request, env, params, waitUntil }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  try {
    const body = await bodyJson(request);
    const next = body.status;
    if (!['confirmed', 'cancelled', 'no_show'].includes(next)) return json({ error: 'Estado no permitido.' }, 400);
    const booking = await env.DB.prepare('SELECT b.status, c.name, c.email, s.class_name, s.starts_at FROM bookings b JOIN clients c ON c.id = b.client_id JOIN sessions s ON s.id = b.session_id WHERE b.id = ?').bind(params.id).first();
    if (!booking) return json({ error: 'Reserva no encontrada.' }, 404);
    if (booking.status === 'cancelled' || booking.status === 'payment_failed' || booking.status === 'review') return json({ error: 'Esta reserva necesita revisión manual.' }, 409);
    if (next === 'confirmed' && booking.status !== 'requested') return json({ error: 'No se puede confirmar manualmente un pago pendiente.' }, 409);
    if (next === 'no_show' && booking.status !== 'confirmed') return json({ error: 'Solo una reserva confirmada puede marcarse como ausencia.' }, 409);
    await env.DB.prepare('UPDATE bookings SET status = ?, cancelled_at = CASE WHEN ? = ? THEN ? ELSE cancelled_at END WHERE id = ?').bind(next, next, 'cancelled', new Date().toISOString(), params.id).run();
    await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type, detail) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), params.id, next, 'admin').run();
    if (next === 'confirmed' || next === 'cancelled') {
      try {
        const text = next === 'confirmed'
          ? `Hola ${booking.name},\n\nTu clase ${booking.class_name} quedó confirmada para el ${classDate(booking.starts_at)} (hora de Panamá).\n\nTe esperamos en The Core Site.`
          : `Hola ${booking.name},\n\nTu reserva para ${booking.class_name} del ${classDate(booking.starts_at)} fue cancelada por el estudio. Si realizaste un pago, contacta al estudio para revisar el reembolso; este mensaje no significa que se haya procesado.\n\nThe Core Site`;
        const key = `booking-${next}/${params.id}`;
        await queueEmail(env, { key, to: booking.email, subject: next === 'confirmed' ? 'Tu clase está confirmada — The Core Site' : 'Actualización de tu reserva — The Core Site', text });
        waitUntil(sendQueuedEmail(env, key));
      } catch { /* El cambio sigue visible en el panel y el correo se puede revisar. */ }
    }
    return json({ ok: true });
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }
}
