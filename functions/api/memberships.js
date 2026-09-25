import { allowPublicRequest, bodyJson, cleanText, json, sameOrigin, validEmail } from '../../lib/booking.js';
import { demoCheckout, demoPaymentReference, demoPaymentsEnabled } from '../../lib/payment.js';

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!env.DB || !demoPaymentsEnabled(env)) return json({ error: 'El simulador de pagos no está habilitado.' }, 503);
  if (!env.ADMIN_SESSION_SECRET) return json({ error: 'Reservas no configuradas.' }, 503);
  if (!(await allowPublicRequest(request, env, 'membership', 6, 60 * 60 * 1000))) return Response.json({ error: 'Demasiadas solicitudes. Intenta más tarde.' }, { status: 429, headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' } });
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
    const reference = demoPaymentReference('plan');
    const payment = demoCheckout({ env, request, kind: 'membership', id: membershipId, token: reference });
    await env.DB.prepare('INSERT INTO memberships (id, plan_id, client_id, status, class_credits, amount_cents, payment_reference) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(membershipId, plan.id, client.id, 'pending_payment', plan.class_credits, plan.price_cents, reference).run();
    return json({ membershipId, status: 'pending_payment', checkout: payment.checkout }, 201);
  } catch { return json({ error: 'No se pudo iniciar el pago de la membresía.' }, 400); }
}
