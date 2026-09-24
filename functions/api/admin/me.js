import { isAdmin, json } from '../../../lib/booking.js';

export async function onRequestGet({ request, env }) {
  return json({ authenticated: await isAdmin(request, env) });
}
