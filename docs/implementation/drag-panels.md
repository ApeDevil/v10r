# Reorderable Panes — Drag-to-Reorder on Top of PaneForge

## Context

We already have PaneForge v1.0.2 integrated for **drag-to-resize** (PaneGroup, Pane, PaneResizer wrappers in `primitives/resizable/`). The goal is **drag-to-reorder** — the ability to rearrange panel positions by dragging.

No Svelte library cleanly combines resize + reorder (verified Feb 2026). The recommended approach is **two decoupled layers**: a tab/list bar handles reorder (custom pointer events), PaneForge handles resize. This is how VS Code, JetBrains, and Chrome DevTools work (verified against all three).

## Architecture

### Horizontal Layout

```
┌──────────────────────────────────────────┐
│  Tab Bar  (drag to REORDER)              │
│  [Nav ⋮⋮] [Content ⋮⋮] [Inspector ⋮⋮]   │
├──────────────────────────────────────────┤
│  PaneGroup  (drag to RESIZE)             │
│  ┌────────┬──┬──────────┬──┬────────┐    │
│  │  Nav   │║ │ Content  │║ │ Insp.  │    │
│  └────────┴──┴──────────┴──┴────────┘    │
└──────────────────────────────────────────┘
```

### Vertical Layout

```
┌──────┬──────────────────────────┐
│ Nav  │                          │
├──⋮⋮──┤  Panel 1                 │
│ Cont │                          │
├──⋮⋮──┼──────────────────────────┤
│ Insp │  Panel 2                 │
└──────┴──────────────────────────┘
  Side     PaneGroup (vertical)
  List
```

Vertical uses a **side list**, not horizontal tabs — horizontal tabs above vertical panels breaks the mental model.

### Core Principles

- DnD operates on the **tab/list bar only** — never touches PaneForge's DOM
- Resize operates on **panels only** — PaneForge handles this unchanged
- Shared `$state` panel order array drives both
- Sizes stored **by panel ID** (not position) — panels keep their width when reordered
- PaneGroup wrapped in `{#key order.join(',')}` — forces remount on reorder for clean re-registration
- Per-Pane `onResize` closures for size tracking — no positional `onLayoutChange` mapping
- `setLayout()` imperative API call after reorder to apply ID-mapped sizes to new positions

## Critical Technical Detail: Reorder + PaneForge

PaneForge tracks panels by **registration order** (mount order), not DOM position. When Svelte's keyed `{#each}` reorders DOM nodes, PaneForge's internal state desyncs.

**Solution** (validated against react-resizable-panels Issue #126 + PR #127):

```svelte
<script>
  let groupRef;

  function reorder(newOrder: string[]) {
    // 1. Sizes are already tracked by ID via per-Pane onResize
    // 2. Update order — {#key} remounts PaneGroup
    order = newOrder;
    // 3. After remount, apply correct sizes to new positions
    tick().then(() => {
      const newLayout = newOrder.map(id => sizes[id]);
      groupRef.setLayout(newLayout);
    });
  }
</script>

{#key order.join(',')}
  <PaneGroup bind:this={groupRef}>
    {#each order as id (id)}
      <Pane
        defaultSize={sizes[id]}
        onResize={(size) => { sizes[id] = size; }}
      >
        {@render children(paneMap[id])}
      </Pane>
      {#if !isLast(id)}
        <PaneResizer withHandle />
      {/if}
    {/each}
  </PaneGroup>
{/key}
```

**Why this works:**
- `{#key}` destroys and recreates PaneGroup on reorder — guarantees clean panel registration
- `defaultSize` feeds each Pane its saved size from the ID-keyed map
- `setLayout()` after `tick()` corrects any initial-render size drift
- Per-Pane `onResize` closures update sizes by ID — no positional mapping needed

**Why not just keyed `{#each}` without `{#key}`:**
- PaneForge context (`setContext`/`getContext`) is set once during component init
- DOM node moves don't trigger re-registration — internal panel registry retains stale order

## New Files

```
src/lib/components/composites/reorderable-panes/
├── ReorderablePaneLayout.svelte   — orchestrator (order + sizes state, persistence)
├── PaneTabBar.svelte              — tab/list strip with pointer-event DnD (tabs inlined)
├── reorderable-panes.ts           — types + CVA variants
├── index.ts                       — barrel exports

src/routes/showcases/ui/panes/reorderable/+page.svelte  — separate showcase route
```

PaneTab merged into PaneTabBar — no standalone use case. 3 component files + 1 barrel.

## Modified Files

- `src/lib/components/composites/index.ts` — add reorderable-panes exports
- `src/lib/components/primitives/resizable/PaneGroup.svelte` — expose `bind:this` / imperative API passthrough

## Implementation Phases

### Phase 1: Types + State-Driven Layout (no DnD yet)

**`reorderable-panes.ts`** — Types and CVA:
```typescript
interface PaneDefinition {
  id: string;
  label: string;
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  collapsible?: boolean;
}
```
Plus CVA variants for tab bar styling (tab, tab-active, tab-bar, side-list variants).

**`ReorderablePaneLayout.svelte`** — Orchestrator:
- Props: `panes: PaneDefinition[]`, `direction`, `persistId`, `children: Snippet<[PaneDefinition]>`
- State: `let order = $state<string[]>(...)` — panel IDs in display order
- State: `let sizes = $state<Record<string, number>>({})` — sizes keyed by ID
- Wraps PaneGroup in `{#key order.join(',')}` for clean remount on reorder
- Uses `bind:this` on PaneGroup for imperative `setLayout()` after reorder
- Per-Pane `onResize` closures update `sizes[id]` directly — no positional mapping
- Does NOT use PaneForge `autoSaveId` — manages own persistence
- Persists `{ order, sizes }` to localStorage under `reorderable-panes-{persistId}`
- Persistence via debounced `$effect` (300ms) — avoids thrashing localStorage
- Load from localStorage in `onMount` (SSR-safe — server renders default order, client applies saved)
- Merge strategy for persistence: saved order + append new panel IDs not in saved state
- Programmatic reorder buttons ("move left"/"move right") to validate architecture before DnD
- **Phase 1 gate**: resize must still work after programmatic reorder before proceeding

**PaneGroup wrapper update:**
- Expose `bind:this` passthrough so orchestrator can call `getLayout()`/`setLayout()`

### Phase 2: Tab Bar with Drag-to-Reorder

**`PaneTabBar.svelte`** — Tab/list strip with custom pointer-event DnD:
- Direction-aware: horizontal renders tab strip, vertical renders side list
- Tabs rendered inline (no separate PaneTab component)
- Each tab: label + grip icon (`i-lucide-grip-vertical`)
- Grip icon is the drag handle (not the entire tab — avoids click-vs-drag ambiguity)

**Pointer event logic (~80-120 lines):**
- `onpointerdown` on grip handle starts drag, calls `setPointerCapture()` for reliable tracking
- `onpointermove` on window calculates drop position from pointer X/Y (direction-aware)
- `onpointerup` on window finalizes reorder, updates `order` array
- `onpointerleave` on window cancels drag if cursor exits viewport
- All visual updates via `requestAnimationFrame()` — pointer events fire extremely frequently
- `touch-action: none` on grip handle for mobile
- Guard with `browser` + `onMount` for SSR safety

**Visual feedback — ghost/clone pattern (not translate-original):**
- `pointerdown` → create semi-transparent clone of tab following pointer
- `pointermove` → move clone with cursor, show drop indicator line between tabs
- `pointerup` → animate clone to final position, then remove
- Why not translate-original: leaves a visual "hole" in the tab bar, disorienting

**Keyboard reorder:**
- Horizontal: `ArrowLeft`/`ArrowRight` on focused tab trigger reorder
- Vertical: `ArrowUp`/`ArrowDown` on focused tab trigger reorder
- Focus returns to moved tab after reorder (via `tick().then(() => el.focus())`)

**Accessibility:**
- `role="list"` + `role="listitem"` (NOT `role="tablist"` — panels are always visible, not show/hide)
- `aria-label` on each item
- `aria-live="polite"` region for reorder announcements: "{Panel} moved to position {N} of {total}"
- Grip handle: `aria-label="Drag to reorder {panel.label}"`
- Screen-reader instructions: "Press Arrow keys to reorder"
- Disable reorder when PaneForge resize is active (prevents confusion about which action is happening)

**Discoverability:**
- Grip icon always visible in `text-muted` (not hidden until hover)
- `cursor-grab` on grip hover, `cursor-grabbing` while dragging
- Hide tab bar if only 1 panel (grip on single tab is useless)

### Phase 3: Polish + Showcase

**Polish:**
- `prefers-reduced-motion` — disable drag animations, fall back to instant position swap
- High contrast mode: use `border` (not `background`) for drop indicator (`border-color: CanvasText`)
- Mobile: increase grip hit area `@media (pointer: coarse) { padding: 12px }`
- Clear visual boundary between tab bar and panels (border-b, different surface colors, cursor differences)

**Showcase** (`/showcases/ui/panes/reorderable/+page.svelte`):
1. Basic reorderable (3 panels, drag tabs to reorder)
2. Reorderable + collapsible
3. Persistent reorderable (localStorage)
4. Vertical direction (side list variant)
5. Props reference for new components
6. Link from main `/showcases/ui/panes` page to reorderable route

## Key Design Decisions

1. **Custom pointer events over svelte-dnd-action** — tab bar is a simple flat list; libraries add unnecessary complexity and potential DOM conflicts. svelte-dnd-action's "wrapper div" concern is outdated (modern versions use actions), but custom is still simpler for this use case.
2. **Sizes by ID, not position** — when panels reorder, each keeps its width. This is the exact fix from react-resizable-panels Issue #126.
3. **`{#key}` remount on reorder** — PaneForge tracks panels by registration order. DOM node moves via keyed `{#each}` don't update the internal registry. `{#key}` forces clean re-registration. Cost is imperceptible since sizes are re-passed via `defaultSize`.
4. **Per-Pane `onResize` closures** — each Pane updates `sizes[id]` directly. Eliminates fragile positional-to-ID mapping from `onLayoutChange`.
5. **`setLayout()` imperative API** — after reorder remount, applies correct sizes to new positions. Confirmed available in PaneForge v1.0.2.
6. **No `autoSaveId`** — ReorderablePaneLayout owns persistence to avoid positional desync.
7. **Grip handle as drag target** — not entire tab. Prevents accidental drag, avoids click-vs-drag threshold logic, better mobile UX with `touch-action: none`.
8. **Ghost/clone drag preview** — semi-transparent clone follows pointer. Original tab stays in place. Avoids disorienting "hole" in tab bar.
9. **Side list for vertical** — horizontal tab bar above vertical panels breaks mental model. Direction-aware rendering in PaneTabBar.
10. **`role="list"` not `role="tablist"`** — panels are always visible (resizable/reorderable), not show/hide tabs.
11. **Separate showcase route** — main panes page is already 380 lines. `/showcases/ui/panes/reorderable/` keeps things focused.
12. **composites/ not primitives/** — this composes PaneForge + DnD, making it a composite by project convention.

## Existing Code to Reuse

| What | Where |
|------|-------|
| PaneGroup, Pane, PaneResizer | `src/lib/components/primitives/resizable/` |
| CVA pattern | `src/lib/components/primitives/button/button.ts` |
| Scoped CSS + `:global()` | `src/lib/components/primitives/button/Button.svelte` |
| Tab styling (data-state) | `src/lib/components/primitives/tabs/Tabs.svelte` |
| `cn()` utility | `src/lib/utils/cn.ts` |
| Icon classes | `i-lucide-grip-vertical`, `i-lucide-chevron-left/right` |
| color-mix() pattern | `src/lib/components/primitives/resizable/PaneResizer.svelte` |
| Surface tokens | `--surface-0`, `--surface-1` for panel backgrounds |
| Focus ring pattern | `focus-visible:ring-2 focus-visible:ring-primary` |
| Browser guard | `import { browser } from '$app/environment'` |

## Fallbacks

If PaneForge + `{#key}` remount causes issues (flicker, state loss, etc.):

1. **svelte-splitpanes** — explicitly supports "programmatic panes reordering by Svelte keyed each blocks"
2. **dockview** — 29k weekly downloads, zero deps, framework-agnostic. Built-in resize + reorder + persistence. More features than we need (tabbed groups, popouts) but battle-tested.

## Edge Cases

| Case | Handling |
|------|----------|
| Single panel | Hide tab bar (grip on single tab is useless) |
| Empty panes array | Render "No panels available" placeholder |
| Persistence desync (dev adds new panel) | Merge: keep saved order, append new IDs not in saved state |
| Reorder during active resize | Disable reorder when PaneForge resize is in progress |
| SSR hydration | Server renders default order; client applies saved layout in `onMount` |

## Verification

1. **Resize still works** — drag resizer between panels, sizes persist after reorder
2. **Reorder works** — drag tab grip, panel moves to new position with its size intact
3. **`setLayout()` applies** — after reorder, no "unpleasant size jump" on next resize drag
4. **Keyboard** — Tab to grip handle, Arrow keys to reorder, focus returns to moved tab
5. **Screen reader** — announcements: "{Panel} moved to position {N} of {total}"
6. **Persistence** — reorder + resize, refresh page, layout restored
7. **Persistence merge** — add new panel to code, refresh, new panel appears at end of saved order
8. **SSR** — no hydration errors (DnD client-only, layout server-renders in default order)
9. **Reduced motion** — `prefers-reduced-motion` disables drag animations
10. **Dark mode** — tab bar and indicators use semantic tokens
11. **Vertical** — side list renders, Arrow Up/Down reorders
12. **Mobile** — touch drag on grip works, no conflict with scroll

## References

- [react-resizable-panels Issue #126](https://github.com/bvaughn/react-resizable-panels/issues/126) — reorder + dnd-kit, imperative API required
- [react-resizable-panels PR #127](https://github.com/bvaughn/react-resizable-panels/issues/126) — added `setLayout()` for reorder support
- [PaneForge imperative API](https://paneforge.com/docs/components/pane-group) — `getLayout()`, `setLayout()`, `getId()`
- [Pointer events for drag reorder](https://blog.julik.nl/2022/10/drag-reordering) — throttling, rAF, viewport exit handling
- [svelte-splitpanes](https://www.npmjs.com/package/svelte-splitpanes) — alternative with built-in reorder support
- [dockview](https://dockview.dev/) — zero-dep panel system with resize + reorder + persistence
