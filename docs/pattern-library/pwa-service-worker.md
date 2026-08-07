---
title: "Service-worker caching contract (HTML network-only, kill switch)"
description: "The custom service worker precaches the hashed build and icons, serves HTML and __data.json network-only while never intercepting /api/* or SSE, and ships a…"
category: "PWA"
---

# Service-worker caching contract (HTML network-only, kill switch)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** PWA · **Tier:** light · **Risk:** medium — touches deploy config and can affect every installed client if misconfigured

The custom service worker precaches the hashed build and icons, serves HTML and __data.json network-only while never intercepting /api/* or SSE, and ships a kill switch that force-wipes caches and unregisters on a bad deploy.

**When to use:** Use when you need an installable offline shell without caching personalized HTML, plus a documented recovery path for a broken worker.

## Docs

- [docs/blueprint/pwa.md](/docs/blueprint/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pwa.md))

## Code

- `src/service-worker.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/service-worker.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/service-worker.ts))

## Proof

- [`/showcases/pwa`](/showcases/pwa)

---

_Machine-readable record: `pwa-service-worker` in `mcp/patterns.registry.json`._
