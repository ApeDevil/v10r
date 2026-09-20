---
title: "In-app SSE stream & notification center"
description: "One SSE route serves notifications in real time over two transports: an in-memory connection map on a persistent host, Redis pub/sub on Vercel serverless; the…"
category: "Notifications"
---

# In-app SSE stream & notification center

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — same-origin authenticated stream, connection-limited

One SSE route serves notifications in real time over two transports: an in-memory connection map on a persistent host, Redis pub/sub on Vercel serverless; the account pages re-run their load via invalidate() instead of holding a stream open.

**When to use:** Use when the UI needs near-real-time in-app notification delivery without standing up a third-party pub/sub service.

## Docs

- [docs/blueprint/app-shell/notifications.md](/docs/blueprint/app-shell/notifications) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/notifications.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/notifications.md))

## Code

- `src/lib/server/notifications/stream.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/stream.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/stream.ts))
- `src/routes/api/notifications/stream/+server.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/notifications/stream/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/notifications/stream/+server.ts))

## Proof

- [`/showcases/notifications/send`](/showcases/notifications/send)

---

_Machine-readable record: `notifications-sse-stream` in `pattern-library/registry.json`._
