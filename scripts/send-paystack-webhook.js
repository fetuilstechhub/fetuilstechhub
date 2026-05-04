/*
  Test script to POST a simulated Paystack webhook to a local endpoint.

  Usage:
    node scripts/send-paystack-webhook.js http://localhost:8787/api/webhook YOUR_PAYSTACK_SECRET

  This will build a minimal `charge` payload and sign it with HMAC-SHA512 using the provided secret.
*/
import crypto from 'crypto';
import fetch from 'node-fetch';

const [,, url, secret] = process.argv;
if (!url || !secret) {
  console.error('Usage: node send-paystack-webhook.js <url> <paystack_secret>');
  process.exit(1);
}

const payload = {
  event: 'charge.success',
  data: {
    reference: 'TEST_REF_12345',
    status: 'success',
    amount: 150000,
    currency: 'NGN',
    customer: { email: 'test@example.com' },
  }
};

const text = JSON.stringify(payload);
const signature = crypto.createHmac('sha512', secret).update(text).digest('hex');

(async () => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature },
    body: text,
  });
  console.log('status', res.status);
  console.log(await res.text());
})();
