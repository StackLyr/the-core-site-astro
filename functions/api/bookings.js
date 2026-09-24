import { bodyJson, cleanText, isAdmin, json, sameOrigin, sha256Hex, validEmail } from '../../lib/booking.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 401);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const result = await env.DB.prepare(`SELECT b.id, b.status, b.amount_cents, b.created_at, b.cancelled_at, b.wompi_transaction_id,
      s.class_name, s.starts_at, c.name, c.email, c.phone
      FROM bookings b JOIN sessions s ON s.id = b.session_id JOIN clients c ON c.id = b.client_id
      WHERE s.starts_at >= ? ORDER BY s.starts_at ASC, b.created_at ASC LIMIT 500`)
    .bind(new Date(Date.now() - 30 * 86400000).toISOString()).all();
  return json({ bookings: result.results });
}

export async function onRequestPost({ request, env }) {
  if (!sameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  try {
    const body = await bodyJson(request);
    const name = cleanText(body.name, 100);
    const email = cleanText(body.email, 254).toLowerCase();
    const phone = cleanText(body.phone, 35);
    const sessionId = cleanText(body.sessionId, 80);
    if (name.length < 2 || !validEmail(email) || phone.length < 7 || !sessionId) return json({ error: 'Completa nombre, correo y teléfono válidos.' }, 400);
    const session = await env.DB.prepare("SELECT * FROM sessions WHERE id = ? AND state = 'open' AND starts_at > ?").bind(sessionId, new Date(Date.now() + 30 * 60000).toISOString()).first();
    if (!session) return json({ error: 'Esa clase ya no está disponible.' }, 404);
    const priced = Number.isInteger(session.price_cents) && session.price_cents > 0;
    if (priced && (!env.WOMPI_PUBLIC_KEY || !env.WOMPI_INTEGRITY_SECRET || !env.WOMPI_EVENTS_SECRET)) return json({ error: 'El pago en línea aún no está configurado. Contacta al estudio.' }, 503);
    if (priced && env.WOMPI_ENV !== 'test' && env.WOMPI_ENV !== 'prod') return json({ error: 'Ambiente de pago no configurado.' }, 503);
    const clientId = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO clients (id, name, email, phone) VALUES (?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, phone = excluded.phone').bind(clientId, name, email, phone).run();
    const client = await env.DB.prepare('SELECT id FROM clients WHERE email = ?').bind(email).first();
    const bookingId = crypto.randomUUID();
    const expiresAt = priced ? new Date(Date.now() + 15 * 60000).toISOString() : null;
    const reference = priced ? `core-${bookingId}` : null;
    const status = priced ? 'pending_payment' : 'requested';
    const now = new Date().toISOString();
    const result = await env.DB.prepare(`INSERT INTO bookings (id, session_id, client_id, status, amount_cents, payment_reference, hold_expires_at)
      SELECT ?, s.id, ?, ?, s.price_cents, ?, ? FROM sessions s
      WHERE s.id = ? AND s.state = 'open' AND s.starts_at > ?
      AND (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND
        (b.status IN ('requested', 'confirmed') OR (b.status = 'pending_payment' AND b.hold_expires_at > ?))) < s.capacity
      AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.session_id = s.id AND b.client_id = ? AND
        (b.status IN ('requested', 'confirmed') OR (b.status = 'pending_payment' AND b.hold_expires_at > ?)))`)
      .bind(bookingId, client.id, status, reference, expiresAt, sessionId, now, now, client.id, now).run();
    if (result.meta.changes !== 1) return json({ error: 'No quedan cupos o ya tienes una reserva para esta clase.' }, 409);
    await env.DB.prepare('INSERT INTO booking_events (id, booking_id, event_type) VALUES (?, ?, ?)').bind(crypto.randomUUID(), bookingId, status).run();
    if (!priced) return json({ bookingId, status, message: 'Solicitud recibida. El estudio confirmará tu lugar.' }, 201);
    const signature = await sha256Hex(`${reference}${session.price_cents}USD${expiresAt}${env.WOMPI_INTEGRITY_SECRET}`);
    return json({ bookingId, status, checkout: {
      url: 'https://checkout.wompi.pa/p/',
      fields: {
        'public-key': env.WOMPI_PUBLIC_KEY,
        currency: 'USD',
        'amount-in-cents': String(session.price_cents),
        reference,
        'expiration-time': expiresAt,
        'signature:integrity': signature,
        'redirect-url': `${new URL(request.url).origin}/reservar?reserva=${bookingId}`,
        'customer-data:email': email,
        'customer-data:full-name': name
      }
    } }, 201);
  } catch {
    return json({ error: 'No se pudo crear la reserva.' }, 400);
  }
}
