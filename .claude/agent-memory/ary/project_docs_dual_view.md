---
name: docs-dual-view
description: docs/ has two cross-cutting whole-system views — system-abstraction.md (runtime) + codebase-organization.md (spatial). Keep them complementary, not duplicative.
metadata:
  type: project
---

The repo's top-level `docs/` deliberately carries **two whole-system companion docs** that sit above the foundation/stack/blueprint/guides subtrees:

- `docs/system-abstraction.md` — the **runtime/conceptual** view: the 7-layer abstraction hierarchy (Tech Stack → Architecture → Services → Modules → Components → Classes/Functions → Code), runtime data flow, the `hooks.server.ts` composition root (12-stage `sequence()`), and the hexagonal multi-client core wiring.
- `docs/codebase-organization.md` — the **spatial/navigational** companion authored May 2026 from an `ary` structural analysis (handed to `docy`): "Where do I find X? Where do I put new code?" — top-level layout, `$lib/` taxonomy, db parallel-tree, component barrel boundary, route tree, naming + import-direction rules, canonical-home heuristic, drift list.

**Why:** v10r docs are load-bearing (new projects emulate them; showcases test them). The two views must not duplicate — system-abstraction owns *how it flows*, codebase-organization owns *where it lives*.

**How to apply:** When asked about file placement / source-tree structure, codebase-organization.md is the canonical doc to update. When the question is runtime/causal, defer to system-abstraction.md. Both must stay accurate to the live tree — verify against the filesystem, never infer. Related: [[tree-structural-facts]].
