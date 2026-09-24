export async function queueEmail(env, { key, to, subject, text }) {
  if (!env.DB || !to) return;
  await env.DB.prepare('INSERT OR IGNORE INTO email_outbox (id, event_key, to_email, subject, body_text) VALUES (?, ?, ?, ?, ?)')
    .bind(crypto.randomUUID(), key, to, subject, text).run();
}

export async function sendQueuedEmail(env, key) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !env.DB) return { sent: false, reason: 'Correo no configurado' };
  const item = await env.DB.prepare("SELECT * FROM email_outbox WHERE event_key = ? AND status <> 'sent'").bind(key).first();
  if (!item) return { sent: false, reason: 'No hay correo pendiente' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': item.event_key },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [item.to_email], subject: item.subject, text: item.body_text })
    });
    if (!response.ok) throw new Error(`Resend HTTP ${response.status}`);
    await env.DB.prepare("UPDATE email_outbox SET status = 'sent', attempts = attempts + 1, sent_at = ?, last_error = NULL WHERE id = ?")
      .bind(new Date().toISOString(), item.id).run();
    return { sent: true };
  } catch (error) {
    await env.DB.prepare("UPDATE email_outbox SET status = 'failed', attempts = attempts + 1, last_error = ? WHERE id = ?")
      .bind(String(error.message).slice(0, 200), item.id).run();
    return { sent: false, reason: 'No se pudo enviar el correo' };
  }
}

export function classDate(iso) {
  return new Intl.DateTimeFormat('es-PA', { timeZone: 'America/Panama', dateStyle: 'full', timeStyle: 'short' }).format(new Date(iso));
}
