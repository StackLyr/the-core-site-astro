import { json } from '../../../lib/booking.js';

export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const booking = await env.DB.prepare('SELECT status FROM bookings WHERE id = ?').bind(params.id).first();
  return booking ? json(booking) : json({ error: 'Reserva no encontrada.' }, 404);
}
