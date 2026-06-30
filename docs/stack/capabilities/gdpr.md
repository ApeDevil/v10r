# GDPR & Privacy

How v10r satisfies EU data-subject rights: one aggregator defines "all my data", many surfaces consume it, and consent gates anything written to the device.

## What is it?

A privacy domain (`$lib/server/privacy/`) that is the **single source of truth** for everything the app knows about a user. Every right-of-access, portability, and erasure surface calls it — so the definition of "all my data" cannot drift between them.

| Right (GDPR Article) | Surface |
|----------------------|---------|
| Access — Art 15 | `/app/account/data` page + `GET /api/me/data` |
| Portability — Art 20 | `GET /api/me/data/export` (JSON download) |
| Erasure — Art 17 | `DELETE /api/me` + account-page typed-confirmation form |
| Consent — TDDDG §25 / ePrivacy Art 5(3) | Consent banner, consent-gated analytics cookie |
| Transparency — Art 13 | Login-page "How we handle your data" link |

## The privacy aggregator

`collectUserData(userId, { currentSessionId })` returns a versioned `PersonalDataReport` — every domain that holds user data, in one object. `deleteUserData(userId)` is the matching Art 17 erasure.

Five surfaces, one definition:

- `/app/account/data` page load (streamed)
- account `exportData` form action
- `GET /api/me/data`
- `GET /api/me/data/export`
- `DELETE /api/me`

**Import direction:** the read aggregator (`report.ts` `collectUserData`) reads ONLY from `$lib/server/db` (the import sink) — never from peer domains — keeping it framework-free and reusable by any adapter (page, REST, future AI tool). The erasure mutation (`mutations.ts` `deleteUserData`) additionally imports `deleteUserGraph` from `$lib/server/graph/rag` because Postgres CASCADE cannot reach Neo4j; that is the one sanctioned cross-domain reach in this module.

### Hard rules (compliance, not style)

These are enforced in `privacy/report.ts`, not left to callers:

- **Secrets never leave the query layer.** OAuth tokens, `session.token`, and the password column are projected to presence/scope/expiry booleans at the query — the report cannot accidentally echo a credential.
- **Prior-session IPs are masked** to 2 octets (v4) / 2 groups (v6). A shared device means a historical IP can be a third party's data (Art 15(4)). The **current** session is shown raw — it is the requester's own connection.
- **Sections degrade independently.** A `settle()` wrapper makes one failed read render that section unavailable; it never 500s the whole report.
- **Per-domain legal basis + Art 20 `portable` tag.** Portability applies only to consent/contract data; the report marks which sections it covers.
- **The anonymous pre-signup analytics trail is deliberately absent.** Re-identifying a hashed `visitorId` needs a documented Art 6(4) basis that does not exist. Do not add it without one.
- **The `security` section is contract, never portable.** It reports `twoFactorEnabled` + passkey display metadata only — never a secret, backup code, public key, credential ID, or raw AAGUID. `REPORT_SCHEMA_VERSION` is bumped (`2026-06-17`) when section shape changes. Erasure needs no change: passkey/two-factor rows FK-cascade with `auth.user`.
- **The `images` section reports a `withGpsCount`.** The Image Metadata Reader treats location as opt-in (see [../../blueprint/ai/image-metadata.md](../../blueprint/ai/image-metadata.md)); the aggregator can count persisted-location records because GPS lives in a typed `gps_lat`/`gps_lng` column, never only inside a blob. Stored image derivatives are EXIF-stripped, so no GPS exists outside this opt-in column.

### Erasure is the FK cascade — plus a Neo4j sweep

`deleteUserData` removes the `auth.user` row. Every user-keyed Postgres table references it `onDelete: 'cascade'` (sessions, accounts, preferences, conversations, desk, notification links, comments, palettes, RAG documents), so the cascade IS the relational erasure. Idempotent — deleting an already-deleted user returns 204. Analytics rows are untouched: they are keyed by hashed `visitorId`, never by user id. The `feedback` table has no `userId` (anonymous by design) and is not part of the user inventory.

**Neo4j has no foreign keys**, so the cascade cannot reach it. `deleteUserData` therefore also calls `deleteUserGraph(userId)` to sweep the user's per-tenant `:Chunk` and `:Entity` nodes from the RAG graph. The sweep is **best-effort** — wrapped in try/catch so an Aura outage logs and continues rather than blocking the authoritative relational erasure. See [../../blueprint/ai/layered-rag.md](../../blueprint/ai/layered-rag.md#graph-tenancy-neo4j).

## The transparency page

`/app/account/data` is the authenticated "Your data" mirror (Art 15). SSR-only, `Cache-Control: no-store, private`.

- **Instant data** (no DB cost): cookies on the device (security-relevant values redacted to presence-only), the live IP / User-Agent / Accept-Language the server sees right now.
- **Streamed report**: `collectUserData` is returned as an unawaited promise; the page renders each section via `{#await}` as it resolves.
- Emptiness-first ordering, reveal-gated, consent-tier control, export/manage buttons. Localized en/de/ru (`app_data_*` keys).

### First-signup redirect

`app/+layout.server.ts` sends each user to `/app/account/data?welcome=1` exactly once, right after first sign-in.

The marker is `app.user_preferences.transparency_seen_at` (nullable timestamptz). `consumeTransparencyMarker()` claims it atomically with a single `INSERT … ON CONFLICT DO UPDATE … setWhere isNull … RETURNING` — exactly-once and prefetch-safe, so a SvelteKit prefetch racing a navigation cannot trigger the redirect twice. The gate self-excludes the target path (the page consumes the marker on a direct first visit). Every other nav pays only a cheap PK read.

The marker column is declared in the schema SSOT (`app/user-preferences.ts`). It was first applied to the live DB by running the additive `ALTER TABLE … ADD COLUMN IF NOT EXISTS` directly through the `neon()` driver rather than `db:push`, because drizzle-kit's interactive `nullsNotDistinct` re-prompt can't be piped — a fresh `db:push` reproduces the column from the schema either way.

## Consent-gated analytics cookie

The `_v10r_sid` analytics session cookie writes to terminal equipment and is not strictly necessary, so under **TDDDG §25 / ePrivacy Art 5(3)** it requires prior consent.

`analytics/hook.ts` enforces this:

- At `analytics` tier or higher → set/read the `_v10r_sid` cookie as before.
- At `necessary` tier (or no consent) → touch no cookie, actively delete a stale one from a prior grant, and derive the session id with `deriveCookielessSessionId(visitorId)` = `hash(visitorId + UTC day)` (Plausible/Fathom pattern, rotates at UTC midnight).

Session counting still works without writing to the device — page views within one UTC day group into one session.

## Stack advantages

| Component | Benefit |
|-----------|---------|
| Better Auth | Self-hosted FK cascade IS the erasure; no external deletion request |
| Drizzle | One typed query layer; secret columns projected out at the query |
| Neon | EU region available |
| Cookieless fallback | Analytics works at `necessary` tier with nothing on the device |

## Known limitations

- **AI conversations** are counted in the report (count + token total) but not yet individually exportable or selectively deletable; full erasure removes them via cascade.
- **Backups** must eventually purge deleted data — out of scope for the in-app cascade.
- **Vendor DPAs / SCCs** (AI providers, Neon, R2) are an operational obligation, not enforced in code. See [../vendors.md](../vendors.md).

## Related

- [../../foundation/user-data.md](../../foundation/user-data.md) - Data category definitions
- [../../codebase-organization.md](../../codebase-organization.md) - `privacy/` domain location, `api/me/` group
- [../../system-abstraction.md](../../system-abstraction.md) - privacy as a multi-client core (one aggregator, five surfaces)
- [../../blueprint/analytics/activation.md](../../blueprint/analytics/activation.md) - analyticsCollector consent gating
- [../auth/better-auth.md](../auth/better-auth.md) - user-data ownership and cascade
