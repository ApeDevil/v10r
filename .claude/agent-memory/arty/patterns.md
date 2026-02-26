# Structural Patterns — Velociraptor

## Component Export Styles (Mixed — Inconsistency)

The composites barrel uses three different export styles simultaneously:

```ts
// Style A — re-export everything from the sub-barrel
export * from './empty-state';

// Style B — named default export from file path
export { default as Card } from './card/Card.svelte';

// Style C — named destructured export from sub-barrel
export { DatePicker } from './date-picker';
```

Recommendation: standardize to Style A (`export * from './x'`) so each component's `index.ts` owns its own surface area.

## Nav Component Naming Inversion

| Folder | Exports |
|--------|---------|
| `nav-section/` | `SectionNav` |
| `nav-tab/` | `TabNav` |
| `nav-grid/` | `NavGrid` |

The first two use `[Noun][Verb]Nav`, the third uses `Nav[Noun]`. Should all follow one convention. `NavSection`, `NavTab`, `NavGrid` (prefix-first) is cleaner — matches component usage site (`<NavSection>`, `<NavTab>`).

## Server Module Guards Naming

- `db/showcase/guards.ts` → `checkRowLimit()`
- `cache/showcase/guards.ts` → `checkKeyLimit()`
- `store/showcase/guards.ts` → `checkObjectLimit()`

Each guard function is differently named by domain — appropriate. The file name `guards.ts` is consistent. Pattern is solid.

## Retrieval Tiers Naming

`tiers/contextual.ts`, `tiers/parent-child.ts`, `tiers/graph.ts` — named after the technique, not the tier number. This is correct (tier numbers change; technique names don't).
