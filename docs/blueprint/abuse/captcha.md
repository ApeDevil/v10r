# ALTCHA Captcha

Proof-of-work captcha using [altcha-lib](https://altcha.org/). The client solves a CPU-bound puzzle; the server verifies the HMAC-signed payload. No third-party calls — the entire flow is self-hosted except for the Upstash replay store.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ALTCHA_HMAC_KEY` | Yes | Signs and verifies challenges. 32+ chars in production. Generate: `openssl rand -hex 32` |
| `BOT_DETECTION_MODE` | No | `live` (default) \| `dry_run` \| `off` |

---

## Kill Switch: `BOT_DETECTION_MODE`

| Mode | Behavior |
|------|----------|
| `live` | Denials short-circuit the request (default) |
| `dry_run` | Checks run and are logged, but all requests proceed — use for calibration |
| `off` | Checks skipped entirely — emergency bypass only, never in production |

`parseMode()` in `config.ts` defaults to `'live'` for any unrecognized value, so a missing env var is safe.

---

## Fail-Closed: `assertProductionConfig`

`config.ts` calls `assertProductionConfig()` at module load. In `NODE_ENV=production` it throws — failing the build or cold start — if:

- `BOT_DETECTION_MODE` is not `'live'`
- `ALTCHA_HMAC_KEY` is shorter than 32 characters
- `ALTCHA_HMAC_KEY` matches a placeholder pattern (`test-*`, `dummy-*`, `example-*`, `changeme*`, `placeholder*`)

This ensures misconfigured production deploys fail fast rather than silently allowing all traffic.

---

## Server Library (`$lib/server/abuse/altcha.ts`)

```typescript
// Algorithm
algorithm: 'PBKDF2/SHA-256'
cost: 100_000           // iterations — slow enough to deter bots, fast enough for humans

// Replay store
REPLAY_KEY_PREFIX = 'altcha:nonce:'
REPLAY_TTL_SECONDS = 600   // 10 minutes — auto-expired by Redis EX
```

The `altcha` instance is created via `create()` from `altcha-lib/frameworks/sveltekit` and is `null` when `ALTCHA_HMAC_KEY` is absent. Every downstream call guards on this.

### `verifyAltcha(payload)`

Public function exported from `$lib/server/abuse/`. Wraps internal verification with `BOT_DETECTION_MODE` behavior:

```typescript
import { verifyAltcha } from '$lib/server/abuse';

const decision = await verifyAltcha(request.headers.get('x-altcha-token'));
if (!decision.allowed) return decisionResponse(decision);
```

Returns a `Decision` (`{ allowed: true }` or `{ allowed: false, layer: 'altcha', ... }`).

### Replay Protection

Each solved payload carries a nonce. On first verify, the nonce is written to Redis (`altcha:nonce:{nonce}`, TTL 600s). A second use of the same payload hits the key and is rejected. If Redis is unavailable the store's `get` returns `null` and `set` is a no-op — replay protection degrades gracefully in dev; `assertProductionConfig` ensures Redis is configured in production.

---

## Challenge Endpoint (`/api/captcha/challenge`)

`GET /api/captcha/challenge` — issues a new challenge to the widget.

Per-IP rate limit: **30 requests per 60 seconds** (`rl:captcha:challenge` prefix, `createLimiter` factory).

Returns 503 if `BOT_DETECTION_MODE === 'off'`.

---

## `<Altcha />` Composite

`$lib/components/composites/altcha/Altcha.svelte` wraps the `<altcha-widget>` custom element.

### Props

| Prop | Default | Description |
|------|---------|-------------|
| `challengeUrl` | `'/api/captcha/challenge'` | Endpoint the widget fetches |
| `name` | `'altcha'` | Form-field name for the solved payload |
| `hideFooter` | `true` | Hide the ALTCHA branding strip |
| `hideLogo` | `true` | Hide the ALTCHA logo |
| `onverified` | — | Called with the solved payload string |
| `onexpired` | — | Called when an in-flight challenge expires |

### Gotchas

**`challenge` attribute, not `challengeurl`.** The altcha v3 custom element renamed the attribute. The component uses `challenge={challengeUrl}` on the element directly.

**`hideFooter`/`hideLogo` require `configure()`.** These options are not HTML attributes in v3 — they must be passed through the widget's `configure()` method post-mount:

```typescript
onMount(async () => {
    await import('altcha');
    widget?.configure?.({ hideFooter, hideLogo });
});
```

Setting them as HTML attributes has no effect.

**Token is single-use.** Re-mount the widget after the parent consumes the payload (e.g., `{#key someVersion}<Altcha />{/key}`).

---

## Auth Hook Wiring

Captcha verification runs in the `authCaptchaGate` hook handler before Better Auth processes these paths:

- `POST /api/auth/sign-in/magic-link`
- `POST /api/auth/email-otp/send-verification-otp`

The solved payload is expected in the `x-altcha-token` request header. The Better Auth client must attach it when calling `signIn.magicLink()` or `signIn.emailOtp.sendOtp()`.

---

## Related

- [rate-limits.md](./rate-limits.md) — per-IP challenge limiter, per-email limiter wired alongside captcha
- [Live showcase](/showcases/abuse/captcha)
