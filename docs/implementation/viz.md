# Visualization Components Brainstorm

> Research & architecture brainstorm for extending the Velociraptor component library with visualization elements (Chart, Plot, Diagram, Graph, Map). Compiled from 4 specialized agent consultations: resy (authoritative research), scout (real-world ground truth), archy (architecture), uxy (UX design). Validated Feb 2026 with corrections applied.

---

## Table of Contents

- [Library Picks](#library-picks)
- [What to Avoid](#what-to-avoid)
- [Worth Evaluating](#worth-evaluating)
- [Critical Constraints](#critical-constraints)
- [Architecture](#architecture)
- [UX Patterns](#ux-patterns)
- [Accessibility](#accessibility)
- [Dark Mode & Chart Color Palette](#dark-mode--chart-color-palette)
- [Showcase Design](#showcase-design)
- [Implementation Phases](#implementation-phases)
- [Implementation Checklist](#implementation-checklist)
- [Known Gotchas](#known-gotchas)
- [Sources](#sources)

---

## Library Picks

| Category | Pick | Why | Bundle |
|----------|------|-----|--------|
| **Charts** (bar, line, area, pie) | **Chart.js** | Most battle-tested, tree-shakable, framework-agnostic (no runes issues) | ~150-200KB total (tree-shaking yields ~25% reduction, shared base classes limit per-type savings) |
| **Scatter plots** | Chart.js | Already loaded, built-in scatter type | 0KB marginal |
| **Heatmap / time-series** | **uPlot** | 47.9KB total, fastest Canvas renderer for dense data (166k points in 25ms cold start) | ~48KB |
| **Interactive diagrams** | **Svelte Flow** | 1.0 stable (May 14, 2025), Svelte 5 runes-native, used at Stripe/Typeform | ~150KB |
| **Static diagrams** | **Mermaid** | Text-to-diagram, AI-friendly, @friendofsvelte/mermaid SSR | lazy only |
| **Network graphs** | **D3-force + Svelte** | Community consensus -- D3 for math, Svelte renders SVG | ~30KB |
| **Maps** | **MapLibre GL** | Open-source, svelte-maplibre-gl redesigned for Svelte 5 | ~400KB |
| **Simple / zero-dep** | **Keep existing SVGChart** | Zero dependency, perfect for basic dashboards | 0KB |

### Tier Summary (by bundle impact)

- **Tier 1** (under 50KB): uPlot, existing SVGChart
- **Tier 2** (50-300KB): Chart.js, Svelte Flow, D3 modules
- **Tier 3** (300KB+): MapLibre (~400KB), Mermaid -- lazy load only

---

## What to Avoid

| Library | Why |
|---------|-----|
| **shadcn-svelte charts** | Preview status, incompatible with runes mode (depends on LayerCake `export let`) |
| **Apache ECharts** | 1MB+ full bundle. Tree-shaking available but still 300KB+ for basic charts |
| **Plotly.js** | 3-10MB minified, no effective tree-shaking |
| **Excalidraw** | React dependency, poor fit for Svelte stack |
| **Unovis (@unovis/svelte)** | Svelte 5 support removed in v1.5.0, calling for contributions. Revisit if support lands |

---

## Worth Evaluating

Libraries that have changed status since initial research (Feb 2026) and deserve a second look before implementation:

| Library | Status Change | Potential |
|---------|--------------|-----------|
| **LayerChart 2.0** | v2.0 in pre-release (`next` only, ~35% complete). Svelte 5 runes migration in progress, dropping LayerCake dependency | Architecturally superior Svelte integration (native reactivity, simpler wrappers, inspectable SVG DOM). **Blocked by**: pre-release instability, svelte-ux + Tailwind coupling (untested with UnoCSS), 603KB bundle, solo maintainer, broken mobile tooltips (#639), memory leak under investigation (#585). See re-evaluation criteria below |
| **LayerCake v8.4** | "The Svelte 5 Edition" -- works out of the box, examples use runes (internals still `export let`) | Functional but API changes coming for full runes support |
| **svelte5-chartjs** | Svelte 5 Chart.js wrapper (LupusAI). 14 stars, 9 months stale, issues disabled | Dead on arrival. Write our own wrapper using `$effect` + `untrack()` pattern ([sveltejs/svelte#14202](https://github.com/sveltejs/svelte/issues/14202)) |
| **svelte-vega v4.1** | Official Vega wrapper, published Feb 2026 | Declarative grammar, server-renderable SVG for small data |
| **Observable Plot** | Server-side SVG rendering, no Canvas/WebGL needed | Lightweight alternative for simple charts |
| **Lightweight Charts** | TradingView's library, Svelte 5 wrapper exists (lightweight-charts-svelte) | Best-in-class for financial/time-series charts |

### LayerChart 2.0 Re-evaluation Criteria

LayerChart wins on 5 of 9 architectural dimensions (Svelte integration, wrapper simplicity, module map, error visibility, D3 reuse with Phase 4). It loses on 3 dimensions that carry disproportionate weight for a production template: theming (Tailwind coupling vs our UnoCSS), bundle isolation (10-15 transitive deps vs 1), and maturity (pre-release vs 13-year track record).

**LayerChart becomes the recommended Chart.js replacement when ALL of these are met:**

- [ ] Stable `2.0.0` release on npm (not `-next`)
- [ ] LayerCake dependency fully removed
- [ ] `svelte-ux` dependency either optional or eliminated
- [ ] Confirmed working with UnoCSS (test extraction in isolated project)
- [ ] Bundle size reduced or tree-shakeable to <200KB
- [ ] Mobile tooltip issue resolved ([#639](https://github.com/techniq/layerchart/issues/639))
- [ ] Memory leak resolved ([#585](https://github.com/techniq/layerchart/issues/585))

**If all criteria are met**, the migration is moderate effort:
- Rewrite `viz/chart/` wrappers from translation (80-120 lines) to composition (30-50 lines)
- Delete `theme-bridge.ts`, `chart-theme.ts`, `register.ts` (bridge code eliminated)
- D3 modules (already in dep tree) get shared with Phase 4 network graphs
- Canvas cleanup patterns (`beforeNavigate`, `onDestroy`) no longer needed (SVG auto-cleans)

---

## Critical Constraints

1. **SSR**: ALL viz libraries need `onMount()` + dynamic import ("window is not defined")
2. **UnoCSS integration**: Open problem -- no documented patterns exist. Use CSS custom properties directly for chart theming, UnoCSS for container layout only
3. **No batteries included**: No Svelte equivalent of React's shadcn-charts exists
4. **Svelte 5 hydration**: `{@html}` doesn't hydrate, `<svelte:element>` hydration broken, 18% payload increase from markers
5. **Rendering thresholds**: SVG for <1k points, Canvas for <10k, WebGL for 100k+

---

## Architecture

### New `viz/` Component Category

Visualization components belong in a **new top-level category**, not inside composites:

```
src/lib/components/
  primitives/     <- Atomic UI (no external deps)
  composites/     <- Combined UI patterns
  layout/         <- Spatial arrangement
  shell/          <- App chrome
  viz/            <- Data visualization (NEW)
    index.ts      <- Barrel exports
    _shared/      <- Shared viz utilities
    chart/        <- Bar, line, area, pie
    plot/         <- Scatter, heatmap
    diagram/      <- Flowcharts, state machines
    graph/        <- Network, force-directed, tree
    map/          <- Geographic, choropleth
```

**Why separate from composites:**

1. **Dependency boundary** -- Viz pulls in Chart.js (~150-200KB), Svelte Flow (~150KB), MapLibre GL (~400KB). These are integration wrappers around rendering engines, not "combine a Button and a Badge" composites.
2. **Loading strategy** -- Every viz component needs `onMount` + dynamic import. Shared architectural concern that doesn't apply to composites.
3. **Bundle control** -- Viz is intentionally NOT in master `components/index.ts`. Explicit import path prevents accidental bundle bloat: `import { BarChart } from '$lib/components/viz'`

### Master Export Strategy

```typescript
// src/lib/components/index.ts (UNCHANGED)
export * from './primitives';
export * from './composites';
export * from './layout';
// NOTE: viz is intentionally NOT re-exported here.

// src/lib/components/viz/index.ts
export { SimpleChart } from './chart/simple';
export { BarChart, LineChart, AreaChart, PieChart } from './chart';
export { ScatterPlot, HeatMap } from './plot';
export { FlowDiagram } from './diagram';
export { NetworkGraph } from './graph';
export { GeoMap } from './map';
```

### Abstraction Level: Thin Wrappers

Each component wraps one library, handles SSR safety, applies design tokens, provides TypeScript types, and renders a loading skeleton. The underlying library's configuration is exposed directly (not abstracted away).

```svelte
<!-- Thin wrapper pattern (RIGHT) -->
<BarChart
  data={chartData}
  options={{ scales: { y: { beginAtZero: true } } }}
  class="my-chart"
/>

<!-- Thick abstraction (WRONG) -->
<Chart
  type="bar"
  data={chartData}
  yAxisStart={0}
  showLegend
  legendPosition="bottom"
/>
```

### Complete Module Map

```
src/lib/components/viz/
  index.ts                    <- Public API (explicit import only)
  _shared/
    theme-bridge.ts           <- CSS custom property reader (getCSSVar)
    chart-theme.ts            <- Chart.js theme from tokens (hoisted from chart/_shared/)
    register.ts               <- Chart.js selective registration (hoisted from chart/_shared/)
    chart-container.ts        <- CVA: container sizing + aspect ratios
  chart/
    index.ts
    simple/                   <- Migrated from composites/chart/
      SimpleChart.svelte      <- Zero-dep SVG (renamed from Chart.svelte)
      simple-chart.ts         <- CVA variants
      index.ts
    bar/
      BarChart.svelte         <- Chart.js bar
      index.ts
    line/
      LineChart.svelte        <- Chart.js line
      index.ts
    area/
      AreaChart.svelte        <- Chart.js area (fill: 'origin')
      index.ts
    pie/
      PieChart.svelte         <- Chart.js pie/doughnut (doughnut prop)
      index.ts
  plot/
    index.ts
    scatter/
      ScatterPlot.svelte      <- Chart.js scatter
      index.ts
    heatmap/
      HeatMap.svelte          <- uPlot heatmap
      index.ts
  diagram/
    index.ts
    flow/
      FlowDiagram.svelte      <- Svelte Flow
      FlowNode.svelte
      FlowEdge.svelte
      flow-theme.ts
      index.ts
    state/
      StateDiagram.svelte
      index.ts
  graph/
    index.ts
    network/
      NetworkGraph.svelte      <- D3-force + Svelte SVG
      index.ts
    tree/
      TreeGraph.svelte         <- D3-hierarchy + Svelte SVG
      index.ts
    _shared/
      force-simulation.ts
      types.ts
  map/
    index.ts
    geo/
      GeoMap.svelte            <- MapLibre GL
      MapMarker.svelte
      MapPopup.svelte
      map-theme.ts
      index.ts
```

### Integration Architecture

#### Design Token Consumption

Each viz library consumes design tokens via a `buildTheme()` function that reads computed CSS custom properties at mount time:

```typescript
// viz/_shared/theme-bridge.ts (IMPLEMENTED)
export function getCSSVar(token: string): string {
  if (typeof document === 'undefined') return '#000'; // SSR fallback
  return getComputedStyle(document.documentElement)
    .getPropertyValue(`--${token}`)
    .trim();
}

export function getVizPalette(): string[] {
  return ['chart-1','chart-2','chart-3','chart-4','chart-5','chart-6','chart-7','chart-8']
    .map(t => getCSSVar(t));
}

export function getChartInfraColors() {
  return {
    grid: getCSSVar('chart-grid'), axis: getCSSVar('chart-axis'),
    label: getCSSVar('chart-label'), bg: getCSSVar('chart-bg'),
    tooltipBg: getCSSVar('chart-tooltip-bg'),
  };
}
```

#### Dark Mode Integration

Subscribe to the app's theme store (or `prefers-color-scheme` media query) and re-theme charts reactively. Avoid MutationObserver -- it fires on any class change to `<html>` and has zero real-world usage for chart theming.

```svelte
<script>
  import { mode } from 'mode-watcher'; // or your theme store

  let chart: ChartInstance | undefined = $state();

  // Re-theme when dark mode toggles
  $effect(() => {
    if (!chart) return;
    const _mode = mode.current; // track reactively
    const newTheme = buildChartTheme();
    Object.assign(chart.options, newTheme.defaults);
    chart.update();
  });
</script>
```

For apps without a theme store, use `matchMedia`:

```typescript
const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
mediaQuery.addEventListener('change', () => {
  const newTheme = buildChartTheme();
  Object.assign(chart.options, newTheme.defaults);
  chart.update();
});
```

#### Lazy Loading Strategy

All viz libraries use dynamic import inside `onMount`. For Chart.js, tree-shaking helps but has limits -- shared base classes mean per-type savings are ~25%, not 75%:

```typescript
// WRONG -- ~200-250KB, imports everything, defeats tree-shaking
import Chart from 'chart.js/auto';

// RIGHT -- selective registration, ~150-200KB for 4 chart types
import { Chart, BarController, CategoryScale, LinearScale, BarElement } from 'chart.js';
Chart.register(BarController, CategoryScale, LinearScale, BarElement);
```

#### Container-Based Sizing

Viz components use aspect-ratio CVA variants instead of fixed width/height:

```typescript
// viz/_shared/chart-container.ts
export const chartContainerVariants = cva(
  'relative w-full',
  {
    variants: {
      aspect: {
        'video': 'aspect-video',       // 16:9
        'square': 'aspect-square',     // 1:1
        'wide': 'aspect-[21/9]',       // Ultra-wide
        'chart': 'aspect-[3/2]',       // Default chart ratio
        'auto': ''                     // Height from parent
      }
    },
    defaultVariants: { aspect: 'chart' }
  }
);
```

#### SSR Pattern

Every viz component follows: **Server render skeleton -> Client mount dynamic import -> Replace skeleton with viz -> Cleanup on destroy**

Keep SSR enabled -- don't use `export const ssr = false`. The `onMount` + dynamic import pattern handles browser-only libraries while preserving SSR benefits (page structure, meta tags, initial HTML, SEO). Disabling SSR entirely is unnecessary and loses those benefits.

---

## UX Patterns

### Loading States: Content-Aware Skeletons

Skeletons over spinners. Show structure, not just "loading":

- **Bar charts**: Vertical rectangles at varying heights with staggered pulse
- **Line charts**: Wavy path skeleton
- **Pie charts**: Segmented circle
- **Maps**: Simplified continent outlines
- **Diagrams**: Connected node placeholders

```svelte
<!-- ChartSkeleton.svelte -->
<div class="chart-skeleton" role="status" aria-label="Loading chart">
  <svg viewBox="0 0 400 300" class="skeleton-svg">
    <line x1="40" y1="20" x2="40" y2="280" class="skeleton-axis" />
    <line x1="40" y1="280" x2="380" y2="280" class="skeleton-axis" />
    <rect x="60" y="100" width="50" height="180" class="skeleton-bar pulse-1" />
    <rect x="130" y="140" width="50" height="140" class="skeleton-bar pulse-2" />
    <rect x="200" y="80" width="50" height="200" class="skeleton-bar pulse-3" />
    <rect x="270" y="160" width="50" height="120" class="skeleton-bar pulse-4" />
  </svg>
  <span class="sr-only">Loading visualization data</span>
</div>
```

### Empty States: Contextual Guidance

Never show a blank box. Differentiate:

1. **No data exists** -> "No data available yet"
2. **Filtered out** -> "No results match your filters"
3. **Date range empty** -> "No data in selected period"
4. **Permission denied** -> "Upgrade to view this chart"

Each with an icon, descriptive message, and optional action button.

### Error States: Fallback Table + Retry

Always provide a path forward:

1. **Library load failure** -> "Chart library failed to load" + Retry button
2. **Data fetch failure** -> "Could not load data" + Retry + Table fallback
3. **Malformed data** -> "Invalid data format" + Show raw JSON in expandable
4. **Render error** -> "Chart rendering failed" + Report issue link

Use the existing Table component as data fallback inside a `<details>` element.

### Responsive Behavior

| Viz Type | Mobile | Desktop |
|----------|--------|---------|
| Bar/Column | Horizontal scroll for many bars | Standard layout |
| Line/Area | Reduce data points (weekly vs daily) | Full granularity |
| Pie/Donut | Legend below (vertical stack) | Legend to the right |
| Maps | Touch gestures + visible zoom controls | Mouse wheel + click-drag |
| Diagrams | Pan-and-zoom canvas | Fit to container + optional zoom |
| Heatmaps | Horizontal + vertical scroll | Fit to width if <20 columns |

### Interaction Patterns

- **Tooltips**: Dismissable (ESC), hoverable, persistent. `pointer-events: auto` on tooltip itself
- **Zoom/Pan**: Reset zoom button always visible. Zoom level indicator
- **Click-to-Drill**: Breadcrumb trail for navigation depth. Keyboard: Tab to data point, Enter to drill

---

## Accessibility

### WCAG 2.1 AA Requirements

#### Text Alternatives

Every chart wrapped in `<figure>` with:
- `<figcaption class="sr-only">` describing the chart
- Adjacent `<details>` with full data table (progressive disclosure)

```svelte
<figure>
  <figcaption class="sr-only">
    Bar chart showing quarterly sales from Q1 2025 to Q4 2025
  </figcaption>
  <div class="chart-container">
    <BarChart {data} />
  </div>
  <details class="data-table mt-4">
    <summary>View data as table</summary>
    <Table>...</Table>
  </details>
</figure>
```

#### Interactive Announcements

```svelte
<div class="sr-only" aria-live="polite" aria-atomic="true">
  {#if selectedDataPoint}
    {selectedDataPoint.label}: {selectedDataPoint.value}
  {/if}
</div>
```

#### Keyboard Navigation

- Tab to chart container
- Arrow keys between data points
- Enter to drill down
- ESC to dismiss tooltip

#### Color Requirements

- Never use color alone to convey meaning (add patterns, icons, or text labels)
- Chart elements against background: 3:1 minimum (WCAG 1.4.11)
- Text labels against background: 4.5:1 minimum (WCAG 1.4.3)

#### Screen Reader Roles

- Static charts: `role="img"` with `aria-label`
- Interactive maps: `role="application"` with instructions
- Diagrams: `role="img"` with `aria-describedby` pointing to text description

---

## Dark Mode & Chart Color Palette

### 8-Color Chart Palette

Add to `src/app.css`:

```css
:root {
  /* Chart series colors (light mode) */
  --chart-1: #3b82f6;   /* Blue -- default series */
  --chart-2: #10b981;   /* Green -- growth/positive */
  --chart-3: #f59e0b;   /* Orange -- caution/attention */
  --chart-4: #8b5cf6;   /* Purple -- secondary (harmonizes w/ primary) */
  --chart-5: #ef4444;   /* Red -- decline/negative */
  --chart-6: #06b6d4;   /* Cyan -- tertiary */
  --chart-7: #ec4899;   /* Pink -- accent */
  --chart-8: #84cc16;   /* Lime -- completion */

  /* Chart infrastructure */
  --chart-grid: #e5e7eb;
  --chart-axis: #6b7280;
  --chart-label: var(--color-muted);
  --chart-bg: var(--surface-1);
  --chart-tooltip-bg: var(--surface-3);
}

.dark {
  /* Chart series colors (dark mode -- lighter tints) */
  --chart-1: #60a5fa;
  --chart-2: #34d399;
  --chart-3: #fbbf24;
  --chart-4: #a78bfa;
  --chart-5: #f87171;
  --chart-6: #22d3ee;
  --chart-7: #f472b6;
  --chart-8: #a3e635;

  --chart-grid: #374151;
  --chart-axis: #9ca3af;
  --chart-label: var(--color-muted);
  --chart-bg: var(--surface-1);
  --chart-tooltip-bg: var(--surface-3);
}
```

### Contrast Ratios (UNVERIFIED -- must test before implementation)

Claimed ratios need manual verification with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) against actual surface colors before implementation.

- WCAG AA requires 3:1 for chart elements (WCAG 1.4.11) and 4.5:1 for text labels (WCAG 1.4.3)
- Test each chart color against `--surface-1` in both light (#dce2e9) and dark (#121416) modes

### Usage Guidelines

| Series Count | Recommended Colors |
|--------------|-------------------|
| 2 series | Chart 1 + Chart 4 (blue + purple) |
| 3 series | Chart 1, 4, 6 (blue, purple, cyan) |
| 5+ series | All colors in order |
| >8 series | Add patterns/stripes (avoid color-only) |
| Positive/negative | Chart 2 + Chart 5 (green + red) |

### Semantic Overrides

```css
/* Financial */
--chart-profit: var(--color-success);
--chart-loss: var(--color-error);
--chart-neutral: var(--color-muted);

/* Status */
--chart-complete: var(--chart-2);
--chart-in-progress: var(--chart-3);
--chart-pending: var(--color-muted);
--chart-failed: var(--chart-5);
```

---

## Showcase Design

### Route Structure

```
src/routes/showcases/
  +page.svelte              <- Hub (add "Data Viz" LinkCard)
  viz/                      <- NEW
    +page.svelte            <- Viz hub (links to subcategories)
    _components/
      VizDemoCard.svelte    <- DemoCard variant with Chart/Data/Code tabs
      DataControls.svelte   <- Dataset picker, date range, animation toggle
    charts/
      +page.svelte          <- Bar, Line, Area, Pie demos
    plots/
      +page.svelte          <- Scatter, Heatmap demos
    diagrams/
      +page.svelte          <- Flow, State Machine demos
    graphs/
      +page.svelte          <- Network, Tree demos
    maps/
      +page.svelte          <- Geographic, Choropleth demos
```

SSR stays enabled. Each viz component handles browser-only code internally via `onMount` + dynamic import.

Organized **by viz type** (not by library or use case) -- matches how developers think: "I need a bar chart" not "I need a Chart.js".

### VizDemoCard (Tabbed)

Unlike regular `DemoCard`, viz demos get **tabbed views**:

- **Chart** tab -- live visualization
- **Data** tab -- underlying data table (accessibility + verification)
- **Code** tab -- implementation code

```svelte
<VizDemoCard
  title="Vertical Bars"
  description="Standard column chart for comparing categories."
  showDataTable={true}
  showCode={true}
>
  {#snippet visualization()}
    <BarChart data={getData(dataset, dateRange)} {animated} />
  {/snippet}
  {#snippet dataTable()}
    <Table>...</Table>
  {/snippet}
  {#snippet code()}
    <pre><code>...</code></pre>
  {/snippet}
</VizDemoCard>
```

### DataControls (Global)

Interactive controls at the top of each showcase page that affect all demos:
- Dataset selector (Sales, Traffic, Performance)
- Date range (Daily, Weekly, Monthly, Quarterly)
- Animation toggle

### Demo Scenarios

**Charts**: Vertical bars (category compare), horizontal bars (ranking), stacked (part-to-whole), grouped (multi-series), single line (trend), multi-line (compare), area (magnitude), pie/donut (market share)

**Diagrams**: Authentication flowchart, order status state machine, team org chart

**Maps**: Choropleth (sales by region), point map (store locations), heat map (activity density)

**Graphs**: Network graph (social connections), tree graph (file hierarchy), force-directed (cluster detection)

---

## Implementation Phases

Each phase is independently shippable. No phase depends on another.

| Phase | Dependencies | What Ships | Status |
|-------|-------------|------------|--------|
| **1** | `chart.js` | Chart tokens in app.css, theme-bridge, ChartSkeleton/Empty/Error, BarChart, LineChart, AreaChart, PieChart, ScatterPlot, VizDemoCard, `/showcases/viz/charts/` | **Done** |
| **2** | `uplot` | HeatMap, time-series charts, `/showcases/viz/plots/` | |
| **3** | `@xyflow/svelte` | FlowDiagram, StateDiagram, `/showcases/viz/diagrams/` | |
| **4** | `d3-force`, `d3-hierarchy` | NetworkGraph, TreeGraph, `/showcases/viz/graphs/` | |
| **5** | `maplibre-gl`, `svelte-maplibre-gl` | GeoMap, MapMarker, MapPopup, `/showcases/viz/maps/` | |

---

## Implementation Checklist

Before shipping any visualization component:

### States
- [x] Loading state with content-aware skeleton *(Phase 1: SVG skeletons per chart type with pulse animation)*
- [ ] Empty state with contextual message
- [ ] Error state with retry + table fallback
- [ ] Responsive behavior on mobile (<640px)

### Accessibility
- [ ] Adjacent data table (in `<details>`)
- [x] `role="img"` or `role="application"` with `aria-label` *(Phase 1: `role="img"` + `ariaLabel` prop on all wrappers)*
- [ ] Keyboard navigation (Tab, Arrow keys, Enter)
- [ ] Screen reader announcements (`aria-live`)
- [ ] Focus indicators visible (2px outline)
- [ ] Color + pattern/icon (not color-only)

### Dark Mode
- [x] Chart colors use CSS custom properties *(Phase 1: 8-color palette + infra tokens in app.css)*
- [x] Grid/axes use `--chart-grid` / `--chart-axis` *(Phase 1: theme-bridge.ts → chart-theme.ts)*
- [x] Labels use `--chart-label` *(Phase 1)*
- [ ] All colors pass WCAG AA contrast

### Lifecycle & Cleanup
- [x] Canvas/WebGL context destroyed in `onDestroy` *(Phase 1: `beforeNavigate(cleanup)` + `onDestroy(cleanup)` dual pattern)*
- [ ] D3 simulations stopped (`.stop()`) in `onDestroy`
- [ ] ResizeObserver disconnected in `onDestroy`
- [x] No memory leaks on route navigation (test with DevTools) *(Phase 1: verified with dual cleanup pattern)*

### Showcase
- [x] VizDemoCard with Chart/Data/Code tabs *(Phase 1: ARIA tabs pattern with focus-follows-selection)*
- [ ] Interactive data controls
- [x] At least 3 variants per viz type *(Phase 1: 4 bar variants, 2 line, 1 area, 2 pie, 1 scatter)*
- [ ] Mobile responsive demo layout

---

## Known Gotchas

Issues discovered through real-world practitioner experiences that must be handled during implementation.

### Canvas/WebGL Cleanup on Route Navigation

SvelteKit does not auto-destroy Canvas/WebGL contexts on navigation ([sveltejs/kit#12405](https://github.com/sveltejs/kit/issues/12405), [#9427](https://github.com/sveltejs/kit/issues/9427)). Memory grows with each page visit. Every viz component must explicitly clean up:

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { beforeNavigate } from '$app/navigation';

  let chart: Chart | undefined = $state();

  function cleanup() {
    chart?.destroy();
    chart = undefined;
  }

  beforeNavigate(cleanup);
  onDestroy(cleanup);
</script>
```

### D3 Force Simulation Cleanup

D3 force simulations run an internal timer. If not stopped, they leak memory and CPU after navigating away:

```typescript
onDestroy(() => {
  simulation.stop();
});
```

### Chart.js First-Load Sizing Bug

Charts render at incorrect (small) size on first page load in SvelteKit ([chartjs/Chart.js#11687](https://github.com/chartjs/Chart.js/issues/11687)). Workaround: trigger a resize after mount:

```typescript
onMount(async () => {
  // ... create chart
  requestAnimationFrame(() => chart.resize());
});
```

### uPlot Resize Handling

uPlot does not support percentage-based widths ([leeoniya/uPlot#233](https://github.com/leeoniya/uPlot/issues/233)). Requires manual ResizeObserver. Also, CSS `transform: scale()` breaks mouse coordinate calculations ([#469](https://github.com/leeoniya/uPlot/issues/469)). Use actual pixel dimensions, not CSS transforms.

### Svelte Flow Performance

Svelte Flow 1.0 requires `$state.raw` (not `$state`) for nodes/edges arrays -- deep reactivity causes performance issues ([official docs](https://svelteflow.dev/learn)). Custom nodes cause frame rate drops when dragging ([xyflow#4711](https://github.com/xyflow/xyflow/issues/4711)). Performance expectations:

| Scale | Standard Nodes | Custom Nodes |
|-------|---------------|--------------|
| <200 | Smooth | Likely fine |
| 200-1000 | Fine | Test early |
| >1000 | Enable `onlyRenderVisibleElements` | Problematic |

### Svelte 5 Library Compatibility

Track known incompatible libraries at [sveltejs/svelte#10359](https://github.com/sveltejs/svelte/issues/10359). Check before adding any new viz dependency.

---

## Known Tradeoffs

1. **Multiple libraries = more to maintain** -- Chart.js, uPlot, Svelte Flow, D3, MapLibre. Five upgrade paths. LayerChart 2.0 could potentially replace Chart.js + reduce this to four.
2. **Dynamic import adds load latency** -- First render shows skeleton for 100-500ms. Preloading on route hover (SvelteKit `data-sveltekit-preload-data`) can help.
3. **Theme sync is eventual** -- Brief moment where chart shows old theme on dark mode toggle. Store subscription fires quickly but not instantaneously.
4. **No unified data format** -- Chart.js expects `{ labels, datasets }`, D3 expects arrays, Svelte Flow expects `{ nodes, edges }`. Translation layers per library would add complexity without value.
5. **Chart.js tree-shaking overpromises** -- Shared base classes (core controller, scales) mean each chart type doesn't add just ~50KB. Realistic: ~150-200KB total for 4 chart types. Still much better than `chart.js/auto` (~200-250KB all-in).
6. **svelte-maplibre-gl is pioneer territory** -- Redesigned for Svelte 5 but has 0 production users (vs svelte-maplibre with 8). Tradeoff: Svelte 5 native DX vs battle-tested reliability.

---

## Sources

### Svelte-Specific
- [LayerChart GitHub](https://github.com/techniq/layerchart)
- [LayerChart changelog (Svelte 5 release)](https://www.layerchart.com/changelog)
- [LayerChart 2.0 migration issue](https://github.com/techniq/layerchart/issues/432)
- [LayerCake](https://layercake.graphics/)
- [LayerCake runes migration issue](https://github.com/mhkeller/layercake/issues/156)
- [LayerCake v8.4.0 "The Svelte 5 Edition"](https://github.com/mhkeller/layercake/releases/tag/v8.4.0)
- [shadcn-svelte charts runes incompatibility](https://github.com/huntabyte/shadcn-svelte/issues/2201)
- [Svelte Flow 1.0 release](https://xyflow.com/blog/svelte-flow-release)
- [Svelte Flow 1.0 changelog](https://svelteflow.dev/whats-new/2025-05-14)
- [svelte-maplibre](https://github.com/dimfeld/svelte-maplibre)
- [svelte-maplibre-gl (Svelte 5)](https://github.com/MIERUNE/svelte-maplibre-gl)
- [@friendofsvelte/mermaid](https://github.com/friendofsvelte/mermaid)
- [Unovis @unovis/svelte](https://github.com/f5/unovis)
- [svelte5-chartjs (LupusAI)](https://github.com/LupusAI/svelte5-chartjs)
- [svelte-vega (official)](https://github.com/vega/svelte-vega)
- [lightweight-charts-svelte](https://github.com/HuakunShen/lightweight-charts-svelte)
- [Svelte 5 library compatibility tracker](https://github.com/sveltejs/svelte/issues/10359)
- [Best Chart Libraries for Svelte 2026](https://weavelinx.com/best-chart-libraries-for-svelte-projects-in-2026/)

### General Viz
- [Chart.js SSR issues in SvelteKit](https://github.com/sveltejs/kit/issues/5535)
- [Chart.js tree-shaking issue](https://github.com/chartjs/Chart.js/issues/10163)
- [Chart.js first-load sizing bug](https://github.com/chartjs/Chart.js/issues/11687)
- [Chart.js dark mode discussion](https://github.com/chartjs/Chart.js/discussions/9214)
- [D3 + Svelte force layouts](https://datavisualizationwithsvelte.com/basics/force-simulations)
- [SVG vs Canvas vs WebGL Performance](https://www.svggenie.com/blog/svg-vs-canvas-vs-webgl-performance-2025)
- [MapLibre GL vs Leaflet](https://blog.jawg.io/maplibre-gl-vs-leaflet-choosing-the-right-tool-for-your-interactive-map/)
- [uPlot review (cprimozic)](https://cprimozic.net/notes/posts/my-thoughts-on-the-uplot-charting-library/)
- [uPlot responsive sizing issue](https://github.com/leeoniya/uPlot/issues/233)

### SvelteKit Memory & SSR
- [SvelteKit memory leak on navigation](https://github.com/sveltejs/kit/issues/12405)
- [SvelteKit memory usage concerns](https://github.com/sveltejs/kit/issues/9427)
- [SvelteKit "window is not defined"](https://joyofcode.xyz/sveltekit-window-is-not-defined)

### Svelte 5 Hydration
- [{@html} hydration issue](https://github.com/sveltejs/svelte/issues/12333)
- [Hydration markers payload increase (18%)](https://github.com/sveltejs/svelte/issues/14099)
- [Excessive hydration markers](https://github.com/sveltejs/svelte/issues/15200)

### Svelte Flow Performance
- [Frame rate drops with custom nodes](https://github.com/xyflow/xyflow/issues/4711)
- [Bad performance in Svelte 5](https://github.com/xyflow/xyflow/issues/4111)
- [70k+ nodes performance](https://github.com/xyflow/xyflow/issues/5117)

### Dark Mode
- [prefers-color-scheme (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme)
- [Dark mode best practices (web.dev)](https://web.dev/articles/prefers-color-scheme)
- [svelte-themes](https://github.com/beynar/svelte-themes)
- [sveltekit-dark-mode](https://github.com/CaptainCodeman/sveltekit-dark-mode)

### Accessibility
- [Accessible Data Visualisations Checklist](https://www.a11y-collective.com/blog/accessible-charts/)
- [Accessibility-First Chart Design (Smashing)](https://www.smashingmagazine.com/2022/07/accessibility-first-approach-chart-visual-design/)
- [WCAG Contrast Requirements](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)

### UX Research
- [Skeleton Screens 101 (NN/g)](https://www.nngroup.com/articles/skeleton-screens/)
- [Skeleton vs Spinner UX battle](https://medium.com/productboard-engineering/%EF%B8%8F-spinners-versus-skeletons-in-the-battle-of-hasting-b51b9c6574ef)
- [Lazy Loading in Svelte 5](https://www.richardfu.net/efficient-lazy-loading-in-svelte-a-practical-guide-for-svelte-4-and-svelte-5-runes/)
- [Responsive charts with bind:clientWidth](https://www.newline.co/courses/better-data-visualizations-with-svelte/using-sveltes-dimension-bindings-for-responsive-scatterplots)
