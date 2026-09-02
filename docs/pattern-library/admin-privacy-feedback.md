---
title: "Feedback capture"
description: "A user feedback capture form protected by the honeypot bot-detection pattern to keep submissions spam-free."
category: "Admin & Privacy"
---

# Feedback capture

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Admin & Privacy · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — non-sensitive user feedback, spam is the main risk

A user feedback capture form protected by the honeypot bot-detection pattern to keep submissions spam-free.

**When to use:** Use when adding a lightweight feedback channel that needs basic spam protection without a full captcha.

## Docs

- [docs/blueprint/abuse/honeypot.md](/docs/blueprint/abuse/honeypot) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/honeypot.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/honeypot.md))

## Code

- `src/lib/server/feedback/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/feedback) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/feedback))

## Proof

- [`/feedback`](/feedback) (app route, no showcase)

---

_Machine-readable record: `admin-privacy-feedback` in `pattern-library/registry.json`._
