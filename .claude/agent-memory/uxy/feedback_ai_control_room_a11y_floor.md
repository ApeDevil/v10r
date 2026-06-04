---
name: ai-control-room-a11y-floor
description: A11y floor for the admin AI control-room section — diagrams need text/table equivalents, no color-only signals, focus-to-heading on route change
metadata:
  type: feedback
---

The admin AI section (`/admin/ai/*`) doubles as living documentation, so its two visualizations (nRAG pipeline + tool topology) MUST ship a perceivable text/table equivalent as the PRIMARY layer; any SVG/flow diagram is a progressive-enhancement layer on top, `aria-hidden="true"` only when the table fully duplicates it.

**Why:** A diagram-only viz fails three WCAG Level-A criteria at once — 1.1.1 (Non-text Content), 1.4.1 (Use of Color), 2.1.1 (Keyboard). The section is admin-facing docs; the table IS the documentation and is what screen-reader/keyboard users read.

**How to apply:** Verified-live gaps in the current `/admin/ai/+page.svelte` to fix in the refactor:
- Volume chart bars use `title=""` on non-focusable `<div>` (mouse-only) → pair with an sr-only or visible data-table of date+count.
- No `<h1>` on the page; panels are `<h2>` with no parent heading → add one `<h1>` per route (section/sub-section name), panels become `<h2>`.
- Skeleton pulse animation has no `prefers-reduced-motion` guard → gate the pulse, drop to static tint.
- Risk/scope badges must use text+icon+shape, never a bare colored dot (project also forbids color-only). The existing provider-status row (health-dot + text Badge) is the correct precedent to copy.
- SvelteKit does NOT move focus on route change → each AI sub-route needs a focus-to-h1 hook so SR/keyboard users aren't dumped at the unchanged shell top (focus-loss-on-route-change is forbidden).
- Sub-nav must be link-based with `aria-current="page"`, NOT NavTab's role=tab — see [[navtab-role-tab-defect]].
- Telemetry-gap panels (usage-by-model, tool-success-rate) must render an honest "not yet captured" empty state (EmptyState exists, role=status), never a fake/zeroed chart.
