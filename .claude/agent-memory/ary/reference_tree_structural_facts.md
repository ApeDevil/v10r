---
name: tree-structural-facts
description: Hard-won non-obvious spatial facts about the v10r source tree (db parallel-tree, barrel boundaries, route groups, naming) — verify before citing, may drift.
metadata:
  type: reference
---

Non-obvious structural facts confirmed by reading the tree (May 2026). Each is a claim about that point in time — re-verify a specific path before acting on it.

**db parallel-tree** (`src/lib/server/db/`): two co-located trees under one module.
- `db/schema/[domain]/` = table definitions (12 domains: admin, ai, analytics, app, auth, blog, desk, feedback, jobs, notifications, rag, showcase). Re-exported by `db/schema/index.ts`.
- `db/[domain]/` = data access (`queries.ts` / `mutations.ts` + variants like `admin-queries.ts`, `io-log-queries.ts`). Data-access domains DON'T 1:1 match schema domains (e.g. `db/user/`, `db/brand/`, `db/preferences/` all map to `schema/app/`; schema has `blog/feedback/jobs/auth/admin` with no matching `db/` access dir — those domains query via `$lib/server/[domain]/` directly or read tables inline).
- Relations live at `db/schema/relations.ts` (NOT `db/relations.ts` as the drizzle skill claims — skill is stale; tree is self-consistent).
- `db/shared/folder-tree.ts` = cross-domain shared helper. `db/jobs/` contains ONLY `jobs.test.ts` (orphan test folder, no production code).

**Component barrel boundary**: `$lib/components/index.ts` re-exports ONLY composites + layout + primitives. `viz/` and `shell/` excluded by design (bundle-size: Chart.js/Three.js/d3 + app chrome). `composites/index.ts` ALSO excludes `chatbot/` and `info-dialog/` (markdown-sanitizer graph). Excluded surfaces must be deep-imported (`$lib/components/viz`, `$lib/components/shell`, `$lib/components/composites/chatbot`).

**Route groups** under `src/routes/[[locale=locale]]/`: `(public)/`, `(dev)/`, plus plain dirs `admin/`, `app/` (the "member" area — NOT a group, NOT named `(member)`), `auth/`, `desk/`, `pair/[code]`. Parallel un-localized `src/routes/api/` tree + SEO routes `robots.txt/` + `sitemap.xml/`.

**Route-local private folders**: `_components/`, `_sections/` (underscore-prefixed = SvelteKit ignores as routes). Used heavily in showcases (e.g. `showcases/ui/components/_sections/`, `showcases/ai/retrieval/rag-chat/_components/{rawrag,llmwiki}/`).

**Docs site mirrors docs/**: `(public)/docs/` has foundation, stack, blueprint, AND programming sub-areas.

**Tiny-module pattern**: `feedback/`, `errors/` server domains are a single `index.ts` (queries+mutations inline, no split). The full template (`index.ts`/`queries.ts`/`mutations.ts`/`types.ts`/`config.ts`/`errors.ts`) appears in larger domains (blog, ai, rawrag, notifications).

Related: [[docs-dual-view]].
