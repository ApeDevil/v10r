# Data Visualization

## What is it?

A collection of chart, plot, graph, diagram, and map components for rendering data in the browser. Each section of the viz showcase uses a different underlying library — chosen based on what the visualization type needs.

## What is it for?

- **Charts** — time-series, comparisons, distributions, part-to-whole (bar, line, area, pie, radar, bubble, sparkline, gauge, treemap)
- **Plots** — scatter and heatmap for dense, continuous, or matrix data
- **Graphs** — network topology, org hierarchies, dependency graphs, Sankey flows, knowledge graphs
- **Diagrams** — interactive flow diagrams and state machines
- **Maps** — geospatial data with markers, popups, and GeoJSON layers

## Why was it chosen?

Each library solves a different visualization problem.

| Library | Version | Used For |
|---------|---------|----------|
| **Chart.js** | ^4.4 | Charts (bar, line, area, pie, radar, bubble, scatter) |
| **d3-force** | ^3.0 | Force-directed network graph layout |
| **d3-hierarchy** | ^3.1 | Tree and treemap layout |
| **d3-dag** | ^1.1 | DAG layout (Sugiyama layered algorithm) |
| **d3-sankey** | ^0.12 | Sankey flow diagram layout |
| **d3-selection** | ^3.0 | DOM manipulation for D3 graphs |
| **d3-zoom** | ^3.0 | Zoom/pan behavior for D3 graphs |
| **@xyflow/svelte** | ^1.0 | Interactive node-edge diagrams (FlowDiagram, StateDiagram) |
| **maplibre-gl** | ^5.0 | WebGL map rendering engine |
| **svelte-maplibre-gl** | ^1.0 | Svelte component bindings for MapLibre GL |

**Chart.js** handles standard statistical charts well. Tree-shakeable imports keep bundle size low. The wrapper components (`BarChart`, `LineChart`, etc.) handle canvas lifecycle and SSR safety.

**D3 modules** are used for layout math only — computing positions, not rendering. Svelte renders the SVG. This keeps D3 out of the reactivity system and avoids conflicts.

**@xyflow/svelte** (Svelte Flow) provides the canvas and interaction model for diagrams. Custom node types (`flow`, `state`, `start`, `end`) are defined as Svelte components.

**MapLibre GL** is an open-source WebGL map renderer. It uses CartoDB tiles (Voyager for light mode, Dark Matter for dark mode), so no API key is required. `svelte-maplibre-gl` provides reactive component bindings.

**Zero-dependency components** — `SimpleChart`, `Sparkline`, and `Gauge` are pure SVG with no external dependencies. Use these when a full Chart.js instance would be overkill (e.g., sparklines in tables, single-value meters in dashboards).

## How it works

Each visualization category lives under `src/routes/showcases/viz/`:

```
/showcases/viz/
├── charts/      — Chart.js bar, line, area, pie, radar, bubble; SVG sparkline, gauge, treemap
├── plots/       — Chart.js scatter; canvas heatmap
├── graphs/      — D3 network, tree, DAG, Sankey, knowledge graph
├── diagrams/    — @xyflow/svelte flow and state diagrams
└── maps/        — MapLibre GL base map, markers, GeoJSON choropleth
```

Shared components in `_components/`:
- `VizDemoCard` — wraps each demo with visualization, data table, and code tabs
- `DataControls` — dataset and animation toggles used by the charts page

The `theme-bridge` utility (`$lib/components/viz/_shared/theme-bridge`) reads CSS custom properties at runtime to derive the visualization color palette from the app's design tokens.

## Known limitations

**SSR incompatibility:**
- Chart.js, MapLibre GL, and D3 force/zoom all require browser APIs
- Pages that use these must guard against SSR: check `browser` before rendering, or use `export const ssr = false`
- The charts page uses `$state(browser ? getVizPalette() : [])` to safely skip palette resolution on the server

**Chart.js canvas cleanup:**
- Canvas elements don't auto-cleanup on component unmount in Svelte 5
- Each chart wrapper calls `chart.destroy()` in `onDestroy` — required to prevent "canvas already in use" errors on HMR

**D3 and Svelte reactivity:**
- D3 force simulations run outside Svelte's reactivity system
- Node positions update via direct DOM mutation, not `$state`
- This is intentional — running a physics simulation through the reactive graph would be extremely slow

**@xyflow/svelte diagram sizing:**
- `FlowDiagram` and `StateDiagram` require a fixed-height container
- The parent must set an explicit height; the component fills 100% of it
- Dynamic height from content is not supported by Svelte Flow

**MapLibre tile provider:**
- Default tiles come from CartoDB's public CDN — no API key needed, but subject to their usage policy
- Heavy production usage requires a tile provider (Mapbox, Stadia, self-hosted)

**d3-dag bundle size:**
- `d3-dag` adds ~80KB (minified) for the Sugiyama algorithm
- Only import `DagGraph` on pages that need it; don't include it in a shared barrel export loaded globally

## Related

- [3d-web.md](./3d-web.md) — WebGL-based 3D rendering (Three.js, Threlte)
- [../core/sveltekit.md](../core/sveltekit.md) — SSR/CSR configuration, `browser` guard
- [Showcase: /showcases/viz](../../../../src/routes/showcases/viz/+page.svelte) — hub page
