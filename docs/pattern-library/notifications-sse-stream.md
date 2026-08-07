---
title: "In-app SSE stream & notification center"
description: "A container-mode in-memory connection map pushes notifications over SSE in real time (falling back to invalidate()-based polling on Vercel serverless) and…"
category: "Notifications"
---

# In-app SSE stream & notification center

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Notifications · **Tier:** light · **Risk:** low — same-origin authenticated stream, connection-limited

A container-mode in-memory connection map pushes notifications over SSE in real time (falling back to invalidate()-based polling on Vercel serverless) and feeds a Svelte 5 runes notification-center state.

**When to use:** Use when the UI needs near-real-time in-app notification delivery without standing up a third-party pub/sub service.

## Docs

- [docs/blueprint/app-shell/notifications.md](/docs/blueprint/app-shell/notifications) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/notifications.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/notifications.md))

## Code

- `src/lib/server/notifications/stream.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/stream.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/stream.ts))
- `src/lib/state/notifications.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/notifications.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/notifications.svelte.ts))

## Proof

- [`/showcases/notifications/send`](/showcases/notifications/send)

---

_Machine-readable record: `notifications-sse-stream` in `mcp/patterns.registry.json`._
