---
name: visy-chart
description: Chart and plot data honestly, with the chart type chosen by the question and colors drawn from the project's token palette. Use whenever creating or reviewing a chart, plot, dashboard tile, sparkline, gauge, heatmap, or data visualization, and when choosing between a table and a chart. Encodes chart-by-question selection, perceptual ranking, honesty rules (zero baselines, no dual axes), colorblind-safe encoding via --chart-1..8 tokens (never hardcoded colors), and this repo's Chart.js wrappers with their SSR gotchas.
metadata:
  family: visy
---

# Data visualization

A chart answers a question about data. Name the question first; if the question is "what is the exact value of X", the answer is a table, not a chart (see the `visy` router skill).

## Chart by question

| Question | Chart |
|---|---|
| How do categories compare? | Bar (horizontal when labels are long) |
| How did it change over time? | Line; area only when the sum is meaningful |
| How is it distributed? | Histogram / box plot |
| Do two variables relate? | Scatter; bubble for a third variable |
| What are the parts of the whole? | Stacked bar or treemap; pie only with ≤5 slices |
| How much flows from A to B? | Sankey |
| Single value against a target? | Gauge or a stat tile with a sparkline |
| Intensity across a matrix? | Heatmap |
| Where does the time go? | Waterfall |

Rationale: readers decode position and length far more accurately than angle, area, or color (Cleveland–McGill). That is why bar beats pie, why direct labels beat legends, and why color should carry redundancy, not the sole signal.

## Honesty rules

- Bar baselines start at zero — a truncated bar axis is a lie about magnitude. (Lines may zoom; annotate the range.)
- No dual y-axes for unrelated units; use two charts.
- No 3D, ever. No rainbow colormaps — sequential for magnitude, diverging only around a meaningful midpoint.
- Don't cherry-pick time ranges to flatter a trend; annotate gaps instead of silently interpolating.
- Never encode by hue alone (~8% of men are colorblind) — pair color with position, shape, or a direct label.

## Color = tokens, always

- Series palette: `getVizPalette()` from `$lib/components/viz/_shared/theme-bridge` → `--chart-1..8` (defined for light *and* dark in `src/app.css`). Grid/axis/label/tooltip come from `--chart-grid`, `--chart-axis`, `--chart-label`, `--chart-tooltip-bg`.
- Hardcoding a color in a visualization violates the project's token rule and breaks dark mode. Check every chart in both themes.
- Theme changes at runtime: subscribe via `onThemeChange()` — the wrappers already do.

## Project components — which one when

| Need | Component |
|---|---|
| Standard statistical charts | `BarChart`, `LineChart`, `AreaChart`, `PieChart`, `RadarChart`, `BubbleChart` (Chart.js) |
| Scatter / matrix | `ScatterPlot`, `HeatMap` |
| Inline in tables, stat tiles, dashboards | `Sparkline`, `Gauge`, `SimpleChart` — zero-dependency SVG, no Chart.js cost |
| Part-of-whole with area | `Treemap` |
| Duration cascade | `Waterfall` |
| No data / failed load | `ChartEmpty` / `ChartError` — never an empty white box |

Deep-import from `$lib/components/viz` — the viz tree is deliberately excluded from the root component barrel (bundle-size boundary).

## SSR & lifecycle gotchas

- Chart.js, MapLibre, and D3 force/zoom need the browser: guard with `browser` (`$state(browser ? getVizPalette() : [])`) or `export const ssr = false`.
- The wrappers call `chart.destroy()` on unmount — required to avoid "canvas already in use" on HMR; keep that if writing a new wrapper.
- Reference: `docs/stack/capabilities/viz.md`; live proof: `/showcases/viz`.

## Outside the app (docs, artifacts, chat)

For fewer than ~8 values, a markdown table usually beats a chart. Mermaid's `xychart` is beta — verify the target renderer supports it, or build the chart in an artifact instead.
