const DEMO_PAYMENT_TTL_MS = 15 * 60 * 1000;

export function demoPaymentsEnabled(env) {
  return env?.PAYMENT_MODE === 'demo';
}

export function demoPaymentReference(kind) {
  if (!['class', 'plan'].includes(kind)) throw new Error('Tipo de pago demo inválido.');
  return `demo-${kind}-${crypto.randomUUID()}`;
}

export function demoCheckout({ env, request, kind, id, token }) {
  if (!demoPaymentsEnabled(env)) throw new Error('El simulador de pagos no está habilitado.');
  if (!['booking', 'membership'].includes(kind)) throw new Error('Tipo de compra demo inválido.');
  const expiresAt = new Date(Date.now() + DEMO_PAYMENT_TTL_MS).toISOString();
  const url = new URL('/pago-demo/', request.url);
  url.searchParams.set('tipo', kind);
  url.searchParams.set('id', id);
  url.searchParams.set('token', token);
  return { expiresAt, checkout: { url: url.toString(), demo: true } };
}
