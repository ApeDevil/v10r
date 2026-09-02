# `$lib/showcases`

Everything the showcase pages need that is not the page itself.

- `catalog/` — the index of *all* showcases: the card tree, in-page section anchors, and
  doc-link resolution. Read by the hub, the sidebar nav, both search lanes, the sitemap,
  and the Neo4j catalog projection.
- `ai/`, `auth/`, `ax/`, `mcp/` — fixtures and helpers belonging to *one* showcase, named
  for the route under `(public)/showcases/` that consumes them.

These were previously two sibling directories, `showcase/` and `showcases/`, distinguished
only by a final `s`. The split is real; the names did not carry it.
