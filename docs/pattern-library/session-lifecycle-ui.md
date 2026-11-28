---
title: "Session lifecycle UI"
description: "Shell-level UI that reacts to authentication session state — showing an expiry warning, a re-authentication modal on expiry, and immediate redirect on…"
category: "App Shell & Navigation"
---

# Session lifecycle UI

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** App Shell & Navigation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — structural pattern, no external services

Shell-level UI that reacts to authentication session state — showing an expiry warning, a re-authentication modal on expiry, and immediate redirect on revocation.

**When to use:** Reach for it when handling session expiry warnings or re-authentication prompts inside the app shell.

**Needs:** required email-delivery (via passwordless-auth), relational-db (via passwordless-auth)

## Docs

- [docs/blueprint/app-shell/session-lifecycle.md](/docs/blueprint/app-shell/session-lifecycle) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/session-lifecycle.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/session-lifecycle.md))

## Code

- `src/lib/components/shell/session/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/shell/session) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/shell/session))
- `src/lib/state/session.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/session.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/session.svelte.ts))

## Proof

- [`/showcases/shell/session`](/showcases/shell/session)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Passwordless auth](/docs/pattern-library/passwordless-auth) — It reacts to the session state of the auth layer; any session-based auth satisfies it.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `session-lifecycle-ui` in `pattern-library/registry.json`._
