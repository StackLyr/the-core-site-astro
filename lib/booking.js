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

export async function adminCookie(request, secret) {
  const expires = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const nonce = crypto.randomUUID();
  const payload = `${expires}.${nonce}`;
  const signature = await hmac(secret, payload);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `core_admin=${payload}.${signature}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`;
}

export async function isAdmin(request, env) {
  if (!env.ADMIN_SESSION_SECRET || !env.ADMIN_PASSWORD) return false;
  const token = /(?:^|;\s*)core_admin=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0])) return false;
  if (Number(parts[0]) < Math.floor(Date.now() / 1000)) return false;
  const expected = await hmac(env.ADMIN_SESSION_SECRET, `${parts[0]}.${parts[1]}`);
  return sameValue(expected, parts[2]);
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
