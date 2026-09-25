import { isAdmin, json } from '../../../lib/booking.js';

export async function onRequestGet({ request, env }) {
  if (!(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 401);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const [sessions, plans, memberships, emails] = await env.DB.batch([
    env.DB.prepare(`SELECT s.*, (SELECT COUNT(*) FROM bookings b WHERE b.session_id = s.id AND b.status IN ('requested','confirmed')) AS occupied FROM sessions s WHERE s.starts_at >= ? ORDER BY s.starts_at LIMIT 300`).bind(new Date(Date.now() - 7 * 86400000).toISOString()),
    env.DB.prepare('SELECT * FROM membership_plans ORDER BY created_at DESC LIMIT 100'),
    env.DB.prepare('SELECT m.*, p.name AS plan_name, c.name, c.email, c.phone FROM memberships m JOIN membership_plans p ON p.id = m.plan_id JOIN clients c ON c.id = m.client_id ORDER BY m.created_at DESC LIMIT 300'),
    env.DB.prepare("SELECT id, event_key, to_email, subject, status, attempts, last_error, created_at FROM email_outbox ORDER BY created_at DESC LIMIT 100")
  ]);
  return json({ sessions: sessions.results, plans: plans.results, memberships: memberships.results, emails: emails.results });
}
