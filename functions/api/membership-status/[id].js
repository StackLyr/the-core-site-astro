import { json } from '../../../lib/booking.js';

export async function onRequestGet({ env, params }) {
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const item = await env.DB.prepare('SELECT status FROM memberships WHERE id = ?').bind(params.id).first();
  return item ? json(item) : json({ error: 'Membresía no encontrada.' }, 404);
}
