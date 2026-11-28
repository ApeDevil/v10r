---
title: "Notification router, outbox and delivery worker"
description: "sendNotification() writes an in-app record, evaluates the settings matrix per channel, then queues outbox rows delivered by an in-process worker on containers…"
category: "Notifications"
---

# Notification router, outbox and delivery worker

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — internal queue/dispatch, no direct external call from the router itself

sendNotification() writes an in-app record, evaluates the settings matrix per channel, then queues outbox rows delivered by an in-process worker on containers or a cron sweep on Vercel.

**When to use:** Use as the single entry point for sending any multi-channel notification instead of calling a channel provider directly.

**Needs:** required relational-db · conditional scheduler (when the host has no persistent process to run the delivery worker (serverless: a cron sweep drains the outbox))

## Docs

- [docs/blueprint/notifications/routing.md](/docs/blueprint/notifications/routing) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/routing.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/routing.md))
- [docs/blueprint/notifications/schema.md](/docs/blueprint/notifications/schema) — Schema & delivery log — The multi-channel schema adds per-user channel-connection tables, verification tokens, and push subscriptions, plus a notification_deliveries table logging per-channel send status. Use as the reference schema when modeling a new channel connection or auditing delivery outcomes. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/schema.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/schema.md))

## Code

- `src/lib/server/notifications/router.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/router.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/router.ts))
- `src/lib/server/notifications/outbox.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/outbox.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/outbox.ts))
- `src/lib/server/db/schema/notifications/` — Schema & delivery log ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/schema/notifications) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/schema/notifications))

## Tests

- `src/lib/server/notifications/outbox.pglite.test.ts` — Schema & delivery log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/outbox.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/outbox.pglite.test.ts))
- `src/lib/server/jobs/notification-delivery.pglite.test.ts` — Schema & delivery log ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/notification-delivery.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/notification-delivery.pglite.test.ts))

## Proof

- [`/showcases/notifications/pipeline`](/showcases/notifications/pipeline)

---

_Machine-readable record: `notification-outbox` in `pattern-library/registry.json`._
