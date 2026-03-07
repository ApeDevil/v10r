# Todos

Consolidated from architecture (archy), SvelteKit (svey), UX/UI (uxy), and data layer (daty) reviews.

---

## Tier 1: High-leverage, cross-cutting

### ~~1. Drizzle relations file~~ ✓

Done. `src/lib/server/db/schema/relations.ts` defines all relations. Merged into Drizzle client via `{ ...schema, ...relations }` in `db/index.ts`.

---

### 2. AI tools adapter

The multi-client core pattern is the project's central architectural claim. Two adapters work (UI form actions, REST API). The third (AI tool calls) is documented in `docs/blueprint/architecture/multi-client-core.md` but has zero code.

**What to do:**
- Create `src/lib/server/ai/tools/notifications.ts` -- wraps notification domain functions as AI-callable tools
- Create `src/lib/server/ai/tools/index.ts` -- tool registry
- Modify `src/routes/(shell)/api/ai/chat/+server.ts` to pass `tools: createTools(user.id)` and set `maxSteps: 5`

**Flagged by:** archy

---

### 3. `pages.md` is stale

Notifications (3 pages), analytics (6 pages), menus, workbench, tables, splits, desk layout group, forms/auth all exist in routes but aren't documented. Meanwhile pages.md references routes that don't exist (`/app/settings`, `/ui/panes/panels`, `/docs/[slug]`).

**What to do:**
- Add missing sections to `docs/blueprint/pages.md`: notifications, analytics, menus, workbench, tables, splits, desk, forms/auth
- Remove or mark as planned: `/app/settings`, `/ui/panes/panels`, `/docs/[slug]`
- Document the `(desk)` route group and its relationship to `(shell)`

**Flagged by:** archy, svey

---

### 4. `/app/settings` route

Most significant missing protected route. Blueprint calls for Superforms + Drizzle user preferences -- the exact template page developers copy first.

**What to do:**
- Create `/app/settings/+page.server.ts` with Superforms + Drizzle
- Create `/app/settings/+page.svelte` with mixed input types (switches, selects, text)
- Wire up theme preference persistence to database

**Flagged by:** svey, daty

---

## Tier 2: Small effort, real gaps

### 5. Root `+error.svelte`

Only `/(shell)/+error.svelte` exists. Errors thrown by root `+layout.server.ts` (theme cookie, session parse) fall through to SvelteKit's default error page.

**What to do:**
- Create `src/routes/+error.svelte` as the root fallback

**Flagged by:** svey

---

### 6. Skip-navigation link

WCAG 2.4.1 requirement. No `<a href="#main-content">` exists in the shell layout. Sidebar takes keyboard focus before main content.

**What to do:**
- Add `<a href="#main-content" class="sr-only focus:not-sr-only">Skip to main content</a>` before sidebar in shell layout
- Add `id="main-content"` to the `<main>` element

**Flagged by:** uxy

---

### 7. Schema barrel export fix

`src/lib/server/db/schema/core.ts` re-exports auth/ai/rag/jobs but not notifications or showcase. The Drizzle client's schema object is incomplete.

**What to do:**
- Add `export * from './notifications'` and `export * from './showcase'` to `core.ts`

**Flagged by:** archy, daty

---

### 8. `chunk.parentId` foreign key constraint

Self-referential FK defined as bare `text('parent_id')` with no `.references()`. Orphaned parent refs are possible.

**What to do:**
- In `src/lib/server/db/schema/rag/chunk.ts`, change to `.references((): AnyPgColumn => chunk.id, { onDelete: 'cascade' })`

**Flagged by:** daty

---

### 9. Generate baseline migration

`drizzle/` output directory is empty -- only `push` is used. Template projects need migration history for reproducible deploys.

**What to do:**
- Run `drizzle-kit generate` to capture current schema as baseline
- Commit the `drizzle/` directory

**Flagged by:** daty

---

## Tier 3: Polish and completeness

### 10. `Textarea` component

Only raw HTML element in the form system. No consistent error state, no design tokens, no reuse outside forms showcase.

**What to do:**
- Create `src/lib/components/primitives/textarea/Textarea.svelte` -- same API as Input (value, error, disabled, class, rows, resize)
- Add to `InputsSection.svelte` in the UI showcase

**Flagged by:** uxy

---

### 11. `RadioGroup` component

Missing exclusive-choice primitive. Wizard form uses Select as workaround.

**What to do:**
- Create `src/lib/components/primitives/radio-group/RadioGroup.svelte`
- Add to `InputsSection.svelte` in the UI showcase

**Flagged by:** uxy

---

### 12. Shallow routing demo (`App.PageState`)

SvelteKit 2's best feature, completely unused. `App.PageState` is commented out in `app.d.ts`.

**What to do:**
- Type `App.PageState` in `src/app.d.ts`
- Add `pushState`/`replaceState` to the RAG chat detail panel (chunk inspector) as a demo
- Consider `preloadData` on hover for instant navigation feel

**Flagged by:** svey

---

### 13. Client hooks (`src/hooks.ts`)

No `handleError` on client side. Client navigation errors are invisible.

**What to do:**
- Create `src/hooks.ts` with `handleError` export for client-side error logging

**Flagged by:** svey

---

### 14. `<svelte:boundary>` in 3D and RAG pages

Heavy renders (Three.js, pipeline graph) crash the entire page on error instead of showing inline fallback.

**What to do:**
- Wrap Three.js canvas components in `<svelte:boundary>` with retry fallback
- Wrap RAG pipeline graph visualization similarly

**Flagged by:** svey

---

### 15. Docs prerendering

Blueprint says `prerender = true` for `/docs/` but no `+layout.ts` exists. Static pages hit the server on every request.

**What to do:**
- Create `src/routes/(shell)/docs/+layout.ts` with `export const prerender = true`
- Consider building the `[slug]` dynamic doc route with markdown rendering

**Flagged by:** svey

---

### 16. NavigationSection in composites showcase

TabNav, BackLink, NavGrid exist as components but have no demos -- invisible to template users.

**What to do:**
- Expand `NavigationSection.svelte` with demos for TabNav, BackLink, NavGrid, standalone Breadcrumbs

**Flagged by:** uxy

---

## Additional data layer items

### 17. Missing `id.ts` module

No centralized ID generation. The Drizzle skill documents prefixed IDs (`usr_`, `itm_`) but generation is ad-hoc.

**What to do:**
- Create `src/lib/server/db/id.ts` with `createId(prefix)` function

**Flagged by:** daty

---

### 18. Missing `types.ts` for inferred types

No centralized `InferSelectModel`/`InferInsertModel` exports. Each consumer re-derives types.

**What to do:**
- Create `src/lib/server/db/types.ts` exporting inferred types for all tables

**Flagged by:** daty

---

### 19. `dailyPageStats.date` uses `text` instead of `date`

In `src/lib/server/db/schema/analytics/aggregates.ts`, loses native date comparison, range queries, and type safety.

**What to do:**
- Change column type from `text('date')` to `date('date')`

**Flagged by:** daty

---

### 20. Error classification gaps in store/cache/graph

`db` and `ai` modules have full error classification (`classifyDbError`, `classifyAIError`). Store, cache, and graph modules may lack equivalent classifiers.

**What to do:**
- Audit `src/lib/server/store/errors.ts`, `cache/errors.ts`, `graph/errors.ts`
- Add `classify[X]Error()` and `safe[X]Message()` functions matching the db/ai pattern

**Flagged by:** archy

---

### 21. Missing indexes and constraints

- `verification` table: no indexes on `identifier` or `expiresAt` (hot path for auth flows)
- `account` table: no composite unique on `(providerId, accountId)`
- `embeddingModel` table: no unique constraint on `(provider, modelName)`

**Flagged by:** daty
