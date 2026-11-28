---
name: v10r-architecture-selection
description: "Choose which v10r SvelteKit reference patterns to emulate, and in what order, for a new project or a new capability. Use when planning an app architecture or a feature that spans several concerns (Foundations, Data, Identity & Safety, Intelligence, Features, Velocity, Integrity), before reading any single pattern: it maps the 171 registry patterns to the v10r group agent skills, explains infrastructure needs and typed relationships (builds on, composes, specializes), and how to use the v10r Pattern MCP tools recommend_emulation_plan and get_pattern when connected."
license: MIT
metadata:
  source: "v10r pattern-library registry"
  registry-digest: "5763b3ac186c316e"
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
   - **Discover**: `search_patterns` (`{query: "*"}` lists the category map), `trace_capability` (the records that *own* a capability first, then those only related to it) and `explore_patterns` (the relationship graph).
   - **Select**: read candidates with `get_pattern {ids, sections: ["fitness", "invariants", "emulation_notes"]}` (up to five cards) and choose canonical ids. A name or a declared capability is evidence; a keyword is only a related term.
   - **Assemble**: `recommend_emulation_plan {ids, target_infra, target_lacks, target_has}` returns one deterministic plan, foundations and constituents first; every step says why it is there, and patterns are *implemented*, workflows *performed*, principles *applied* (never steps). With `capabilities` instead of ids, each request is selected and explained, and an ambiguous one comes back with its candidates and a recovery call — never guessed. Conditional constituents are open decisions until you settle them with `conditions` (by the condition id the plan prints); optional ones are adopted only with `select` or an explicit request. A need the target lacks blocks its step and names what stands on it; an unlisted need is unknown, not absent. It never drops a step itself — you do, when a step's *Avoid when* describes the target.
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
| `v10r-features` | Analytics, Notifications, Jobs & Scheduling, PWA, Data Viz, 3D, Content & Blog, Desk Workspace, External Integrations | 35 (8) |
| `v10r-velocity` | Interaction Velocity, Data Velocity, Runtime Velocity, Velocity Measurement | 22 (19) |
| `v10r-integrity` | Truth & Evidence, Derivation & Provenance, Durable Execution | 9 (8) |
