# Arty Memory — Velociraptor Project

## Component Architecture

- **Three-tier structure**: `primitives/` → `composites/` → `shell/`
- **Barrel pattern**: Each component folder has `index.ts`. All use `export { default as X }` or `export * from './x'` — mixed styles in composites barrel (34 lines of inconsistency)
- **CVA pattern**: `.ts` file for variants, `.svelte` for component. CVA file named after folder (e.g., `button/button.ts`, `accordion/accordion.ts`)
- **Scoped CSS overrides**: Badge, Button, Input use `<style>` + `:global(.classname)` selectors to work around UnoCSS opacity + CSS variable limitations

## Key Naming Issues Discovered (2026-02)

- **Nav naming inversion**: Folder `nav-section/` exports `SectionNav`, folder `nav-tab/` exports `TabNav`, but folder `nav-grid/` exports `NavGrid` — inconsistent prefix order
- **Toast split**: `composites/toast/Toaster.svelte` (the popup component) vs `shell/ToastContainer.svelte` (the shell-level host). Different names, different owners — this is intentional but can confuse.
- **Shell index has "Phase" comments**: `// Phase 3A`, `// Phase 4`, etc. — build-time notes that should be removed
- **`separator/` folder is empty** — orphaned directory
- **`schemas/forms-showcase/`** — hyphenated subdirectory name inside `schemas/`. Other showcase data lives under `server/*/showcase/`. Inconsistent placement.
- **`services/fonts/`** — only one service; `services/` is a premature abstraction. Belongs in `utils/`.
- **`types/pipeline.ts`** — singleton file in its own `types/` directory. Could live closer to its domain (retrieval or ai).

## Server Module Patterns

- Consistent quad: `guards.ts`, `mutations.ts`, `queries.ts`, `seed.ts` across `db/showcase`, `cache/showcase`, `store/showcase`, `graph/showcase`
- `db/ai/` has `guards.ts` + `mutations.ts` but **no `queries.ts`** — mutations file contains list/get functions (queries embedded in mutations)
- `graph/` adds `constraints.ts` — appropriate, graph-specific

## Stores Directory

- All stores are context-based (SSR-safe), not module-level singletons
- Pattern: `createXState()` + `setXContext()` + `getX()` — consistent
- Name `stores/` is legacy (these aren't Svelte stores in the old sense); `state/` would be more accurate for Svelte 5

## viz Module

- Intentionally excluded from main `components/index.ts` barrel (heavy deps)
- Has its own `viz/index.ts` for explicit opt-in imports
- Internal taxonomy: `chart/`, `graph/`, `diagram/`, `plot/`, `map/` — clear and correct
- `_shared/` convention for internal utilities (matches SvelteKit `_components` convention)

## See Also

- `patterns.md` — detailed structural recommendations
