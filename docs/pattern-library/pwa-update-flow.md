---
title: "Update flow"
description: "A pending service-worker update rides the next client-side navigation silently, or for navigation-less sessions surfaces one persistent reload toast after 30…"
category: "PWA"
---

# Update flow

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** PWA · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — UI prompt only, no forced reload

A pending service-worker update rides the next client-side navigation silently, or for navigation-less sessions surfaces one persistent reload toast after 30 minutes, and never auto-activates with skipWaiting().

**When to use:** Use when rolling out a new service-worker version without disrupting an in-progress user session.

**Needs:** required service-worker

## Docs

- [docs/blueprint/pwa.md](/docs/blueprint/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pwa.md))

## Code

- `src/lib/components/shell/UpdatePrompt.svelte` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/shell/UpdatePrompt.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/shell/UpdatePrompt.svelte))

## Proof

- [`/showcases/pwa`](/showcases/pwa)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Service-worker caching contract](/docs/pattern-library/service-worker-caching) — The update flow governs a service worker that is already installed.

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `pwa-update-flow` in `pattern-library/registry.json`._
