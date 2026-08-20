---
title: "Router, outbox & delivery worker"
description: "NotificationService.send() writes an in-app record, evaluates the settings matrix per channel, then queues outbox rows delivered by an in-process worker on…"
category: "Notifications"
---

# Router, outbox & delivery worker

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — internal queue/dispatch, no direct external call from the router itself

NotificationService.send() writes an in-app record, evaluates the settings matrix per channel, then queues outbox rows delivered by an in-process worker on containers or a cron sweep on Vercel.

**When to use:** Use as the single entry point for sending any multi-channel notification instead of calling a channel provider directly.

## Docs

- [docs/blueprint/notifications/routing.md](/docs/blueprint/notifications/routing) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/routing.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/routing.md))

## Code

- `src/lib/server/notifications/router.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/router.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/router.ts))
- `src/lib/server/notifications/outbox.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/outbox.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/outbox.ts))

## Proof

- [`/showcases/notifications/pipeline`](/showcases/notifications/pipeline)

---

_Machine-readable record: `notifications-router-outbox` in `mcp/patterns.registry.json`._
