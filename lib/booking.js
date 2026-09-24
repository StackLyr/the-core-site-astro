const encoder = new TextEncoder();

export function json(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function bodyJson(request) {
  const raw = await request.text();
  if (raw.length > 10000) throw new Error('Solicitud demasiado grande.');
  return JSON.parse(raw);
}

export async function sha256Hex(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function sameValue(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function adminCookie(request, env) {
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const tokenHash = await hmac(env.ADMIN_SESSION_SECRET, token);
  await env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at < ? OR revoked_at IS NOT NULL').bind(new Date().toISOString()).run();
  await env.DB.prepare('INSERT INTO admin_sessions (id, token_hash, expires_at) VALUES (?, ?, ?)')
    .bind(crypto.randomUUID(), tokenHash, expiresAt).run();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `core_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200${secure}`;
}

export async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET || !env.ADMIN_PASSWORD || !env.DB) return false;
  const token = /(?:^|;\s*)core_admin=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!token || !/^[0-9a-f-]{72}$/.test(token)) return false;
  const tokenHash = await hmac(env.ADMIN_SESSION_SECRET, token);
  const session = await env.DB.prepare('SELECT id FROM admin_sessions WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?')
    .bind(tokenHash, new Date().toISOString()).first();
  return Boolean(session);
}

export async function revokeAdminSession(request, env) {
  const token = /(?:^|;\s*)core_admin=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!env.DB || !env.ADMIN_SESSION_SECRET || !token || !/^[0-9a-f-]{72}$/.test(token)) return;
  const tokenHash = await hmac(env.ADMIN_SESSION_SECRET, token);
  await env.DB.prepare('UPDATE admin_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .bind(new Date().toISOString(), tokenHash).run();
}

export async function adminIpHash(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local-development';
  return hmac(env.ADMIN_SESSION_SECRET, ip);
}

export function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  return origin === new URL(request.url).origin;
}

export function cleanText(value, max = 120) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
}

export function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export function publicSessionSql() {
  return `SELECT s.id, s.class_name, s.starts_at, s.duration_minutes, s.capacity, s.price_cents,
    s.capacity - (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND
      (b.status IN ('requested', 'confirmed') OR (b.status = 'pending_payment' AND b.hold_expires_at > ?))) AS spots_left
    FROM sessions s WHERE s.state = 'open' AND s.starts_at > ? AND s.starts_at < ? ORDER BY s.starts_at ASC`;
}
