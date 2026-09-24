import { sha256Hex } from './booking.js';

export function wompiConfigured(env) {
  return Boolean(env.WOMPI_PUBLIC_KEY && env.WOMPI_INTEGRITY_SECRET && env.WOMPI_EVENTS_SECRET && ['test', 'prod'].includes(env.WOMPI_ENV));
}

export async function wompiCheckout({ env, request, reference, amountCents, email, name, returnPath }) {
  const expiresAt = new Date(Date.now() + 15 * 60000).toISOString();
  const signature = await sha256Hex(`${reference}${amountCents}USD${expiresAt}${env.WOMPI_INTEGRITY_SECRET}`);
  return {
    expiresAt,
    checkout: {
      url: 'https://checkout.wompi.pa/p/',
      fields: {
        'public-key': env.WOMPI_PUBLIC_KEY,
        currency: 'USD',
        'amount-in-cents': String(amountCents),
        reference,
        'expiration-time': expiresAt,
        'signature:integrity': signature,
        'redirect-url': `${new URL(request.url).origin}${returnPath}`,
        'customer-data:email': email,
        'customer-data:full-name': name
      }
    }
  };
}
