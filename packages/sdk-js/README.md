# @stellar-pay/sdk-js

TypeScript SDK for StellarPay - A payment processing platform built on Stellar blockchain.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
- [Payment Operations](#payment-operations)
- [Webhooks](#webhooks)
- [Error Handling](#error-handling)
- [Code Examples](#code-examples)
- [TypeScript Types](#typescript-types)

## Installation

```bash
# npm
npm install @stellar-pay/sdk-js

# pnpm
pnpm add @stellar-pay/sdk-js

# yarn
yarn add @stellar-pay/sdk-js
```

## Quick Start

```typescript
import { StellarPay } from '@stellar-pay/sdk-js';

// Initialize the SDK
const stellarPay = new StellarPay({
  apiKey: 'your_api_key',
  merchantId: 'your_merchant_id',
  network: 'testnet', // or 'mainnet'
});

// Create a payment
const payment = await stellarPay.payments.create({
  amount: 100,
  currency: 'USDC',
  reference: 'order_123',
});

console.log('Payment ID:', payment.paymentId);
```

## Configuration

### Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your merchant API key |
| `merchantId` | `string` | Yes | Your merchant ID |
| `network` | `'testnet' \| 'mainnet'` | No | Network to use (default: `testnet`) |
| `baseUrl` | `string` | No | API base URL (default: `https://api.stellarpay.io`) |
| `timeout` | `number` | No | Request timeout in ms (default: `30000`) |
| `webhookSecret` | `string` | No | Secret for webhook signature verification |

```typescript
const stellarPay = new StellarPay({
  apiKey: process.env.STELLAR_PAY_API_KEY,
  merchantId: process.env.STELLAR_PAY_MERCHANT_ID,
  network: 'mainnet',
  baseUrl: 'https://api.stellarpay.io',
  timeout: 30000,
  webhookSecret: process.env.WEBHOOK_SECRET,
});
```

---

## API Reference

### `new StellarPay(options)`

Creates a new StellarPay instance.

```typescript
const stellarPay = new StellarPay({
  apiKey: 'sk_live_...',
  merchantId: 'merchant_123',
});
```

### `stellarPay.payments`

Access payment operations.

```typescript
const payments = stellarPay.payments;
```

---

## Payment Operations

### `payments.create(options)`

Creates a new payment request.

```typescript
interface CreatePaymentOptions {
  amount: number;
  currency: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

interface Payment {
  paymentId: string;
  status: 'pending' | 'confirmed' | 'failed' | 'completed';
  amount: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
}

const payment = await stellarPay.payments.create({
  amount: 100.00,
  currency: 'USDC',
  reference: 'order_456',
  metadata: {
    customerId: 'cust_123',
    items: ['item1', 'item2'],
  },
});
```

**Returns:** `Promise<Payment>`

---

### `payments.confirm(options)`

Confirms a payment after on-chain transaction.

```typescript
interface ConfirmPaymentOptions {
  paymentId: string;
  txHash: string;
}

const confirmed = await stellarPay.payments.confirm({
  paymentId: 'pay_abc123',
  txHash: '0xdeadbeef123...',
});
```

**Returns:** `Promise<PaymentConfirmation>`

```typescript
interface PaymentConfirmation {
  paymentId: string;
  confirmed: boolean;
  txHash: string;
  confirmedAt: string;
}
```

---

### `payments.get(paymentId)`

Retrieves a payment by ID.

```typescript
const payment = await stellarPay.payments.get('pay_abc123');
```

**Returns:** `Promise<Payment>`

---

### `payments.list(options)`

Lists payments with pagination.

```typescript
interface ListPaymentsOptions {
  status?: 'pending' | 'confirmed' | 'failed' | 'completed';
  limit?: number;
  offset?: number;
}

const payments = await stellarPay.payments.list({
  status: 'confirmed',
  limit: 20,
  offset: 0,
});
```

**Returns:** `Promise<PaymentList>`

```typescript
interface PaymentList {
  payments: Payment[];
  total: number;
  limit: number;
  offset: number;
}
```

---

### `payments.cancel(paymentId)`

Cancels a pending payment.

```typescript
const cancelled = await stellarPay.payments.cancel('pay_abc123');
```

**Returns:** `Promise<Payment>`

---

## Webhooks

### Setting Up Webhooks

```typescript
import { StellarPay, WebhookEvent } from '@stellar-pay/sdk-js';

const stellarPay = new StellarPay({
  apiKey: 'sk_live_...',
  merchantId: 'merchant_123',
  webhookSecret: 'whsec_...',
});

// Express example
app.post('/webhooks/stellarpay', async (req, res) => {
  const event = stellarPay.webhooks.verify(req.headers, req.body);
  
  switch (event.type) {
    case 'payment.created':
      console.log('Payment created:', event.paymentId);
      break;
    case 'payment.confirmed':
      console.log('Payment confirmed:', event.paymentId);
      break;
    case 'payment.failed':
      console.log('Payment failed:', event.paymentId, event.reason);
      break;
  }
  
  res.status(200).send('OK');
});
```

### `webhooks.verify(headers, body)`

Verifies webhook signature and returns parsed event.

```typescript
const event = stellarPay.webhooks.verify(req.headers, req.body);

// Event types
type WebhookEventType = 
  | 'payment.created'
  | 'payment.confirmed'
  | 'payment.failed'
  | 'payment.completed';

interface WebhookEvent {
  type: WebhookEventType;
  paymentId: string;
  amount: number;
  currency: string;
  timestamp: string;
  reason?: string;
}
```

---

## Error Handling

### Error Types

```typescript
import { 
  StellarPayError,
  PaymentError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  WebhookError,
} from '@stellar-pay/sdk-js';
```

### Handling Errors

```typescript
import { StellarPay, StellarPayError } from '@stellar-pay/sdk-js';

try {
  const payment = await stellarPay.payments.create({
    amount: 100,
    currency: 'USDC',
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof ValidationError) {
    console.error('Invalid payment data:', error.details);
  } else if (error instanceof RateLimitError) {
    console.error('Rate limited. Retry after:', error.retryAfter);
  } else if (error instanceof PaymentError) {
    console.error('Payment failed:', error.code, error.message);
  } else {
    throw error;
  }
}
```

### Error Properties

All errors extend `StellarPayError` and include:

```typescript
interface StellarPayError {
  code: string;
  message: string;
  statusCode: number;
  details?: Record<string, unknown>;
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_API_KEY` | The API key is invalid or expired |
| `MERCHANT_NOT_FOUND` | Merchant does not exist |
| `INVALID_AMOUNT` | Amount must be positive |
| `INSUFFICIENT_BALANCE` | Treasury has insufficient balance |
| `PAYMENT_NOT_FOUND` | Payment does not exist |
| `PAYMENT_EXPIRED` | Payment has expired |
| `PAYMENT_ALREADY_CONFIRMED` | Payment already confirmed |
| `INVALID_WEBHOOK_SIGNATURE` | Webhook signature invalid |

---

## Code Examples

### Complete Payment Flow

```typescript
import { StellarPay } from '@stellar-pay/sdk-js';

const stellarPay = new StellarPay({
  apiKey: process.env.STELLAR_PAY_API_KEY,
  merchantId: process.env.STELLAR_PAY_MERCHANT_ID,
  network: 'testnet',
});

async function handlePayment(amount: number, reference: string) {
  // Step 1: Create payment
  const payment = await stellarPay.payments.create({
    amount,
    currency: 'USDC',
    reference,
  });

  console.log('Payment created:', payment.paymentId);

  // Step 2: Wait for user to send funds
  // (This happens off-chain in your frontend)

  // Step 3: Confirm payment (called by your webhook handler)
  const confirmed = await stellarPay.payments.confirm({
    paymentId: payment.paymentId,
    txHash: '0x...', // Transaction hash from Stellar
  });

  console.log('Payment confirmed:', confirmed.txHash);

  return confirmed;
}
```

### React Integration

```typescript
import { useState, useEffect } from 'react';
import { StellarPay } from '@stellar-pay/sdk-js';

const stellarPay = new StellarPay({
  apiKey: process.env.REACT_APP_STELLAR_PAY_API_KEY,
  merchantId: process.env.REACT_APP_MERCHANT_ID,
});

function PaymentForm({ amount, onSuccess }) {
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);

  const createPayment = async () => {
    setLoading(true);
    try {
      const pay = await stellarPay.payments.create({
        amount,
        currency: 'USDC',
      });
      setPayment(pay);
      onSuccess(pay);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button onClick={createPayment} disabled={loading}>
        {loading ? 'Creating...' : `Pay ${amount} USDC`}
      </button>
      {payment && (
        <div>
          <p>Payment ID: {payment.paymentId}</p>
          <p>Status: {payment.status}</p>
        </div>
      )}
    </div>
  );
}
```

### Node.js Webhook Server

```typescript
import express from 'express';
import { StellarPay } from '@stellar-pay/sdk-js';

const app = express();
app.use(express.json());

const stellarPay = new StellarPay({
  apiKey: process.env.STELLAR_PAY_API_KEY,
  merchantId: process.env.STELLAR_PAY_MERCHANT_ID,
  webhookSecret: process.env.WEBHOOK_SECRET,
});

app.post('/webhooks/stellarpay', (req, res) => {
  try {
    const event = stellarPay.webhooks.verify(
      req.headers,
      req.body
    );

    switch (event.type) {
      case 'payment.created':
        // Handle new payment
        console.log('New payment:', event.paymentId);
        break;

      case 'payment.confirmed':
        // Handle confirmed payment - fulfill order
        console.log('Payment confirmed:', event.paymentId);
        // TODO: Fulfill order here
        break;

      case 'payment.failed':
        // Handle failed payment
        console.log('Payment failed:', event.reason);
        break;
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send('Invalid signature');
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

---

## TypeScript Types

### Core Types

```typescript
interface StellarPayConfig {
  apiKey: string;
  merchantId: string;
  network?: 'testnet' | 'mainnet';
  baseUrl?: string;
  timeout?: number;
  webhookSecret?: string;
}

interface Payment {
  paymentId: string;
  status: 'pending' | 'confirmed' | 'failed' | 'completed';
  amount: number;
  currency: string;
  createdAt: string;
  expiresAt: string;
  reference?: string;
  metadata?: Record<string, unknown>;
}

interface PaymentConfirmation {
  paymentId: string;
  confirmed: boolean;
  txHash: string;
  confirmedAt: string;
}

interface WebhookEvent {
  type: 'payment.created' | 'payment.confirmed' | 'payment.failed' | 'payment.completed';
  paymentId: string;
  amount: number;
  currency: string;
  timestamp: string;
  reason?: string;
}
```

---

## Support

- **Documentation:** https://docs.stellarpay.io
- **GitHub Issues:** https://github.com/MissBlue00/stellar-pay/issues
- **Discord:** https://discord.gg/stellarpay

## License

MIT