---
title: "Data visualization"
description: "Svelte components over specialised renderers, each loaded only in the browser: Chart.js charts and scatter plots with an SSR-safe canvas lifecycle, a canvas…"
category: "Data Viz"
---

# Data visualization

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Data Viz · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — frontend only

Svelte components over specialised renderers, each loaded only in the browser: Chart.js charts and scatter plots with an SSR-safe canvas lifecycle, a canvas heatmap, @xyflow flow and state diagrams, MapLibre maps with GeoJSON choropleths, and timelines of dated events.

**When to use:** Reach for it when a page needs a standard chart, plot, diagram, map or timeline backed by a proven renderer rather than a custom SVG visualization.

**Needs:** v10r's implementation uses external-api

## Docs

- [docs/stack/capabilities/viz.md](/docs/stack/viz) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/capabilities/viz.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/capabilities/viz.md))

## Code

- `src/lib/components/viz/chart/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/viz/chart) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/viz/chart))
- `src/lib/components/viz/plot/` — Plots — Chart.js scatter plots and a canvas-based heatmap component for visualizing continuous or correlated data. Use when a dataset calls for a scatter plot or heatmap rather than a categorical chart. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/viz/plot) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/viz/plot))
- `src/lib/components/viz/diagram/` — Diagrams — @xyflow/svelte-based flow and state diagram components with custom node types for interactive node-edge visualizations. Use when building an interactive flowchart or state-machine diagram that needs draggable, connectable nodes. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/viz/diagram) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/viz/diagram))
- `src/lib/components/viz/map/` — Maps — MapLibre GL components for a base map, markers, and GeoJSON choropleth overlays, using free CartoDB tiles. Use when a page needs an interactive WebGL map with markers or geographic data overlays. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/viz/map) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/viz/map))
- `src/lib/components/viz/timeline/` — Timelines — Timeline visualization components for displaying a sequence of dated events. Use when presenting chronological events or milestones rather than numeric data. ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/viz/timeline) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/viz/timeline))

## Proof

- [`/showcases/viz/charts`](/showcases/viz/charts)
- [`/showcases/viz/plots`](/showcases/viz/plots) — Plots
- [`/showcases/viz/diagrams`](/showcases/viz/diagrams) — Diagrams
- [`/showcases/viz/maps`](/showcases/viz/maps) — Maps

## Relationships

**Applies (principles to review the work against)**

- [Design philosophy & three-tier theming](/docs/pattern-library/design-philosophy) — Visual design decisions and new tokens in these records follow its content-first, accessibility-driven principles and the three-tier token layering.

**Assumes (platform conventions in scope)**

- [Component-first UI system](/docs/pattern-library/component-system) — UI records are built from the layered component system (component-first); they assume it rather than build it.


---

_Machine-readable record: `data-visualization` in `pattern-library/registry.json`._
