---
name: visy-diagram
description: Author diagrams as code — Mermaid first — with validated syntax and engine-placed layout. Use whenever writing or fixing Mermaid, a flowchart, sequence, state, ER, class, or architecture diagram, Graphviz/DOT, diagram SVG, or ASCII art, for docs, READMEs, PRs, artifacts, or chat. Read references/mermaid-pitfalls.md before emitting Mermaid: LLM-typical syntax errors fail silently in most renderers, and the checklist there is the linter. Encodes notation choice, layout discipline, and the bounded validate→render→look loop.
metadata:
  family: visy
---

# Diagrams as code

Never hand-place coordinates for anything with routed edges — sequential text generation cannot do collision detection or edge routing. Emit a DSL and let a layout engine place the nodes. Choose the form first (see the `visy` router skill); this skill covers getting the chosen diagram onto the page correctly.

## Notation choice

| Notation | Use when | Why |
|---|---|---|
| **Mermaid** (default) | Anything embedded in markdown: docs, READMEs, PRs, artifacts | Renders natively on GitHub and in Claude artifacts, zero toolchain; the model knows it best |
| **Graphviz/DOT** | >30 nodes, or the graph is machine-derived from data | Deterministic layout engines (`dot`, `sfdp`) that scale where Mermaid's layout degrades |
| **Inline SVG** | Fixed, known geometry only: legends, annotated figures, bespoke marks | Full control — but no engine catches overlap, so only when geometry is the point |
| **ASCII** | Terminal-only contexts, and only via a grid-math script | Freehand ASCII alignment fails; column math must own placement |

Avoid D2 (renders natively nowhere, needs a build step, layout engine that distinguishes it is proprietary) and PlantUML (JVM + Graphviz toolchain with documented version incompatibilities).

Stick to Mermaid's stable core: `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`, `gitGraph`, `journey`, `mindmap`, `timeline`, `quadrantChart`. The beta types (sankey, xychart, block, architecture, C4, kanban, radar, treemap) render inconsistently across hosts — use them only after verifying the target renderer supports them.

## Author in two phases

Plan in prose before emitting any syntax:

1. **Plan**: the claim, the node list with *real names from the repo* (Grep if unsure), the edge list with semantics (sync/async, always/conditional), and the orientation (TD for narrow/docs, LR for wide/parallel flows).
2. **Emit**, using layout-as-source discipline:
   - Declaration order determines rank — reordering source lines *is* a layout action.
   - Group related nodes adjacently in source; use subgraphs to constrain placement.
   - Minimize back-edges — they cause most crossings. A cycle-heavy flowchart usually wants to be a state diagram.
   - Flip TD↔LR as the first fix when crossings persist, before any styling.
   - Quote every label; keep long labels short and let markdown auto-wrap handle the rest.

## Validate → render → look

Silent failure is the norm: most hosts show a generic red box and the error never reaches you. Never assume "no complaint = it rendered."

1. **Checklist-validate** against `references/mermaid-pitfalls.md` — walk its final checklist line by line. That file is the linter.
2. **Render where a renderer exists**: an artifact preview, a GitHub PR preview, or `bunx @probelabs/maid` if it is available (parser-only, no Chromium). Do not paste internal architecture into third-party renderers (kroki.io, mermaid.live) — that ships the source off-box.
3. **Look at the render**: text overflow and clipping first (the most common, always user-visible defect), then overlapping nodes, then disconnected or mis-routed arrows.
4. **Bound the loop**: at most 2 syntax-fix rounds and 2 visual-fix rounds, then stop and report what is still wrong instead of looping.

## Where diagrams live in this repo

- **GitHub-rendered markdown** (README, PRs) — Mermaid renders natively.
- **Claude artifacts** — Mermaid fences render natively.
- **`docs/**`** — also the RAG corpus: a text notation degrades gracefully into retrieval chunks; binary images do not. Prefer Mermaid-in-markdown over images.
- **In-app interactive diagrams** — do not embed Mermaid; use the project components instead (`FlowDiagram`/`StateDiagram` via visy-process, graphs via visy-graph).
