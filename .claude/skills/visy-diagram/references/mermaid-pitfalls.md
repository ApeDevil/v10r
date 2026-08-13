# Mermaid pitfalls — the pre-flight linter

Walk the final checklist (§5) against every Mermaid block before calling it done. These rules exist because each item is a real, recurring LLM failure that either breaks the parser outright or — worse — renders silently wrong.

## Contents

1. Parser breakers (red box, no diagram)
2. Silent corrupters (renders, but wrong)
3. Layout & size
4. Version & renderer targeting
5. Final checklist

## 1. Parser breakers (red box, no diagram)

- **Lowercase `end`** as a flowchart node breaks the whole diagram. Use `End`, `END`, or quote it: `stop["end"]`.
- **Reserved words as bare node IDs**: `end`, `default`, `style`, `linkStyle`, `classDef`, `class`, `click`, `href`, `call`, `interpolate`. Use a safe ID with a quoted label.
- **Unquoted special characters** in labels: `( ) [ ] { } / \ : ; # @ ! ? < > " '`. Quote the label: `A["parse(input, opts)"]`. Literal characters that still conflict use base-10 entity escapes: `#35;` for `#`, `#59;` for `;`.
- **Comments are `%%`**, never a single `%` — one `%` kills the diagram.
- **Frontmatter `---`** must be the only content on line 1, no leading whitespace — anything else before it breaks parsing.
- **Semicolon in sequence-diagram text** is a line break; write `#59;` for a literal semicolon.
- **`stroke-dasharray: 5,5`** — escape the comma: `stroke-dasharray: 5\,5`.
- **`linkStyle` with a hex color as the last attribute** is a parse error — put the hex first, or use a named CSS color.
- **Class diagrams**: relationships and notes must sit *outside* `namespace` blocks; namespaces cannot nest.
- **Architecture-beta labels** accept only `[a-zA-Z0-9_ ]` — hyphens break them.

## 2. Silent corrupters (renders, but wrong)

- **Node IDs or edge labels starting with `o` or `x`** create unintended circle/cross edge types: `A---oB` is a circle edge, `-->|ok|` a circle-tipped edge. Use full descriptive IDs; capitalize or lead the label with a space.
- **`->` instead of `-->`** — the single most common mechanical slip; renders as a different edge or errors depending on type.
- **Backticks inside labels** silently break GitHub rendering. They creep in from code-formatting habits — strip them inside `["..."]`.
- **Mermaid v11 renders all labels as Markdown**: `snake_case` becomes *italic*. Quote labels to keep them literal.
- **Duplicate node IDs** with conflicting labels: the second label is silently ignored, not an error.
- **`---` (arrowless) edges render *with* an arrow** on Mermaid 11.0–11.4; arrowless needs ≥11.5.
- **Mindmap `<`** renders as `&lt;` — use words instead of angle brackets.

## 3. Layout & size

- Declaration order determines rank. To move a node, move its source line.
- Back-edges (cycles) cause most crossings — minimize them, or switch to `stateDiagram-v2` if cycles are the subject.
- Flip `TD`↔`LR` before reaching for styling: TD for narrow columns and docs, LR for wide screens and parallel lanes.
- Long labels blow up node width — rely on markdown auto-wrap (≥10.1); `<br/>` is legacy.
- Link to nodes *inside* subgraphs, never to the subgraph ID itself — and note a subgraph's `direction` is ignored once any external edge touches it.
- `maxTextSize`/`maxEdges` are secure settings — configurable only via `mermaid.initialize()`, not frontmatter.

## 4. Version & renderer targeting

- **State the target renderer** (GitHub, Claude artifact, mermaid-cli, docs site) — they pin different Mermaid versions, and a diagram valid in one can break in another. Validate against the target, not against "Mermaid".
- **Stable core** (safe everywhere): `flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `classDiagram`, `erDiagram`, `gitGraph`, `journey`, `mindmap`, `timeline`, `quadrantChart`.
- **Beta/experimental** (verify the renderer first): sankey, xychart, block, packet, architecture, C4, kanban, radar, treemap, venn.
- **Version-gated syntax**: `A@{ shape: ... }` needs ≥11.3; edge IDs and animation ≥11.10; icon packs ≥11.7.
- Prefer `flowchart` over the legacy `graph` keyword; prefer `A["label"]` over `A(label)`.

## 5. Final checklist

1. Every label quoted?
2. No reserved-word IDs, no IDs or edge labels starting with `o`/`x`?
3. All arrows `-->` / `---` / correctly typed — no bare `->`?
4. Comments are `%%`?
5. Frontmatter `---` alone on line 1, or absent?
6. Diagram type is stable-core, or the target renderer is verified to support it?
7. No backticks inside labels?
8. Node count within budget (see the `visy` router skill)?
9. Declaration order matches the intended layout?
10. Rendered and *looked at* — no clipping, overlap, or disconnected arrows?
