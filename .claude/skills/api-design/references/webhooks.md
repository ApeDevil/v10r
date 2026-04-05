# Webhooks (Inbound)

Patterns for receiving webhooks from external services (Stripe, GitHub, Inngest, etc.) in SvelteKit.

## The Timing Contract

Webhook handlers must return 200 **fast** (within 3-5 seconds). Do all real work async.

```
Provider → POST /api/webhooks/stripe
  1. Read raw body          (< 1ms)
  2. Verify HMAC signature  (< 1ms)
  3. Check idempotency      (< 10ms, single DB query)
  4. Return 200             ← HERE, before processing
  5. Process async           (background, any duration)
```

If the handler takes >30s, the provider retries — creating duplicate events if you don't have idempotency.

## HMAC-SHA256 Signature Verification

### Stripe Pattern

```typescript
// src/lib/server/webhooks/verify.ts
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string,
  toleranceSeconds = 300, // 5 minutes
): boolean {
  // Stripe format: "t=timestamp,v1=sig1,v1=sig2"
  const parts: Record<string, string> = {};
  for (const pair of signature.split(',')) {
    const [key, value] = pair.split('=', 2);
    if (key && value) parts[key] = value;
  }

  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  // Reject stale events (replay attack prevention)
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (Math.abs(age) > toleranceSeconds) return false;

  // Compute expected signature
  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  // Constant-time comparison (timing attack prevention)
  const a = Buffer.from(v1, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

### Provider-Specific Libraries

| Provider | Verification Method |
|----------|-------------------|
| Stripe | `stripe.webhooks.constructEvent(body, sig, secret)` (official SDK) |
| GitHub | `@octokit/webhooks` — `X-Hub-Signature-256` HMAC-SHA256 |
| Svix (Inngest, Clerk) | `new Webhook(secret).verify(body, headers)` |
| Generic HMAC | `crypto.timingSafeEqual()` (see above) |

All methods available in Bun via `node:crypto`.

### Critical Rules

1. **`request.text()` first** — Read raw body before any JSON parsing. `request.json()` loses exact bytes.
2. **`timingSafeEqual()` always** — Never use `===` for HMAC comparison (timing attack).
3. **Validate timestamp** — Reject events older than 5 minutes (replay attack prevention).

## Full Webhook Endpoint

```typescript
// src/routes/api/webhooks/stripe/+server.ts
import type { RequestHandler } from './$types';
import { STRIPE_WEBHOOK_SECRET } from '$env/static/private';
import { verifyStripeSignature } from '$lib/server/webhooks/verify';
import { db } from '$lib/server/db';
import { processedWebhookEvents } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ request }) => {
  // 1. Read raw body FIRST
  const rawBody = await request.text();
  const sig = request.headers.get('stripe-signature') ?? '';

  // 2. Verify signature
  if (!verifyStripeSignature(rawBody, sig, STRIPE_WEBHOOK_SECRET)) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody);

  // 3. Idempotency check
  try {
    await db.insert(processedWebhookEvents).values({
      eventId: event.id,
      provider: 'stripe',
      eventType: event.type,
    });
  } catch (err) {
    // Unique constraint violation = already processed
    if (isUniqueViolation(err)) {
      return new Response(null, { status: 200 });
    }
    throw err;
  }

  // 4. Return 200 IMMEDIATELY — process async
  processStripeEvent(event).catch((err) => {
    console.error('Webhook processing failed:', event.id, err);
    // Dead-letter: mark for manual review or retry
  });

  return new Response(null, { status: 200 });
};
```

## Idempotency Database Schema

```typescript
// src/lib/server/db/schema/webhooks.ts
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const processedWebhookEvents = pgTable('processed_webhook_events', {
  eventId: text('event_id').primaryKey(),
  provider: text('provider').notNull(),
  eventType: text('event_type').notNull(),
  processedAt: timestamp('processed_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull()
    .$defaultFn(() => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
});
```

**7-day retention:** Stripe retries for up to 3 days. 7 days gives a 4-day safety margin. Clean up expired rows with a background job.

### Why `INSERT ON CONFLICT DO NOTHING`

```typescript
// Check-then-insert has a race condition:
const existing = await db.query... // Thread A: not found
// Thread B: inserts event
await db.insert(...); // Thread A: duplicate!

// ON CONFLICT DO NOTHING is atomic:
const result = await db.insert(processedWebhookEvents)
  .values({ eventId, provider, eventType })
  .onConflictDoNothing({ target: processedWebhookEvents.eventId })
  .returning();

const isNew = result.length > 0;
```

## Webhook vs Regular API Endpoint

| Aspect | Regular API | Webhook |
|--------|-------------|---------|
| Auth mechanism | Session cookie / API key | HMAC signature (provider-specific) |
| Body reading | `request.json()` | `request.text()` first, then parse |
| Response timing | After processing completes | Before processing (return 200 fast) |
| Idempotency | Optional (via `Idempotency-Key`) | Required (providers retry on failure) |
| Error response | 4xx/5xx with error details | 200 even on internal failure |
| CSRF protection | Required (SvelteKit + custom header) | Not applicable (HMAC replaces CSRF) |
| Rate limiting | Per-user limits | Per-provider IP allowlist (optional) |

### Why Return 200 on Internal Failure

If your processing fails due to a bug (not infrastructure), provider retries will all fail the same way — wasting retry quota and creating noise. Instead:

1. Return 200 to acknowledge receipt
2. Log the failure with full context
3. Send to dead-letter queue or error tracking
4. Fix the bug, then replay from your `processedWebhookEvents` table

Only return 5xx for transient infrastructure failures (DB unreachable) where a retry might succeed.

## Inngest Integration

For complex multi-step processing, fire an Inngest event from the webhook handler:

```typescript
// In the webhook handler, after idempotency check:
await inngest.send({
  name: 'stripe/payment.succeeded',
  data: {
    eventId: event.id,
    orderId: event.data.object.metadata.orderId,
  },
});
return new Response(null, { status: 200 });
```

```typescript
// src/lib/server/inngest/functions/order-fulfillment.ts
export const fulfillOrder = inngest.createFunction(
  { id: 'fulfill-order', retries: 3 },
  { event: 'stripe/payment.succeeded' },
  async ({ event, step }) => {
    const order = await step.run('fetch-order', () =>
      getOrder(event.data.orderId)
    );
    await step.run('update-inventory', () =>
      decrementInventory(order.items)
    );
    await step.run('send-confirmation', () =>
      sendOrderConfirmation(order)
    );
  }
);
```

Inngest handles retries, observability, and step-level failure isolation. Each `step.run()` is retried independently.

## SvelteKit Raw Body Access

Confirmed working in production across all adapters (`adapter-node`, `adapter-vercel`, `svelte-adapter-bun`):

```typescript
const rawBody = await request.text();
```

The historical confusion about raw body access was limited to the dev server in older SvelteKit versions. In production, `request.text()` returns the original bytes.
