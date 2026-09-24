import { isAdmin, json, sameOrigin } from '../../../../lib/booking.js';
import { sendQueuedEmail } from '../../../../lib/email.js';

export async function onRequestPost({ request, env, params }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const item = await env.DB.prepare('SELECT event_key FROM email_outbox WHERE id = ?').bind(params.id).first();
  if (!item) return json({ error: 'Correo no encontrado.' }, 404);
  const result = await sendQueuedEmail(env, item.event_key);
  return json(result);
}
