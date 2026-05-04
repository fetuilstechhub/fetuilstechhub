import crypto from 'crypto';

// Configuration
const WEBHOOK_URL = 'http://localhost:8787/api/webhook';
const PAYSTACK_SECRET = 'sk_test_1d54598f4325bde2e1fa55900899a84ac920e81d';

// Simulate a Paystack webhook payload
const payload = {
  event: 'charge.success',
  data: {
    id: 123456789,
    reference: 'zirob6idhr'
    amount: 150000,
    currency: 'NGN',
    status: 'success',
    customer: {
      id: 9999,
      email: 'test@example.com',
      customer_code: 'CUS_xxx',
      first_name: 'Test',
      last_name: 'User',
      email_verified: 1,
      customer_code: 'CUS_test'
    },
    metadata: {},
    authorization: {
      authorization_code: 'AUTH_xxx'
    }
  }
};

// Convert payload to JSON and compute signature
const text = JSON.stringify(payload);
const signature = crypto.createHmac('sha512', PAYSTACK_SECRET).update(text).digest('hex');

console.log('Sending test webhook...');
console.log('URL:', WEBHOOK_URL);
console.log('Reference:', payload.data.reference);

fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-paystack-signature': signature,
  },
  body: text,
})
  .then(res => {
    console.log('Response status:', res.status);
    return res.text();
  })
  .then(data => {
    console.log('Response:', data);
    console.log('✅ Test webhook sent! Check server logs for email result.');
  })
  .catch(err => console.error('❌ Error:', err.message));
