---
name: v10r-identity-safety
description: "v10r reference patterns for Identity & Safety in SvelteKit + TypeScript apps (Identity & Access; Anti-Abuse; Admin & Privacy). Use when designing, building or reviewing: magic link, oauth sign-in, authorization guards, capability grants, passkeys, proof-of-work, hidden field trap, sliding window, token budget, decision aggregation, route guards, data aggregation, consent state, scheduled purge, pairing code, audit log, key rotation — before writing it from scratch, read the matching pattern's contraindications, invariants and emulation notes. 17 patterns, 1 with full emulation cards."
license: MIT
metadata:
  source: "v10r pattern-library registry"
  registry-digest: "645006606b7c9657"
  generated: "true"
---

# v10r Identity & Safety patterns

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

## When to use

Use this agent skill when a task in a SvelteKit + TypeScript project touches Identity & Access, Anti-Abuse, Admin & Privacy and a proven reference implementation would beat inventing one. v10r is a pattern library for *emulation*, not cloning: adapt the shape and keep the invariants; do not copy files wholesale.

To choose among patterns across groups, or to order several, use the `v10r-architecture-selection` agent skill first.

## Method

1. Find the candidate in the index below. Bold, linked rows are deep cards; the rest are index rows.
2. Fitness first: read its *Avoid when* and *Alternatives*. If the target matches a contraindication, or a simpler alternative fits, stop here — the smallest thing that works wins.
3. Check *Needs* against the target project's infrastructure, and the reference's *Relationships*: what it *builds on* (build or map first), what it *composes* (required, conditional or optional constituents) and what it *specializes* (inherited invariants, never built twice).
4. Deep card: open `references/<id>.md`. Every *Invariant* MUST still hold after you adapt it; the *Emulation notes* say what to change for a new project. Read the linked docs and code on GitHub when you need the real implementation.
5. Index row (no reference file): its docs page is `https://github.com/ApeDevil/v10r/blob/main/docs/pattern-library/<id>.md` — pointers to docs, code and proof, but no recorded invariants, so treat it as orientation, not a contract.
6. When the v10r Pattern MCP is connected (`https://www.v10r.dev/api/mcp/public`, or the local stdio server), `get_pattern {ids, sections}` returns the live card and `get_file_excerpt` the cited code; prefer it over these generated copies.

Maturity is evidence, not opinion: **proven** = a linked test or showcase, verified at a recorded date; **implemented** = the code exists but no proof surface is linked; **planned** = design only. Treat implemented and planned rows as unverified.

## Pattern index

### Identity & Access

- Passwordless auth (`passwordless-auth`, proven) — Session-based authentication through Better Auth using a magic link and OTP code sent together in…
- OAuth sign-in (`oauth-sign-in`, proven) — Sign-in via OAuth 2.0 providers, GitHub and Google, wired through Better Auth's built-in OAuth…
- Route guards & per-route authorization (`route-guards`, proven) — Server-side guard functions that check a user's capability grants or admin status before allowing…
- Grant requests (`grant-requests`, proven) — A request-approve-expire workflow where users request a named capability, an admin approves or…
- Passkeys & step-up TOTP (`passkeys`, proven) — WebAuthn passkeys serve as a phishing-resistant first-factor sign-in credential, while TOTP is…

### Anti-Abuse

- ALTCHA proof-of-work captcha (`proof-of-work-captcha`, proven) — A self-hosted proof-of-work captcha where the client solves a CPU-bound puzzle and the server…
- Honeypot (`honeypot`, proven) — A no-interaction bot check combining a hidden form field bots tend to fill with a minimum…
- Rate limiting (`rate-limiting`, proven) — A sliding-window rate limiter factory backed by Upstash Redis that produces per-purpose limiters…
- AI daily token budget (`ai-token-budget`, proven) — A per-user daily token cap stored in Redis that prevents a single authenticated user from…
- Bot decision & abuse audit (`bot-decision-audit`, proven) — A shared Decision type and audit trail that lets the anti-abuse layers (captcha, honeypot, rate…

### Admin & Privacy

- Admin area, guards & data-table pattern (`admin-area`, proven) — The overall admin area architecture — a vertical sidebar, route guards, and a canonical data-table…
- GDPR data rights (`gdpr-data-rights`, proven) — A privacy aggregator that collects everything the app knows about a user into one report, backing…
- Consent & cookies (`consent-cookies`, proven) — Client-side consent state and a consent banner component that gate any cookie or storage write…
- Data retention policy & purge jobs (`data-retention`, proven) — Scheduled jobs that enforce data-retention policy by purging stale records on a fixed cadence…
- Cross-device debug pairing (`debug-pairing`, proven) — A short-lived, single-use pairing code and QR flow that attributes a phone's anonymous pageviews…
- Audit log (`audit-log`, proven) — An append-only audit trail of privileged admin actions — who did what to which record, when …
- **[Encryption key ring](references/encryption-key-ring.md)** (proven · needs required relational-db, scheduler) — Stored credentials are AES-256-GCM envelopes that name the key sealing them (a derived key id), opened by a ring of current and previous…
  - Use when the app stores third-party credentials or other secrets encrypted under a deployment key that must be rotatable.
  - Avoid when: The secrets can live in a managed KMS or secret store that does the envelope encryption and rotation for you
