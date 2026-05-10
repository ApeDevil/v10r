# Rate Limits

Sliding-window rate limits backed by Upstash Redis. All limiters are created with the `createLimiter` factory from `$lib/server/api/rate-limit.ts` — no global hook limiter, no cookie secrets, no `sveltekit-rate-limiter`.

---

## `createLimiter` Factory

```typescript
import { createLimiter } from '$lib/server/api/rate-limit';

const limiter = createLimiter(prefix, max, window);
// prefix — Redis key namespace (string)
// max    — requests allowed per window
// window — Duration string: '60 s', '1 h', etc.
```

Returns a `Limiter` with one method: `limit(id: string): Promise<{ success: boolean; reset: number }>`.

**Redis-unavailable behavior:**

| Environment | Redis missing |
|-------------|---------------|
| Dev | Passthrough — rate limiting disabled, warning logged |
| Production | Fail-closed — all requests blocked, error logged |

`@upstash/ratelimit` `slidingWindow` algorithm is used for all limiters.

---

## Active Limiters

| Limiter | Identifier | Limit | Window | Redis Prefix | Wired In |
|---------|-----------|-------|--------|--------------|----------|
| Per-email | sha256(normalized email) | 5 | 1 hour | `rl:abuse:email` | `authCaptchaGate` hook |
| Per-IP challenge | client IP | 30 | 60 s | `rl:captcha:challenge` | `GET /api/captcha/challenge` |
| Feedback (per-IP) | client IP | 3 | 1 hour | `rl:feedback:submit` | feedback form action |

---

## Per-Email Limiter (`$lib/server/abuse/rate-limit/per-email.ts`)

Closes the email-bombing vector: an attacker rotating IPs can still drain email quota and hammer one victim's inbox without a per-target limit. Keying on a sha256 hash of the normalized email closes this regardless of source IP.

```typescript
import { checkEmailRateLimit } from '$lib/server/abuse';

const decision = await checkEmailRateLimit(email);
if (!decision.allowed) return decisionResponse(decision);
```

The hash is one-way — raw email is never stored in Redis.

**Constants (from `config.ts`):**

| Constant | Value |
|----------|-------|
| `PER_EMAIL_LIMIT_MAX` | `5` |
| `PER_EMAIL_LIMIT_WINDOW` | `'1 h'` |
| `PER_EMAIL_LIMIT_PREFIX` | `'rl:abuse:email'` |

---

## Auth Hook Wiring

The `authCaptchaGate` hook handler runs both captcha verification and per-email rate limiting before Better Auth processes:

- `POST /api/auth/sign-in/magic-link`
- `POST /api/auth/email-otp/send-verification-otp`

Order: captcha first, per-email second. Either denial short-circuits the request.

The email is extracted from the request body via `request.clone().json()` so Better Auth can still consume the original body.

---

## `rateLimitResponse`

Standard 429 response builder. Used by endpoint handlers when a limiter returns `success: false`:

```typescript
import { rateLimitResponse } from '$lib/server/api/rate-limit';

const { success, reset } = await limiter.limit(ip);
if (!success) return rateLimitResponse(reset);
```

Returns JSON `{ error: { code: 'rate_limited', message } }` with `Retry-After` header.

---

## Related

- [captcha.md](./captcha.md) — captcha layer wired in the same auth hook
- [Live showcase](/showcases/abuse/rate-limits)
