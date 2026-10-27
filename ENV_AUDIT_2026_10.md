# Environment configuration audit — 2026-10-27

Snapshot of the environment-variable audit on branch `claude/festive-goldberg-bw1mfd`. The live
model is `src/env.ts` (declaration), `.env.example` (tiers) and
`docs/blueprint/deployment.md#environment-variables`; this file records the evidence and the
dashboard cleanup that only the owner can do. No secret value appears here. Vercel values were
inspected only for three non-secret settings (`BETTER_AUTH_URL`, `DISCORD_REDIRECT_URI`,
`NEO4J_DATABASE`); everything else was read by name only.

## Architecture as found

- **App (SvelteKit 3 on Vercel).** `src/env.ts` declares 72 variables, all optional at the schema
  level, all private and dynamic (`$app/env/private`, read at runtime, never in a client bundle).
  Each reader decides what unset means. `architecture.gate.test.ts` ratchets which modules may read
  env. No `$app/env/public` and no `VITE_*` app config exist, so no variable can reach the browser.
- **Vercel** builds GitLab `main` only (`vercel.json` guard), so every deployment is production.
  48 variables were set (production + preview targets).
- **Render** runs `services/runtime-lab` (Rust). It already reads Render's `PORT` (default 8080),
  binds `0.0.0.0`, health check `/health/live`; one manual variable, `SERVICE_TOKEN`
  (`render.yaml`, `sync: false`). Render's dashboard was not reachable from this session.
- **GitHub Actions**: one workflow, `gitlab-sync.yml`, one secret `GITLAB_PROMOTION_TOKEN`
  (environment `gitlab-promotion`). Not CI. Unchanged.
- **Local**: `compose.yaml` loads `.env`; cloud sessions copy `.env.placeholder` to `.env`.

## What changed in the repository

| Change | Effect |
|---|---|
| `auth/site-url.ts` (new): `BETTER_AUTH_URL` defaults to `http://localhost:5173` in `dev`, throws outside `dev` | A local `.env` needs no site URL; production still fails at import without it |
| Discord redirect URI derived: `DISCORD_OAUTH_CALLBACK_PATH` on the site URL; `DISCORD_REDIRECT_URI` removed from `src/env.ts` | One origin per deployment instead of two that can drift (production's had drifted, below) |
| `VAPID_SUBJECT` defaults to the https site URL | One fewer manual value; explicit override still honoured |
| `.env.placeholder`: dropped `R2_ACCOUNT_ID`, `UPSTASH_REDIS_REST_URL` (SvelteKit 2 `$env/static` leftovers) and `BOT_DETECTION_MODE` (default `live`) | Build verified without them |
| `.env.example` rewritten in three tiers; added the four `EXTERNAL_SERVICE_*` it lacked; overrides commented out | Copying it sets only what is needed |
| `compose.yaml`: dropped `CONTAINER=1` (read by nothing) and runtime-lab `PORT=8080` (code default) | — |
| `services/runtime-lab/Containerfile`: dropped `ENV PORT=8080` (code default); manifest re-stamped by `check.sh --host` | Render behaviour unchanged: it injects `PORT` |
| Docs: deployment.md env model rewritten (removed `R2_ENDPOINT`, `CONTAINER`); auth, discord, postgres, PWA, channels, vendors pages updated | Docs match code |

## Inventory

Legend — Sens.: S secret, N non-secret. Scope: all are server-side runtime unless marked
(build = read by Vite at build time). Rec.: keep · default · derive · remove · platform.

| Variable | Purpose / consumers | Sens. | Necessity | Rec. |
|---|---|---|---|---|
| `NEON_DATABASE_URL_PROD` | DB connection — `db/index.ts`, drizzle.config, scripts | S | Required | keep |
| `BETTER_AUTH_SECRET` | Auth root + subkey root — `auth/index.ts`, `security/subkey.ts` | S | Required | keep |
| `BETTER_AUTH_URL` | Canonical site URL — `auth/index.ts` → `site-url.ts`, `web-push.ts` | N | Required in prod | keep (prod), default (dev) |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | OAuth — `auth/index.ts` | S | Required | keep |
| `ENCRYPTION_KEY` | Key ring — `security/encryption-key.ts` | S | Required | keep |
| `ENCRYPTION_KEY_PREVIOUS` | Rotation only | S | Optional | keep (rotation) |
| `ADMIN_USER_ID` | Admin gate — `auth/admin-ids.ts`, `http/guards.ts` | N | Required | keep |
| `ALTCHA_HMAC_KEY` | Captcha HMAC — `abuse/config.ts` (build asserts) | S | Required | keep |
| `BOT_DETECTION_MODE` | Abuse kill switch — `abuse/config.ts` | N | Optional (default `live`) | default |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Rate limits, replay store — `cache/client.ts` | S | Required in prod | keep |
| `CRON_SECRET` | Vercel cron bearer — `http/cron-guard.ts` | S | Required | keep |
| `ANALYTICS_VISITOR_SALT`, `ANALYTICS_CONFIRM_SECRET`, `BLOG_UPLOAD_TICKET_SECRET`, `PAIRING_SECRET` | Subkey overrides — `security/subkey.ts` | S | Optional (derived) | derive (already) |
| `NEO4J_URI/USERNAME/PASSWORD` | Graph — `graph/index.ts`, scripts | S | Feature | keep |
| `NEO4J_DATABASE` | Graph DB name (default `neo4j`) | N | Feature (Aura: instance id) | keep |
| `R2_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET_NAME` | Object store — `store/index.ts`, monitoring | S/N | Feature | keep |
| `CLOUDFLARE_ANALYTICS_TOKEN` | R2 analytics panel — `monitoring/r2.ts` | S | Feature | keep (unset on Vercel) |
| `UPSTASH_MGMT_API_KEY/EMAIL/DB_ID` | Redis monitoring — `monitoring/upstash.ts` | S/N | Feature | keep (unset on Vercel) |
| `NEON_API_KEY/PROJECT_ID/DEV_BRANCH_ID` | Branch refresh — `neon/*` | S/N | Feature | keep |
| `NEON_PARENT_BRANCH_ID` | Defaults to dev branch's parent | N | Optional | default |
| `DBOPS_AUTO_REFRESH_ENABLED` | Scheduled refresh switch (default off) | N | Optional | default |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Email + auth email — `notifications/channels/email.ts`, `auth/send-auth-email.ts` | S/N | Feature | keep |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` | Telegram channel / connect | S/N | Feature | keep |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook auth — `api/webhooks/telegram` (503 when unset) | S | Feature | keep (**missing on Vercel**) |
| `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID/SECRET` | Discord channel / OAuth | S | Feature | keep |
| `DISCORD_REDIRECT_URI` | Discord OAuth redirect | N | Redundant | **remove** (derived) |
| `VAPID_PUBLIC_KEY/PRIVATE_KEY` | Web Push keypair | N/S | Feature | keep |
| `VAPID_SUBJECT` | Web Push contact | N | Redundant in prod | default (https site URL) |
| `MCP_ADMIN_TOKEN`, `MCP_PRIVATE_TOKEN`, `MCP_SELF_TRAFFIC_TOKEN` | MCP realms, self-traffic tag | S | Feature | keep |
| `MCP_TELEMETRY_SALT` | Caller-key HMAC; must rotate and be destroyed, so not derivable | S | Feature | keep |
| `MCP_ALLOWED_ORIGINS` | Extra browser origins (default none) | N | Optional | default |
| `JOBS_DEV_ENABLED`, `ANALYTICS_DEV_TRACKING` | Dev-only gates | N | Optional | default |
| `JOB_INTERVAL_MS`, `DELIVERY_INTERVAL_MS` | Container scheduler cadence (3 h / 15 s) | N | Optional, container only | default |
| `PRIVACY_CONTACT_EMAIL` | Privacy pages (falls back to `privacy@example.com`) | N | Feature | keep (**missing on Vercel**) |
| `EXTERNAL_SERVICE_LOCAL_URL/TOKEN` | Lab local target (compose interpolates the token into the service) | S/N | Feature, local | keep |
| `EXTERNAL_SERVICE_REMOTE_URL/TOKEN` | Lab remote target (Render) | S/N | Feature | keep |
| `NODE_ENV`, `VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` (build + runtime) | Platform identity | N | Platform | platform |
| `FLY_APP_NAME`, `RAILWAY_ENVIRONMENT` | Platform detection for planned hosts | N | Platform | platform |
| runtime-lab `SERVICE_TOKEN` (+ `_PREVIOUS` during rotation) | Service credential | S | Required on Render | keep |
| runtime-lab `PORT`, `HOST` | Bind address (8080 / 0.0.0.0) | N | Platform / default | platform (Render) |
| `GITLAB_PROMOTION_TOKEN` (GitHub secret) | GitLab sync push | S | Required | keep |
| Script-only: `PLAYWRIGHT_BASE_URL`, `PERF_WRITE_SCENARIOS`, `V10R_ROOT`, `V10R_COOKIE`, `GIT_SHA`, `UPDATE_OPENAPI` | Developer tooling flags, never deployed | N | Optional | default |
| Vercel-only, unread by any code: `AURA_INSTANCEID`, `AURA_INSTANCENAME`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `NEON_DATABASE_URL_DEV` | none | S/N | Obsolete | **remove** |

Production finding: Vercel's `DISCORD_REDIRECT_URI` held `http://localhost:5173/app/notifications/settings/discord/callback`
— a local value on a route that no longer exists — so Discord linking could not work in
production. The derived value is `https://www.v10r.dev/account/notifications/settings/discord/callback`.

## Count of manually managed variables (Vercel production, no double counting)

| | Before | After |
|---|---|---|
| Vercel | 48 | 39 |
| Render | 1 (`SERVICE_TOKEN`) | 1 |
| GitHub Actions | 1 (`GITLAB_PROMOTION_TOKEN`) | 1 |
| Uncommented entries in `.env.example` (what a copied local `.env` sets) | 61 | 46 (site URL, VAPID subject and Discord redirect gone; 15 optional overrides commented out; `NEO4J_DATABASE`, `TELEGRAM_WEBHOOK_SECRET` and four lab entries added) |
| Cloud `.env.placeholder` | 11 | 8 |
| `compose.yaml` hard-coded | 4 (`NODE_ENV`, `CONTAINER`, `NODE_OPTIONS`, lab `PORT`) | 2 |

## DELETE

| Name | Location | Env | Reason | Replacement | Evidence | Status |
|---|---|---|---|---|---|---|
| `AURA_INSTANCEID` | Vercel | Prod + Preview | No reader in any code, script or config | none | repo-wide grep: 0 hits | Safe now |
| `AURA_INSTANCENAME` | Vercel | Prod + Preview | same | none | same | Safe now |
| `MICROSOFT_CLIENT_ID` | Vercel | Prod + Preview | No Microsoft provider in `auth/index.ts` | none | same | Safe now |
| `MICROSOFT_CLIENT_SECRET` | Vercel | Prod + Preview | same | none | same | Safe now |
| `NEON_DATABASE_URL_DEV` | Vercel | Prod + Preview | Not declared in `src/env.ts`, not read | none | same; docs said "not read" | Safe now |
| `DELIVERY_INTERVAL_MS` | Vercel | Prod + Preview | Read only on persistent platforms; `VERCEL` makes `platform.persistent=false` | default 15 s (container) | `platform/index.ts`, `delivery-scheduler.ts` | Safe now |
| `BOT_DETECTION_MODE` | Vercel | Prod + Preview | Default `live`; any other value fails the build, and the latest production build is READY, so the value is effectively `live` | default `live` | `abuse/config.ts` `assertProductionConfig` | Safe now |
| `DISCORD_REDIRECT_URI` | Vercel | Prod + Preview | Derived from `BETTER_AUTH_URL` | derived | removed from `src/env.ts`; current value already broken (localhost) | Delete only after successful deployment and verification |
| `VAPID_SUBJECT` | Vercel | Prod + Preview | Defaults to `https://www.v10r.dev` | derived | `resolveVapidSubject` + tests; the deployed code still requires it | Delete only after successful deployment and verification |
| `BETTER_AUTH_URL`, `DISCORD_REDIRECT_URI`, `BOT_DETECTION_MODE` | Local `.env` | Dev | Dev default / derived / default | defaults | dev server served `/api/auth/ok` 200 without `BETTER_AUTH_URL` | Safe now (local only) |
| `CONTAINER`, runtime-lab `PORT` | `compose.yaml` | Local | unread / default | — | done in repo | Done |

## KEEP (Vercel, manual)

Secrets: `NEON_DATABASE_URL_PROD`, `BETTER_AUTH_SECRET`, `GITHUB_CLIENT_SECRET`,
`GOOGLE_CLIENT_SECRET`, `ENCRYPTION_KEY`, `ALTCHA_HMAC_KEY`, `UPSTASH_REDIS_REST_TOKEN`,
`CRON_SECRET`, `NEO4J_PASSWORD`, `R2_SECRET_ACCESS_KEY`, `R2_ACCESS_KEY_ID`, `RESEND_API_KEY`,
`TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET`, `VAPID_PRIVATE_KEY`,
`MCP_ADMIN_TOKEN`, `MCP_PRIVATE_TOKEN`, `MCP_SELF_TRAFFIC_TOKEN`, `MCP_TELEMETRY_SALT`,
`NEON_API_KEY`, `EXTERNAL_SERVICE_REMOTE_TOKEN` — no code can know a secret.

Deployment config / account ids: `BETTER_AUTH_URL` (canonical origin; Vercel's production-URL
variable names the redirecting apex), `ADMIN_USER_ID`, `GITHUB_CLIENT_ID`, `GOOGLE_CLIENT_ID`,
`DISCORD_CLIENT_ID`, `UPSTASH_REDIS_REST_URL`, `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_DATABASE`
(not the default), `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `RESEND_FROM_EMAIL`,
`TELEGRAM_BOT_USERNAME`, `VAPID_PUBLIC_KEY`, `NEON_PROJECT_ID`, `NEON_DEV_BRANCH_ID`,
`EXTERNAL_SERVICE_REMOTE_URL` — each names an external account or resource.

Render: `SERVICE_TOKEN`. GitHub: `GITLAB_PROMOTION_TOKEN`.

## PLATFORM-MANAGED

`VERCEL`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA`, `NODE_ENV` (Vercel; consumed by
`platform/index.ts`, `auth/index.ts`, `mcp/server-info.ts`, `mcp/telemetry/*`, `robots.txt`,
`docs/llms-txt.ts`, `vite.config.ts`). `PORT` (Render; runtime-lab `config.rs`).

## Unverified

- Render dashboard: whether a hand-set `PORT` exists there. Docs say it was never set; the
  dashboard was not reachable. If present, delete it (the service reads Render's injected one).
- Whether Vercel's `VAPID_SUBJECT` value matters to anyone (type sensitive, unreadable). Push
  services only use it as a contact; subscriptions are bound to the keypair, not the subject.
- Discord developer portal: which redirect URIs are registered. The derived one must be listed.
- `TELEGRAM_WEBHOOK_SECRET` and `PRIVACY_CONTACT_EMAIL` are absent on Vercel: Telegram's webhook
  answers 503 and the privacy pages show `privacy@example.com`. Not deletions — gaps to fill or
  accept.
