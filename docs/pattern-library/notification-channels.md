---
title: "Channel providers"
description: "Email (Resend), Telegram (bot API), and Discord (OAuth2) each implement a common provider interface (send/validateConnection/getProviderName) behind their own…"
category: "Notifications"
---

# Channel providers

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — outbound sends only, credentials encrypted at rest

Email (Resend), Telegram (bot API), and Discord (OAuth2) each implement a common provider interface (send/validateConnection/getProviderName) behind their own connection and token-management flow.

**When to use:** Use when adding or maintaining an outbound notification channel that must plug into the shared router and outbox.

**Needs:** required relational-db · conditional email-delivery (when the email channel is enabled), external-api (when chat channels are enabled (Telegram bot API, Discord))

## Docs

- [docs/blueprint/notifications/channels.md](/docs/blueprint/notifications/channels) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/channels.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/channels.md))
- `docs/stack/notifications/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/docs/stack/notifications) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/docs/stack/notifications))

## Code

- `src/lib/server/notifications/channels/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/notifications/channels) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/notifications/channels))

## Proof

- [`/showcases/notifications/channels`](/showcases/notifications/channels)

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Notification router, outbox and delivery worker](/docs/pattern-library/notification-outbox) (required)


---

_Machine-readable record: `notification-channels` in `pattern-library/registry.json`._
