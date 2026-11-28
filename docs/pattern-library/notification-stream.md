---
title: "In-app SSE stream & notification center"
description: "One SSE route serves notifications in real time over two transports: an in-memory connection map on a persistent host, Redis pub/sub on Vercel serverless; the…"
category: "Notifications"
---

# In-app SSE stream & notification center

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Notifications · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — same-origin authenticated stream, connection-limited

One SSE route serves notifications in real time over two transports: an in-memory connection map on a persistent host, Redis pub/sub on Vercel serverless; the account pages re-run their load via invalidate() instead of holding a stream open.

**When to use:** Use when the UI needs near-real-time in-app notification delivery without standing up a third-party pub/sub service.

**Needs:** required relational-db · conditional key-value-store (when the host is serverless, where pub/sub replaces the in-memory connection map)

## Docs

- [docs/blueprint/app-shell/notifications.md](/docs/blueprint/app-shell/notifications) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/app-shell/notifications.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/app-shell/notifications.md))
- [docs/blueprint/analytics/activation.md](/docs/blueprint/analytics/activation) — Live events feed — An unauthenticated, self-limiting SSE stream at /api/analytics/stream pushes live event-style updates for the showcase demo, using synthetic rather than production data. Use as a template for a rate-limited public SSE endpoint that streams live-looking activity without exposing real user data. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/analytics/activation.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/analytics/activation.md))

## Code

- `src/lib/server/notifications/stream.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/notifications/stream.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/notifications/stream.ts))
- `src/routes/api/notifications/stream/+server.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/notifications/stream/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/notifications/stream/+server.ts))
- `src/lib/server/analytics/` — Live events feed ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/analytics))
- `src/routes/api/analytics/` — Live events feed ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/routes/api/analytics) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/routes/api/analytics))

## Proof

- [`/showcases/notifications/send`](/showcases/notifications/send)
- [`/showcases/analytics/live`](/showcases/analytics/live) — Live events feed

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Notification router, outbox and delivery worker](/docs/pattern-library/notification-outbox) (optional)


---

_Machine-readable record: `notification-stream` in `pattern-library/registry.json`._
