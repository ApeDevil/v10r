# `pattern-library/`

The product. Curated pattern records that a coding agent reads to emulate v10r's stack
rather than clone it.

| File | Role |
|---|---|
| `registry.json` | The complete two-tier record set — deep emulation cards (invariants + emulation notes) and light index rows — each carrying a machine-checked `maturity` grade (`proven` ⇔ linked test/showcase + `verifiedAt`), plus the `groups`/`categories` taxonomy that orders every generated surface |
| `schema.ts` | What a pattern *is*: types, structural validation, topological sort. The single declaration, shared by every reader |
| `load.ts` | Reads the registry off disk. Bun-only (`import.meta.dir`), which is why it is separate from `schema.ts` |
| `validate.ts` | Drift guard: every referenced path must exist, every showcase href must be registered, the dependency graph must be acyclic. Wired into `bun run validate` as `patterns:validate` |

## Why it lives outside `src/`

`mcp/server.ts` runs under bare Bun in an ephemeral, network-less container with a
read-only repo mount — no Vite, no alias resolution — so it must reach `registry.json` by
relative path. The app reaches the same file through the `$patterns` alias
(`svelte.config.js`). One record set, no copies.

## Readers

| Reader | Path |
|---|---|
| stdio MCP server | `mcp/` |
| hosted HTTP MCP | `src/lib/server/mcp/` |
| app domain (docs hub, page generation, AI tool) | `src/lib/server/patterns/` |
| generated Markdown | `docs/pattern-library/` — never hand-edit; run `bun run patterns:build` |

Design rationale: [`docs/blueprint/architecture/pattern-mcp.md`](../docs/blueprint/architecture/pattern-mcp.md).
