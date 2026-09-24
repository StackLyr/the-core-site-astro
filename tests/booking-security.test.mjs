import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { wompiCheckout, wompiConfigured } from '../lib/payment.js';
import { onRequestPost as webhook } from '../functions/api/wompi/webhook.js';

const env = {
  DB: {},
  WOMPI_ENV: 'test',
  WOMPI_PUBLIC_KEY: 'pub_test_synthetic',
  WOMPI_INTEGRITY_SECRET: 'test_integrity_synthetic',
  WOMPI_EVENTS_SECRET: 'test_events_synthetic'
};

test('sandbox requires sandbox keys, never production keys', () => {
  assert.equal(wompiConfigured(env), true);
  assert.equal(wompiConfigured({ ...env, WOMPI_PUBLIC_KEY: 'pub_prod_wrong' }), false);
  assert.equal(wompiConfigured({ ...env, WOMPI_INTEGRITY_SECRET: 'prod_integrity_wrong' }), false);
  assert.equal(wompiConfigured({ ...env, WOMPI_ENV: 'prod' }), false);
});

test('checkout signs the exact Wompi amount, currency, expiry and reference', async () => {
  const reference = 'tcs-class-synthetic';
  const payment = await wompiCheckout({ env, request: new Request('https://example.test/api/bookings'), reference, amountCents: 2500, email: 'qa@example.test', name: 'QA', returnPath: '/reservar/?reserva=synthetic' });
  const fields = payment.checkout.fields;
  const expected = createHash('sha256').update(`${reference}2500USD${fields['expiration-time']}${env.WOMPI_INTEGRITY_SECRET}`).digest('hex');
  assert.equal(fields['signature:integrity'], expected);
  assert.equal(fields['redirect-url'], 'https://example.test/reservar/?reserva=synthetic');
  assert.equal(payment.checkout.url, 'https://checkout.wompi.pa/p/');
});

function signedEvent(reference, checksumOverride) {
  const timestamp = 1234567890;
  const transaction = { id: 'tx-synthetic', status: 'APPROVED', amount_in_cents: 2500, currency: 'USD', reference };
  const checksum = checksumOverride || createHash('sha256').update(`${transaction.id}${transaction.status}${transaction.amount_in_cents}${timestamp}${env.WOMPI_EVENTS_SECRET}`).digest('hex').toUpperCase();
  return { event: 'transaction.updated', environment: 'test', data: { transaction }, signature: { properties: ['transaction.id', 'transaction.status', 'transaction.amount_in_cents'], checksum }, timestamp };
}

test('webhook rejects forged events before database access', async () => {
  const request = new Request('https://example.test/api/wompi/webhook', { method: 'POST', body: JSON.stringify(signedEvent('tcs-class-synthetic', 'BAD')) });
  const response = await webhook({ request, env, waitUntil() {} });
  assert.equal(response.status, 401);
});

test('signed events for another business do not touch this database', async () => {
  const request = new Request('https://example.test/api/wompi/webhook', { method: 'POST', body: JSON.stringify(signedEvent('b1-order-123')) });
  const response = await webhook({ request, env, waitUntil() {} });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, ignored: true });
});
