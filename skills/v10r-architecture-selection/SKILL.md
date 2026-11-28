---
name: v10r-architecture-selection
description: "Choose which v10r SvelteKit reference patterns to emulate, and in what order, for a new project or a new capability. Use when planning an app architecture or a feature that spans several concerns (Foundations, Data, Identity & Safety, Intelligence, Features, Velocity, Integrity), before reading any single pattern: it maps the 170 registry patterns to the v10r group agent skills, explains infrastructure needs and typed relationships (builds on, composes, specializes), and how to use the v10r Pattern MCP tools recommend_emulation_plan and get_pattern when connected."
license: MIT
metadata:
  source: "v10r pattern-library registry"
  registry-digest: "645006606b7c9657"
  generated: "true"
---

# Choosing v10r patterns

> Generated from `pattern-library/registry.json` by `scripts/agent-skills/build.ts` — do not edit; change the registry and run `bun run skills:build`.

## When to use

Use this before any v10r group agent skill when the task is "what should this project be built from?" — a new app, a feature that crosses domains, or a review of whether an existing design over-reaches. It is the routing layer; the pattern detail lives in the group agent skills.

## Method

1. **Name the capabilities** the project needs, in plain words ("background jobs", "layered RAG", "rate limiting").
2. **Name the target infrastructure** using the registry's closed vocabulary of capabilities: `relational-db`, `vector-search`, `graph-db`, `key-value-store`, `object-storage`, `scheduler`, `llm-provider`, `email-delivery`, `external-api`, `web-worker`, `service-worker`, `wasm-toolchain`, `container-host` (a technology such as `postgres` or `redis` also works). Unknown is not the same as missing — ask rather than assume. Each pattern states its needs by level: *required*, *conditional* (with the condition), *optional*, or *v10r's implementation uses* (not needed to emulate it).
3. **With the v10r Pattern MCP connected** (hosted `https://www.v10r.dev/api/mcp/public`, or the local stdio server in `mcp/`):
   - `recommend_emulation_plan {capabilities, target_infra}` returns a plan ordered foundations and constituents first; each step carries why it is included, its contraindications, its infrastructure needs by level (including what its foundations and constituents require) and a fit verdict against `target_infra`. Conditional and optional constituents are listed as open decisions, never added silently. It never drops a step itself — you do, when a step's *Avoid when* describes the target.
   - `get_pattern {ids, sections: ["fitness", "invariants", "emulation_notes"]}` reads up to five cards at once; `search_patterns {query: "*"}` lists the category map.
4. **Without the MCP**, do the same by hand:
   - find candidates in the group agent skills below (each has a full pattern index);
   - expand every candidate through what it *builds on* and its *required* constituents, and the foundations and constituents of what it *specializes* (the generalization itself is never a second step) — [references/relationship-graph.md](references/relationship-graph.md) lists every relationship and a build order;
   - decide each *conditional* constituent against the target (adopt it when its condition holds) and each *optional* one on its merits; never add or drop one silently;
   - union the *required* and *conditional* needs of the whole set, including those of foundations and constituents, and compare them with the target (an *optional* or *v10r's implementation uses* need never rules a pattern out);
   - drop any pattern whose *Avoid when* matches, and prefer a listed *Alternative* when its condition holds.
5. **Build foundations and constituents first**, one pattern at a time, keeping each deep card's invariants (and those it inherits by specialization).

Fewer patterns is the better plan: catalogs over-recommend, and every adopted pattern is code the project must own.

Maturity is evidence, not opinion: **proven** = a linked test or showcase, verified at a recorded date; **implemented** = the code exists but no proof surface is linked; **planned** = design only. Treat implemented and planned rows as unverified.

## Group agent skills

| Agent skill | Covers | Patterns (deep) |
|---|---|---|
| `v10r-foundations` | Architecture & Request Pipeline, App Shell & Navigation, UI Components & Design System, Forms & Validation, Internationalization (i18n), Docs & Agent Experience | 50 (16) |
| `v10r-data` | Databases & Storage, Database Operations | 12 (0) |
| `v10r-identity-safety` | Identity & Access, Anti-Abuse, Admin & Privacy | 17 (1) |
| `v10r-intelligence` | AI, Office Workflows | 26 (13) |
| `v10r-features` | Analytics, Notifications, Jobs & Scheduling, PWA, Data Viz, 3D, Content & Blog, Desk Workspace, External Integrations | 34 (7) |
| `v10r-velocity` | Interaction Velocity, Data Velocity, Runtime Velocity, Velocity Measurement | 22 (19) |
| `v10r-integrity` | Truth & Evidence, Derivation & Provenance, Durable Execution | 9 (8) |
