---
name: False positive patterns — Velociraptor
description: Modules that look dead but are intentionally inactive or framework-required
type: project
---

## analyticsCollector (src/lib/server/analytics/hook.ts)

The `analyticsCollector` Handle export is intentionally NOT wired into `hooks.server.ts` sequence. The module's own comment says "Wire into hooks.server.ts sequence when switching from synthetic to live data." It is opt-in by design, not dead code.

**Why:** The analytics system uses synthetic/seeded data for showcases; the live collector is staged for later activation.

**How to apply:** Do not flag this as dead code. Flag only if the comment is removed and the hook still isn't wired.

## knip ignore list patterns

The following paths are in `knip.config.ts` ignore list because they're consumed through import chains Knip can't trace through the Svelte compiler:
- `src/lib/components/viz/**` — consumed via Svelte templates, barrel re-exports
- `src/lib/server/analytics/hook.ts` and `index.ts` — opt-in hooks
- `src/lib/server/api/pagination.ts` and `sse.ts` — consumed via multi-client patterns
- `src/lib/server/db/analytics/graph-seed.ts`, `mutations.ts` — used by scripts/admin routes
- `src/lib/server/db/rag/setup.ts` — used by setup scripts
- `src/lib/server/db/schema/core.ts` — explicitly ignored (re-exports subsets already in schema/index.ts)
- `src/lib/schemas/style.ts` — consumed via chain Knip misses
- `src/lib/server/branding/types.ts` — consumed via chain

## Drizzle relations exports

All `*Relations` exports in schema files (matched by `ignoreMembers: ['.*Relations$']`) are consumed by the Drizzle ORM at runtime via `{ ...schema, ...relations }` spread. Never flag these as dead.

## pgEnum / pgSchema exports

All `pgEnum()` and `pgTable()` exports in `src/lib/server/db/schema/**` must be exported even if no TypeScript code imports them — `drizzle-kit push` reads them directly.

## seed-silly.ts script

`scripts/seed-silly.ts` has no package.json script entry but is a manual CLI tool run via `podman exec`. Not dead — it's a retrieval canary.
