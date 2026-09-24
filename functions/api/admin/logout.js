import { json, sameOrigin } from '../../../lib/booking.js';

export async function onRequestPost({ request }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': 'core_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0', 'Cache-Control': 'no-store' } });
}
