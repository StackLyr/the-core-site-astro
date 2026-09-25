import test from 'node:test';
import assert from 'node:assert/strict';
import { demoCheckout, demoPaymentReference, demoPaymentsEnabled } from '../lib/payment.js';
import { onRequestPost as settleDemoPayment } from '../functions/api/demo-payment.js';

const demoEnv = { PAYMENT_MODE: 'demo' };

test('demo payments require an explicit demo-only mode', () => {
  assert.equal(demoPaymentsEnabled(demoEnv), true);
  assert.equal(demoPaymentsEnabled({ PAYMENT_MODE: 'test' }), false);
  assert.equal(demoPaymentsEnabled({}), false);
});

test('demo checkout stays on the current origin and never requests card fields', () => {
  const id = crypto.randomUUID();
  const token = demoPaymentReference('class');
  const payment = demoCheckout({ env: demoEnv, request: new Request('https://example.test/api/bookings'), kind: 'booking', id, token });
  const url = new URL(payment.checkout.url);
  assert.equal(url.origin, 'https://example.test');
  assert.equal(url.pathname, '/pago-demo/');
  assert.equal(url.searchParams.get('id'), id);
  assert.equal(url.searchParams.get('token'), token);
  assert.equal(payment.checkout.demo, true);
  assert.equal('fields' in payment.checkout, false);
});

test('demo references are isolated by purchase type', () => {
  assert.match(demoPaymentReference('class'), /^demo-class-[0-9a-f-]{36}$/);
  assert.match(demoPaymentReference('plan'), /^demo-plan-[0-9a-f-]{36}$/);
  assert.throws(() => demoPaymentReference('order'));
});

test('demo settlement rejects cross-origin requests before database access', async () => {
  const request = new Request('https://example.test/api/demo-payment', { method: 'POST', headers: { Origin: 'https://attacker.test' }, body: '{}' });
  const response = await settleDemoPayment({ request, env: demoEnv });
  assert.equal(response.status, 403);
});

test('demo settlement is unavailable unless the explicit mode is enabled', async () => {
  const request = new Request('https://example.test/api/demo-payment', { method: 'POST', headers: { Origin: 'https://example.test' }, body: '{}' });
  const response = await settleDemoPayment({ request, env: { PAYMENT_MODE: 'off' } });
  assert.equal(response.status, 503);
});
