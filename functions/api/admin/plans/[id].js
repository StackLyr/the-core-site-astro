import { bodyJson, isAdmin, json, sameOrigin } from '../../../../lib/booking.js';

export async function onRequestPatch({ request, env, params }) {
  if (!sameOrigin(request) || !(await isAdmin(request, env))) return json({ error: 'No autorizado.' }, 403);
  if (!env.DB) return json({ error: 'Base de datos no configurada.' }, 503);
  try {
    const body = await bodyJson(request);
    if (typeof body.active !== 'boolean') return json({ error: 'Estado inválido.' }, 400);
    const result = await env.DB.prepare('UPDATE membership_plans SET active = ? WHERE id = ?').bind(body.active ? 1 : 0, params.id).run();
    return result.meta.changes === 1 ? json({ ok: true }) : json({ error: 'Membresía no encontrada.' }, 404);
  } catch { return json({ error: 'Solicitud inválida.' }, 400); }
}
