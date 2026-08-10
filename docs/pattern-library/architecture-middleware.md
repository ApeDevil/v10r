---
title: "Middleware / 14-stage hook chain (CSRF, headers, guards)"
description: "Describes the ordered SvelteKit hook chain in src/hooks.server.ts — security headers, i18n, auth, CSRF, session, consent, and guards — as the single source of…"
category: "Architecture & Request Pipeline"
---

# Middleware / 14-stage hook chain (CSRF, headers, guards)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Risk:** low — structural pattern, no external services

Describes the ordered SvelteKit hook chain in src/hooks.server.ts — security headers, i18n, auth, CSRF, session, consent, and guards — as the single source of truth for request interception.

**When to use:** Reach for it when adding or reordering cross-cutting request handling such as auth, CSRF, or security headers.

## Docs

- [docs/blueprint/middleware.md](/docs/blueprint/middleware) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/middleware.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/middleware.md))

## Code

- `src/hooks.server.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/hooks.server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/hooks.server.ts))
- `src/lib/server/security/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/security) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/security))

---

_Machine-readable record: `architecture-middleware` in `mcp/patterns.registry.json`._
