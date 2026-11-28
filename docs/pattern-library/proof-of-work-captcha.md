---
title: "ALTCHA proof-of-work captcha"
description: "A self-hosted proof-of-work captcha where the client solves a CPU-bound puzzle and the server verifies an HMAC-signed payload via altcha-lib."
category: "Anti-Abuse"
---

# ALTCHA proof-of-work captcha

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Anti-Abuse · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — bot/abuse defense; misconfiguration or kill-switch misuse weakens protection

A self-hosted proof-of-work captcha where the client solves a CPU-bound puzzle and the server verifies an HMAC-signed payload via altcha-lib.

**When to use:** Reach for it on public forms that need bot resistance without third-party captcha services or extra user interaction.

**Needs:** conditional key-value-store (when solved challenges must be refused on replay across instances)

## Docs

- [docs/blueprint/abuse/captcha.md](/docs/blueprint/abuse/captcha) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/captcha.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/captcha.md))

## Code

- `src/lib/server/abuse/altcha.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/abuse/altcha.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/abuse/altcha.ts))
- `src/lib/components/composites/altcha/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/altcha) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/altcha))

## Proof

- [`/showcases/abuse/captcha`](/showcases/abuse/captcha)

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.
- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.

**Referenced by**

- [Bot decision & abuse audit](/docs/pattern-library/bot-decision-audit)


---

_Machine-readable record: `proof-of-work-captcha` in `pattern-library/registry.json`._
