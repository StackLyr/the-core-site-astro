import { bodyJson, cleanText, isAdmin, json, publicSessionSql, sameOrigin } from '../../lib/booking.js';
import { wompiConfigured } from '../../lib/payment.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const now = new Date();
  const until = new Date(now.getTime() + 56 * 86400000);
  const result = await env.DB.prepare(publicSessionSql()).bind(now.toISOString(), now.toISOString(), until.toISOString()).all();
  return json({ sessions: result.results });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  try {
    const body = await bodyJson(request);
    const name = cleanText(body.className, 80);
    const date = new Date(body.startsAt);
    const capacity = Number(body.capacity);
    const duration = Number(body.durationMinutes);
    const price = body.priceCents === null || body.priceCents === '' ? null : Number(body.priceCents);
    const repeatWeeks = Number(body.repeatWeeks || 1);
    if (!name || !Number.isFinite(date.getTime()) || date.getTime() < Date.now() + 600000 || date.getTime() > Date.now() + 120 * 86400000 || !Number.isInteger(capacity) || capacity < 1 || capacity > 40 || !Number.isInteger(duration) || duration < 20 || duration > 180 || !Number.isInteger(repeatWeeks) || repeatWeeks < 1 || repeatWeeks > 8 || (price !== null && (!Number.isInteger(price) || price < 0 || price > 1000000))) {
      return json({ error: 'Revisa clase, fecha, cupos, duración y precio.' }, 400);
    }
    if (price > 0 && !wompiConfigured(env)) {
      return json({ error: 'Configura Wompi antes de publicar clases con precio.' }, 409);
    }
    const ids = Array.from({ length: repeatWeeks }, () => crypto.randomUUID());
    const statements = ids.map((id, index) => env.DB.prepare('INSERT INTO sessions (id, class_name, starts_at, duration_minutes, capacity, price_cents) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, new Date(date.getTime() + index * 7 * 86400000).toISOString(), duration, capacity, price));
    await env.DB.batch(statements);
    return json({ ids }, 201);
  } catch {
    return json({ error: 'No se pudo crear la clase.' }, 400);
  }
}
