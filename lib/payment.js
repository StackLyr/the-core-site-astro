import { sha256Hex } from './booking.js';

export function wompiConfigured(env) {
  const prefix = env.WOMPI_ENV === 'test' ? 'test' : env.WOMPI_ENV === 'prod' ? 'prod' : null;
  return Boolean(prefix && env.WOMPI_PUBLIC_KEY?.startsWith(`pub_${prefix}_`) &&
    env.WOMPI_INTEGRITY_SECRET?.startsWith(`${prefix}_integrity_`) &&
    env.WOMPI_EVENTS_SECRET?.startsWith(`${prefix}_events_`));
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
