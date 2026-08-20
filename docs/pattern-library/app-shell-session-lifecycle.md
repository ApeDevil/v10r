---
title: "Session lifecycle UI (expiry, re-auth)"
description: "Shell-level UI that reacts to authentication session state — showing an expiry warning, a re-authentication modal on expiry, and immediate redirect on…"
category: "App Shell & Navigation"
---

# Session lifecycle UI (expiry, re-auth)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Shell-level UI that reacts to authentication session state — showing an expiry warning, a re-authentication modal on expiry, and immediate redirect on revocation.

**When to use:** Reach for it when handling session expiry warnings or re-authentication prompts inside the app shell.

## Docs

- [docs/blueprint/app-shell/session-lifecycle.md](/docs/blueprint/app-shell/session-lifecycle) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/session-lifecycle.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/session-lifecycle.md))

## Code

- `src/lib/components/shell/session/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/shell/session) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/shell/session))
- `src/lib/state/session.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/session.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/session.svelte.ts))

## Proof

- [`/showcases/shell/session`](/showcases/shell/session)

---

_Machine-readable record: `app-shell-session-lifecycle` in `mcp/patterns.registry.json`._
