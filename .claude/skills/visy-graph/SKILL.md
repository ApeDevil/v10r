---
name: visy-graph
description: Depict graphs and networks — trees, DAGs, dependency graphs, sankeys, knowledge graphs — with the layout engine that matches the graph's true shape, and hairball avoidance above ~50 nodes. Use whenever visualizing dependencies, imports, call graphs, topology, entity networks, hierarchies, or flow volumes, or when a node-link view has become an unreadable hairball. Layout is chosen by graph kind (layered for DAGs, force only for communities), and filtering/clustering comes before drawing at scale.
metadata:
  family: visy
---

# Graph & network depiction

The layout algorithm is part of the argument: force-directing a dependency graph hides its direction; layering a social network invents a hierarchy that isn't there. Choose layout by the graph's true shape, then budget for scale. Syntax mechanics and validation live in `visy-diagram`.

## Layout follows the graph's true shape

| Graph kind | Layout | Engine (static / in-app) |
|---|---|---|
| Strict hierarchy (tree) | Tidy tree; treemap when quantities matter | Mermaid flowchart or mindmap / `TreeGraph`, `Treemap` (d3-hierarchy) |
| Partial order — dependencies, pipelines | Layered (Sugiyama): ranks make direction visible | Graphviz `dot` / `DagGraph` (d3-dag) |
| Undirected relations, communities | Force-directed — only when clusters *are* the message | Graphviz `sfdp` / `NetworkGraph` (d3-force) |
| Weighted flow between stages | Sankey | `SankeyDiagram` (d3-sankey); Mermaid sankey is beta |
| Containment + edges (nested systems) | Hierarchical with containment | Subgraphs; `KnowledgeGraph` for entity exploration |

## Scale rules

- **< 25 nodes**: any engine works; a static diagram is fine.
- **25–50 nodes**: cluster into subgraphs or split by concern; prefer an interactive view (zoom/filter) over a static image.
- **> 50 nodes**: do not draw it raw — node-link legibility collapses. First reduce: filter to an ego-network around the node in question, aggregate to communities/packages, or table the top-N edges. A reduced graph that answers the question beats a complete graph that answers nothing.
- **Machine-derived graphs** (import graphs, schema FKs, call graphs): generate DOT programmatically from the data and let the engine place nodes. Never hand-transcribe node lists — transcription errors in a graph are invisible.

## Hairball first aid

When a graph view is unreadable, apply in order — styling last, not first:

1. Filter — drop nodes/edges not serving the claim.
2. Cluster — collapse communities into single nodes with counts.
3. Split — one view per concern (one package's dependencies, not all).
4. Change form — an adjacency table or top-N edge list often answers the actual question better.

## Reading this repo's own graphs

- The import graph is a DAG **by invariant** — depict its direction; `db/` is the sink everything flows toward. A cycle in a depiction of it is a bug report, not a style choice.
- Interactive components live in `$lib/components/viz` (deep import only — bundle boundary): `NetworkGraph`, `TreeGraph`, `DagGraph`, `SankeyDiagram`, `KnowledgeGraph`, all taking `GraphData` (`{nodes, edges}`). D3 computes positions; Svelte renders the SVG — keep that split.
- `d3-dag` costs ~80KB minified: import `DagGraph` page-locally, never through a shared barrel.
- D3 force/zoom need `browser` guards (SSR).
