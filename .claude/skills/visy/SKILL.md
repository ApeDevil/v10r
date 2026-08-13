---
name: visy
description: Choose the right visual representation before writing any diagram or chart syntax. Use whenever a system, process, dataset, schema, or idea needs to be depicted, visualized, mapped, modeled, drawn, or explained visually and the form is not already fixed — and when deciding between prose, table, chart, and diagram. Routes to the visy-* leaf skills (diagram, process, graph, chart, story) and stops wrong forms early, before syntax is written. Also use when an existing visual feels cluttered, overloaded, or unconvincing.
metadata:
  family: visy
---

# Choosing a visual representation

Form first, notation second. A wrong form polished is still wrong — the most expensive diagram mistake is made before the first line of syntax. Work through the four steps in order.

**Keywords**: visualize, depict, illustrate, diagram, map, model, schematic, chart, graph, plot, render, present, communicate.

## Step 1 — Should this be visual at all?

| Signal | Form |
|---|---|
| Exact values, lookup-by-key, audit trail | Table — not a chart |
| Linear sequence, no branching | Prose or a numbered list — not a flowchart |
| Three facts or fewer | A sentence |
| Terminal output about to exceed 4 rows or 3 columns | A rendered table |
| Relationships, topology, parallelism, "who talks to whom" | Diagram |
| Quantitative pattern — trend, comparison, distribution, correlation | Chart |
| Geographic/spatial data | Map |

A diagram of a linear process adds ink, not information. Saying "this should be prose" is a valid, complete answer.

## Step 2 — Match the shape of the claim to the form

Map the *structure of the claim*, not the topic, to a type:

| Shape of the claim | Form | Leaf skill |
|---|---|---|
| Branching decisions, fan-out/convergence | Flowchart | visy-process |
| Ordered messages between actors over time | Sequence diagram | visy-process |
| One entity's lifecycle/modes and transitions | State diagram | visy-process |
| Entities and cardinality | ER diagram | visy-diagram |
| Dependencies, build/import order | Layered DAG | visy-graph |
| Who-connects-to-whom, communities | Network graph | visy-graph |
| Proportional flow volume | Sankey | visy-graph |
| Taxonomy, containment hierarchy | Tree / treemap | visy-graph |
| System layers by audience (zoom levels) | C4 views | visy-story |
| Comparison, time series, distribution, correlation, part-of-whole | Chart | visy-chart |
| An explanation spanning several views | Narrative sequence | visy-story |

If the claim has no shape — no branching, no actors, no topology, no quantity — return to Step 1: it probably wants prose.

## Step 3 — Budget and split

- One abstraction level per view. Mixing overview boxes with function-level detail is the most common readability failure — split into two views instead.
- Node budgets (convention, not law): ~5–7 for a conceptual view, ~10–20 for a technical view, hard split above ~25. Node-link legibility is known to collapse past ~50.
- The A4 test: if it would not be readable printed on one A4 page, split it.
- Multiple simple views beat one dense view. Readers consult the one matching their concern.
- If the subject genuinely resists simplification, that is a finding about the *system*, not the diagram — report it alongside the visual.

## Step 4 — Route to the leaf skill

| Skill | Load when |
|---|---|
| `.claude/skills/visy-diagram/SKILL.md` | About to write any diagram syntax (Mermaid, DOT, SVG, ASCII) — mechanics, pitfalls, validation loop |
| `.claude/skills/visy-process/SKILL.md` | The subject is behavior: a flow, lifecycle, pipeline, or interaction |
| `.claude/skills/visy-graph/SKILL.md` | The subject is a network, tree, DAG, or flow-volume graph |
| `.claude/skills/visy-chart/SKILL.md` | The subject is data: charts, plots, dashboards, sparklines |
| `.claude/skills/visy-story/SKILL.md` | The explanation spans multiple views, levels, or an audience ladder |

For substantial multi-view work, delegate to the `visy` subagent — it uses this skill family as its method library.

## Quality tests — run before delivering any visual

1. **Isomorphism test**: strip the labels — does the structure alone still carry the claim? If not, redesign; the form is decorative.
2. **Education test**: does it teach real names and real shapes (`authCaptchaGate → authHandler`, `POST /api/mcp/public`), or just label boxes (`Service A → Service B`)?
3. **Arrow audit**: every edge has stated semantics (sync/async, always/conditional) or a legend entry.
4. **A4 test**: readable on one page, or split.
