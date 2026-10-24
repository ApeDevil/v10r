---
title: "Service-worker caching contract (HTML network-only, kill switch)"
description: "The custom service worker precaches only the icons and the offline page's own assets (parsed from its HTML), fills the rest of the hashed build cache-first as…"
category: "PWA"
---

# Service-worker caching contract (HTML network-only, kill switch)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** PWA · **Tier:** light · **Maturity:** proven (verified 2026-10-10 @ 149f43a7-dirty) · **Risk:** medium — touches deploy config and can affect every installed client if misconfigured

The custom service worker precaches only the icons and the offline page's own assets (parsed from its HTML), fills the rest of the hashed build cache-first as it is used, serves HTML and __data.json network-only, never intercepts /api/* or SSE, and ships a kill switch that force-wipes caches and unregisters on a bad deploy.

**When to use:** Use when you need an installable offline shell without caching personalized HTML, plus a documented recovery path for a broken worker.

## Avoid when

- Unvisited routes must work fully offline — precaching only the offline shell leaves them to the offline page

## Docs

- [docs/blueprint/pwa.md](/docs/blueprint/pwa) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/pwa.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/pwa.md))

## Code

- `src/service-worker/index.ts` — built on $app/manifest, $app/service-worker and $app/env (SvelteKit 3); its own tsconfig carries the WebWorker types ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/service-worker/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/service-worker/index.ts))
- `src/lib/pwa/sw-policy.ts` — offlineShellAssets: what install precaches ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/pwa/sw-policy.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/pwa/sw-policy.ts))

## Tests

- `src/lib/pwa/sw-policy.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/pwa/sw-policy.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/pwa/sw-policy.test.ts))

## Proof

- [`/showcases/pwa`](/showcases/pwa)

---

_Machine-readable record: `pwa-service-worker` in `pattern-library/registry.json`._
