---
title: "Channel providers (email · Telegram · Discord)"
description: "Email (Resend), Telegram (bot API), and Discord (OAuth2) each implement a common provider interface (send/validateConnection/getProviderName) behind their own…"
category: "Notifications"
---

# Channel providers (email · Telegram · Discord)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Notifications · **Tier:** light · **Risk:** low — outbound sends only, credentials encrypted at rest

Email (Resend), Telegram (bot API), and Discord (OAuth2) each implement a common provider interface (send/validateConnection/getProviderName) behind their own connection and token-management flow.

**When to use:** Use when adding or maintaining an outbound notification channel that must plug into the shared router and outbox.

## Docs

- [docs/blueprint/notifications/channels.md](/docs/blueprint/notifications/channels) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/notifications/channels.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/notifications/channels.md))
- `docs/stack/notifications/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/docs/stack/notifications) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/docs/stack/notifications))

## Code

- `src/lib/server/notifications/providers/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/notifications/providers) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/notifications/providers))

## Proof

- [`/showcases/notifications/channels`](/showcases/notifications/channels)

---

_Machine-readable record: `notifications-channels` in `mcp/patterns.registry.json`._
