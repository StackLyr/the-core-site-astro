import { bodyJson, isAdmin, json, sameOrigin } from '../../../../lib/booking.js';

export async function onRequestPatch({ request, env, params }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  const { state } = await bodyJson(request);
  if (!['open', 'closed'].includes(state)) return json({ error: 'Estado inválido.' }, 400);
  const result = await env.DB.prepare('UPDATE sessions SET state = ? WHERE id = ? AND starts_at > ?').bind(state, params.id, new Date().toISOString()).run();
  if (result.meta.changes !== 1) return json({ error: 'Clase no encontrada o ya finalizada.' }, 404);
  return json({ ok: true });
}
