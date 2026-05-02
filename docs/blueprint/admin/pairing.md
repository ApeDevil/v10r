# Cross-Device Debug Pairing

## Purpose

Admin tests the public site on a real phone without a second login. The phone's anonymous pageviews appear live on the PC dashboard's Live Activity feed, attributed to the admin's identity. The phone never logs in — attribution happens through a short-lived pairing code and an HMAC-signed cookie.

## Flow

1. Admin visits the analytics dashboard on PC and requests a new pairing code (`POST /api/admin/analytics/pair`).
2. Server generates a 6-digit code and returns it alongside a QR code (SVG, server-rendered) and the full URL `/pair/<code>`.
3. Admin scans the QR or reads the code aloud; phone navigates to `/pair/<code>`.
4. Server atomically claims the code: sets `consumed_at`, stamps the phone's `_v10r_sid` session row with `paired_admin_user_id` + `paired_at`, and sets the `v10r_debug_owner` HMAC cookie.
5. Phone is redirected to `/`.
6. All subsequent pageviews from that phone carry `debug_owner_id = adminUserId` in `analytics.events`.

## Schema

**`analytics.pairing_codes`**

| Column | Type | Notes |
|--------|------|-------|
| `code` | `text` PK | 6 digits in `[2-9]`. PG `CHECK` enforces format. |
| `admin_user_id` | `text` FK → `auth.user` | Cascades on user delete. |
| `created_at` | `timestamptz` | Default now. |
| `expires_at` | `timestamptz` | 10 minutes after creation. |
| `consumed_at` | `timestamptz` | Null until claimed. |
| `consumed_by_session_id` | `text` FK → `sessions` | Set null on session delete. |
| `attempt_count` | `integer` | Incremented on every claim attempt. PG `CHECK` ≤ 5. |

**`analytics.events`** — `debug_owner_id text` nullable column, with partial index `(debug_owner_id, id) WHERE debug_owner_id IS NOT NULL`.

**`analytics.sessions`** — `paired_admin_user_id text` nullable, `paired_at timestamptz` nullable. Pairing tag is cleared by the cleanup job after 2h.

## Code design

- Alphabet: `23456789` — no `0`, `1`, `O`, `I` to eliminate visual ambiguity.
- Code length: 6 digits → ~16.7M combinations, enough for the 10-minute TTL window.
- TTL: 10 minutes (unconsumed). Enforced by both the `WHERE expires_at > now` query predicate and the cleanup job.
- Attempt cap: 5 tries. Checked via a `WHERE attempt_count < 5` predicate on the atomic `UPDATE`. Subsequent reads still increment `attempt_count` against brute-force.
- Code generation retries on PK collision (up to 5 attempts), then raises.
- `claimPairingCode()` is a single `UPDATE ... RETURNING` — atomic, no TOCTOU gap.

## Cookie

Name: `v10r_debug_owner`  
Attributes: `HttpOnly; Secure; SameSite=Lax; Max-Age=7200` (2h)

Value format: `${adminUserId}.${expiresAtMs}.${hmacHex}`

- Payload signed with HMAC-SHA256, keyed by `PAIRING_SECRET` env var.
- Key imported once via Web Crypto `subtle.importKey`, then cached in module scope.
- Verification uses a constant-time byte comparison (`timingSafeEqual`).
- `debugOwnerLoader` in `hooks.server.ts` verifies the cookie on every request. If verification fails or the cookie is expired, the cookie is cleared and `event.locals.debugOwnerId` is set to `null`. Failures are caught silently (e.g. missing `PAIRING_SECRET`) — the hook fails closed without crashing.

## Hook chain position

```
... → csrfProtection → consentLoader → debugOwnerLoader → routeGuard → analyticsCollector
```

`debugOwnerLoader` runs after `consentLoader` (consent tier is available) and before `routeGuard` (admin pages also get a populated `debugOwnerId`). `analyticsCollector` reads `event.locals.debugOwnerId` and passes it to `recordEvent()` / `upsertSession()`.

## Cleanup

`analyticsCleanup()` at `src/lib/server/jobs/analytics-cleanup.ts` handles three sweeps on each run:

| Target | Condition | Retention |
|--------|-----------|-----------|
| Unconsumed pairing codes | `consumed_at IS NULL AND expires_at < now - 1h` | 1h grace after expiry |
| Consumed pairing codes | `consumed_at < now - 7d` | 7 days |
| Paired session tags | `paired_at IS NOT NULL AND paired_at < now - 2h` | 2h hard cap — clears `paired_admin_user_id` + `paired_at` |

The 2h session cap is a privacy guardrail: admin re-pairs if longer coverage is needed.

## Threat model and limits

| Concern | Mitigation |
|---------|-----------|
| Code brute-force | 5-attempt cap + 10-min TTL; cap enforced at DB level (PG CHECK) |
| Stale attribution | 2h hard cap; cleanup job untags sessions automatically |
| Admin revokes pairing | `revokePairing()` marks code consumed, untags all sessions for that admin |
| Phone self-disconnects | `DELETE /api/pair/disconnect` clears `v10r_debug_owner` cookie; future requests fail HMAC |
| Forged cookie | HMAC-SHA256 + constant-time compare; missing/wrong `PAIRING_SECRET` fails closed |
| Admin sees other users' events | Live feed filters on `debug_owner_id = adminUserId` — only the paired phone's events |

## Required environment variable

```
PAIRING_SECRET=<≥32 random bytes, base64-encoded>
```

Generate with:
```sh
openssl rand -base64 32
```

Missing `PAIRING_SECRET` disables the pairing feature (cookie verification throws; `debugOwnerLoader` catches and sets `debugOwnerId = null`). No crash, no pairing.
