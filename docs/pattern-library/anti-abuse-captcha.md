---
title: "ALTCHA proof-of-work captcha"
description: "A self-hosted proof-of-work captcha where the client solves a CPU-bound puzzle and the server verifies an HMAC-signed payload via altcha-lib."
category: "Anti-Abuse"
---

# ALTCHA proof-of-work captcha

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Anti-Abuse · **Tier:** light · **Risk:** medium — bot/abuse defense; misconfiguration or kill-switch misuse weakens protection

A self-hosted proof-of-work captcha where the client solves a CPU-bound puzzle and the server verifies an HMAC-signed payload via altcha-lib.

**When to use:** Reach for it on public forms that need bot resistance without third-party captcha services or extra user interaction.

## Docs

- [docs/blueprint/abuse/captcha.md](/docs/blueprint/abuse/captcha) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/captcha.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/captcha.md))

## Code

- `src/lib/server/abuse/altcha.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/abuse/altcha.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/abuse/altcha.ts))
- `src/lib/components/composites/altcha/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/composites/altcha) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/composites/altcha))

## Proof

- [`/showcases/abuse/captcha`](/showcases/abuse/captcha)

---

_Machine-readable record: `anti-abuse-captcha` in `mcp/patterns.registry.json`._
