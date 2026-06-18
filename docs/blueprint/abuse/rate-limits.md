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

The Upstash client is constructed with `timeout: 1000` — a slow Redis cannot stall a request indefinitely; the call is bounded at one second.

**Redis-unavailable behavior:**

| Failure | Dev | Production |
|---------|-----|-----------|
| Redis missing at boot | Passthrough — rate limiting disabled, warning logged | Fail-closed — all requests blocked, error logged |
| Redis throws at runtime (`.limit()` rejects/times out) | Passthrough | **Fail-closed — returns `success: false` (429), error logged** |

`createLimiter` wraps `.limit()` so a runtime Redis throw fails CLOSED in production (429) rather than surfacing a 500. This matches the boot-time posture: when the rate limiter cannot make a decision, the safe default is to deny, not to let traffic through unmetered. Dev still passes through so local work isn't blocked by a missing Redis.

`@upstash/ratelimit` `slidingWindow` algorithm is used for all limiters.

---

## Active Limiters

| Limiter | Identifier | Limit | Window | Redis Prefix | Wired In |
|---------|-----------|-------|--------|--------------|----------|
| Per-email | sha256(normalized email) | 5 | 1 hour | `rl:abuse:email` | `authCaptchaGate` hook |
| Per-IP challenge | client IP | 30 | 60 s | `rl:captcha:challenge` | `GET /api/captcha/challenge` |
| Feedback (per-IP) | client IP | 3 | 1 hour | `rl:feedback:submit` | feedback form action |
| Comment write (per-user) | user ID | 5 | 1 min | `rl:comment:user` | `POST /api/blog/posts/[id]/comments` |
| Comment write (per-user hourly) | user ID | 30 | 1 hour | `rl:comment:user:hr` | same |
| Comment write (per-IP) | client IP | 20 | 1 hour | `rl:comment:ip` | same |
| Comment write (per-post) | post ID | 60 | 1 min | `rl:comment:post` | same |
| Grant request (per-user) | user ID | 1 | 24 hours | `rl:grant-request:user` | `POST /api/grant-requests` |
| Admin grant actions | admin user ID | 30 | 1 min | `rl:admin:grants` | `/api/admin/grant-requests/*`, `/api/admin/users/[id]/grants/*` |

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
