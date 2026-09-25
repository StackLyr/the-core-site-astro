import { bodyJson, cleanText, isAdmin, json, sameOrigin } from '../../lib/booking.js';
import { demoPaymentsEnabled } from '../../lib/payment.js';

export async function onRequestGet({ env }) {
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const result = await env.DB.prepare('SELECT id, name, description, class_credits, validity_days, price_cents FROM membership_plans WHERE active = 1 ORDER BY price_cents ASC').all();
  return json({ plans: result.results });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  if (!demoPaymentsEnabled(env)) return json({ error: 'Activa el modo de pago demo antes de publicar una membresía.' }, 409);
  try {
    const body = await bodyJson(request);
    const name = cleanText(body.name, 80);
    const description = cleanText(body.description, 250);
    const credits = Number(body.classCredits);
    const days = Number(body.validityDays);
    const price = Number(body.priceCents);
    if (!name || !Number.isInteger(credits) || credits < 1 || credits > 100 || !Number.isInteger(days) || days < 1 || days > 365 || !Number.isInteger(price) || price < 1 || price > 1000000) return json({ error: 'Revisa nombre, clases, vigencia y precio.' }, 400);
    const id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO membership_plans (id, name, description, class_credits, validity_days, price_cents) VALUES (?, ?, ?, ?, ?, ?)').bind(id, name, description, credits, days, price).run();
    return json({ id }, 201);
  } catch { return json({ error: 'No se pudo crear la membresía.' }, 400); }
}
