import { adminCookie, bodyJson, json, sameOrigin, sameValue, sha256Hex } from '../../../lib/booking.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) return json({ error: 'Configura las credenciales de administración.' }, 503);
  try {
    const body = await bodyJson(request);
    const supplied = typeof body.password === 'string' ? body.password : '';
    const expectedHash = await sha256Hex(env.ADMIN_PASSWORD);
    const suppliedHash = await sha256Hex(supplied);
    if (!sameValue(expectedHash, suppliedHash)) return json({ error: 'Contraseña incorrecta.' }, 401);
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': await adminCookie(request, env.ADMIN_SESSION_SECRET), 'Cache-Control': 'no-store' } });
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }
}
