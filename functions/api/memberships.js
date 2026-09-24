import { bodyJson, cleanText, json, sameOrigin, validEmail } from '../../lib/booking.js';
import { wompiCheckout, wompiConfigured } from '../../lib/payment.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!env.DB || !wompiConfigured(env)) return json({ error: 'El pago de membresías aún no está configurado.' }, 503);
  try {
    const body = await bodyJson(request);
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 254).toLowerCase();
    const phone = cleanText(body.phone, 35);
    const planId = cleanText(body.planId, 80);
    if (name.length < 2 || !validEmail(email) || phone.length < 7 || !planId) return json({ error: 'Completa nombre, correo y teléfono válidos.' }, 400);
    const plan = await env.DB.prepare('SELECT * FROM membership_plans WHERE id = ? AND active = 1').bind(planId).first();
    if (!plan) return json({ error: 'Esta membresía ya no está disponible.' }, 404);
    const clientId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO clients (id, name, email, phone) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone').bind(clientId, name, email, phone).run();
    const client = await env.DB.prepare('SELECT id FROM clients WHERE email = ?').bind(email).first();
    const membershipId = crypto.randomUUID();
    const reference = `membership-${membershipId}`;
    const payment = await wompiCheckout({ env, request, reference, amountCents: plan.price_cents, email, name, returnPath: `/reservar/?membresia=${membershipId}#membresias` });
    await env.DB.prepare('INSERT INTO memberships (id, plan_id, client_id, status, class_credits, amount_cents, payment_reference) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(membershipId, plan.id, client.id, 'pending_payment', plan.class_credits, plan.price_cents, reference).run();
    return json({ membershipId, status: 'pending_payment', checkout: payment.checkout }, 201);
  } catch { return json({ error: 'No se pudo iniciar el pago de la membresía.' }, 400); }
}
