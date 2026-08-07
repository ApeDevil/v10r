---
title: "Bot decision & abuse audit"
description: "A shared Decision type and audit trail that lets the anti-abuse layers (captcha, honeypot, rate limits) record and explain their bot/allow decisions…"
category: "Anti-Abuse"
---

# Bot decision & abuse audit

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Anti-Abuse · **Tier:** light · **Risk:** medium — central point for abuse-signal correctness and auditability

A shared Decision type and audit trail that lets the anti-abuse layers (captcha, honeypot, rate limits) record and explain their bot/allow decisions consistently.

**When to use:** Use when a new abuse-detection signal needs to plug into the shared decision and audit-logging pipeline.

## Docs

- `docs/blueprint/abuse/README.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/abuse/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/abuse/README.md))

## Code

- `src/lib/server/abuse/decision.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/abuse/decision.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/abuse/decision.ts))
- `src/lib/server/abuse/audit.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/abuse/audit.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/abuse/audit.ts))

## Proof

- [`/showcases/abuse`](/showcases/abuse)

---

_Machine-readable record: `anti-abuse-bot-decision-audit` in `mcp/patterns.registry.json`._
