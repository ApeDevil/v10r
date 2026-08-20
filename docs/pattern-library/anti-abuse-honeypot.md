---
title: "Honeypot (hidden field + min fill time)"
description: "A no-interaction bot check combining a hidden form field bots tend to fill with a minimum elapsed-time threshold between render and submit."
category: "Anti-Abuse"
---

# Honeypot (hidden field + min fill time)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Anti-Abuse · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — abuse-prevention layer; bypass reduces spam defense

A no-interaction bot check combining a hidden form field bots tend to fill with a minimum elapsed-time threshold between render and submit.

**When to use:** Use on forms where adding a visible captcha would hurt conversion but basic bot filtering is still needed.

## Docs

- [docs/blueprint/abuse/honeypot.md](/docs/blueprint/abuse/honeypot) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/honeypot.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/honeypot.md))

## Code

- `src/lib/server/abuse/honeypot.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/abuse/honeypot.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/abuse/honeypot.ts))

## Proof

- [`/showcases/abuse/honeypot`](/showcases/abuse/honeypot)

---

_Machine-readable record: `anti-abuse-honeypot` in `mcp/patterns.registry.json`._
