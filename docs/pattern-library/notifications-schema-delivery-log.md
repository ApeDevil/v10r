---
title: "Schema & delivery log"
description: "The multi-channel schema adds per-user channel-connection tables, verification tokens, and push subscriptions, plus a notification_deliveries table logging…"
category: "Notifications"
---

# Schema & delivery log

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — schema/reference only

The multi-channel schema adds per-user channel-connection tables, verification tokens, and push subscriptions, plus a notification_deliveries table logging per-channel send status.

**When to use:** Use as the reference schema when modeling a new channel connection or auditing delivery outcomes.

## Docs

- [docs/blueprint/notifications/schema.md](/docs/blueprint/notifications/schema) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/schema.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/schema.md))

## Code

- `src/lib/server/db/schema/notifications/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/db/schema/notifications) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/db/schema/notifications))

## Tests

- `src/lib/server/notifications/outbox.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/outbox.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/outbox.test.ts))
- `src/lib/server/jobs/notification-delivery.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/jobs/notification-delivery.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/jobs/notification-delivery.test.ts))

---

_Machine-readable record: `notifications-schema-delivery-log` in `mcp/patterns.registry.json`._
