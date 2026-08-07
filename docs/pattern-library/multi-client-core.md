---
title: "Multi-client core (hexagonal domain modules)"
description: "One backend operations layer ($lib/server/[domain]/) serves four clients — human UI, AI tools, REST API, background jobs — via thin wrappers, with zero…"
category: "Architecture & Request Pipeline"
---

# Multi-client core (hexagonal domain modules)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Risk:** low — structural pattern, no external services

One backend operations layer ($lib/server/[domain]/) serves four clients — human UI, AI tools, REST API, background jobs — via thin wrappers, with zero duplicated business logic.

**When to use:** Reach for this whenever a backend capability must be reachable from more than one entry point (page action, API route, AI tool, cron job). It is the foundation nearly every other v10r pattern builds on.

## Docs

- [docs/blueprint/architecture/multi-client-core.md](/docs/blueprint/architecture/multi-client-core) — The full pattern: canonical module shape, client wiring, error contract ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/multi-client-core.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/multi-client-core.md))
- [docs/system-abstraction.md](/docs/system-abstraction) — Runtime 7-layer view showing where domain modules sit ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/system-abstraction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/system-abstraction.md))
- [docs/codebase-organization.md](/docs/codebase-organization) — Where each piece lives; import direction rules ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/codebase-organization.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/codebase-organization.md))

## Code

- `src/lib/server/` — Per-domain modules; canonical shape is [domain]/queries.ts + mutations.ts (+ service.ts only when orchestration spans multiple infra calls) ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server))

## Invariants

- Domain functions must not import from @sveltejs/kit or $app/ — binding to the request cycle breaks tool and job reuse.
- AI tools RETURN structured errors — never throw.
- The tool manifest is fail-closed: if a tool is not in the manifest, the AI cannot call it; AI tools get a narrower permission set than the human UI.
- Tools capture userId by closure — a tool never sees an unauthenticated call.

## Emulation notes

- Start every new project with this shape even if only one client exists yet — the second client (AI tool or cron) always arrives.
- Keep adapters thin: a +page.server.ts action or +server.ts route should validate input, call one domain function, map the result.

---

_Machine-readable record: `multi-client-core` in `mcp/patterns.registry.json`._
