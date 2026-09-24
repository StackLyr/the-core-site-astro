import { adminCookie, adminIpHash, bodyJson, json, sameOrigin, sameValue, sha256Hex } from '../../../lib/booking.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!env.DB || !env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET || env.ADMIN_SESSION_SECRET.length < 32) return json({ error: 'Configura el acceso privado.' }, 503);
  try {
    const ipHash = await adminIpHash(request, env);
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM admin_login_failures WHERE ip_hash = ? AND failed_at > ?').bind(ipHash, cutoff).first();
    if (count.total >= 5) return Response.json({ error: 'Demasiados intentos. Intenta más tarde.' }, { status: 429, headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' } });
    const body = await bodyJson(request);
    const supplied = typeof body.password === 'string' ? body.password : '';
    const expectedHash = await sha256Hex(env.ADMIN_PASSWORD);
    const suppliedHash = await sha256Hex(supplied);
    if (!sameValue(expectedHash, suppliedHash)) {
      await env.DB.prepare('INSERT INTO admin_login_failures (id, ip_hash, failed_at) VALUES (?, ?, ?)').bind(crypto.randomUUID(), ipHash, new Date().toISOString()).run();
      return json({ error: 'Credenciales inválidas.' }, 401);
    }
    await env.DB.prepare('DELETE FROM admin_login_failures WHERE ip_hash = ?').bind(ipHash).run();
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': await adminCookie(request, env), 'Cache-Control': 'no-store' } });
  } catch {
    return json({ error: 'Solicitud inválida.' }, 400);
  }
}
