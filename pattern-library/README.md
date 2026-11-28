# `pattern-library/`

The product. Curated pattern records that a coding agent reads to emulate v10r's stack
rather than clone it.

| File | Role |
|---|---|
| `registry.json` | The complete two-tier record set — deep emulation cards (invariants + emulation notes) and light index rows — each carrying a machine-checked `maturity` grade (`proven` ⇔ linked test/showcase + `verifiedAt`), plus the `groups`/`categories` taxonomy that orders every generated surface |
| `schema.ts` | What a pattern *is*: types, structural validation, topological sort, and the fitness vocabulary (`avoid_when`, `alternatives`, infrastructure `needs` from `INFRASTRUCTURE_NEEDS` with their levels) that says when *not* to adopt one, and the registry `format`. The single declaration, shared by every reader |
| `search.ts` | The one tokenizer and scorer behind every search over the registry (both MCP transports, Vely's `search_pattern_library`) |
| `query.ts` | The registry query layer: the MCP tool contract (definitions, bounds, next-actions convention) and the four registry tools, written once for both transports — including the fitness block (infrastructure needs by level, inherited from dependencies; avoid when; alternatives) every card and plan step prints before the how |
| `infrastructure-needs.ts` | What adopting a pattern takes in infrastructure: own and inherited needs by level, the one label every surface prints, and whether a `target_infra` provides a need. Framework-free |
| `infrastructure-evidence.ts` | The import scan behind the needs gate: maps the direct adapter imports of a record's code refs to needs, with the survey-ref exemptions. Bun/Node only (filesystem) |
| `registry-digest.ts` | The registry's content identity (SHA-256 of its canonical JSON), carried by benchmarks, skills and tool metadata instead of a version string. Server-side only (`node:crypto`) |
| `excerpt.ts` | Renders a file's text as a bounded, line-numbered `get_file_excerpt` answer; each transport keeps only its own reader |
| `bench/` | Retrieval benchmark fixtures: the dev and blind holdout query sets, scripted agent workflows, and the committed baseline (`bun run mcp:bench`); the composition benchmark: design and holdout scenarios, its baseline and latest results (`bun run patterns:bench`) |
| `load.ts` | Reads the registry off disk. Bun-only (`import.meta.dir`), which is why it is separate from `schema.ts` |
| `validate.ts` | Drift guard: every referenced path must exist, every showcase href must be registered, the dependency graph must be acyclic, every infrastructure adapter a record's code imports must be declared as a need, every Architecture Engineering node-kind need must be declared by one of its patterns, and titles carry no volatile facts. Wired into `bun run validate` as `patterns:validate` |

## Why it lives outside `src/`

`mcp/server.ts` runs under bare Bun in an ephemeral, network-less container with a
read-only repo mount — no Vite, no alias resolution — so it must reach `registry.json` by
relative path. The app reaches the same file through the `#patterns/*` subpath import
(package.json `imports`). One record set, no copies — and the same holds for the code that
answers queries over it: `search.ts`, `query.ts` and `excerpt.ts` are
framework-free and filesystem-free, so the stdio server imports them by relative path and
the app through `#patterns/*`. Nothing here may import `#lib` or a Bun-only API (`load.ts` and
`validate.ts` are the two disk readers, never imported by the app).

## Readers

| Reader | Path |
|---|---|
| stdio MCP server | `mcp/` |
| hosted HTTP MCP | `src/lib/server/mcp/` |
| app domain (docs hub, page generation, AI tool) | `src/lib/server/patterns/` |
| generated Markdown | `docs/pattern-library/` — never hand-edit; run `bun run patterns:build` |

Design rationale: [`docs/blueprint/architecture/pattern-mcp.md`](../docs/blueprint/architecture/pattern-mcp.md).
