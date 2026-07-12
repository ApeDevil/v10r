# v10r Pattern MCP

A read-only MCP server that makes v10r's "emulate, don't clone" contract executable: coding agents query curated pattern cards — docs, code entry points, tests, showcase proof, and the invariants that must hold — instead of grepping the repo.

Interactive showcase: `/showcases/mcp` — registry stats, dependency graph, container architecture, and the protocol handshake, computed live from `patterns.registry.json`. Design rationale: [docs/blueprint/architecture/pattern-mcp.md](../docs/blueprint/architecture/pattern-mcp.md).

## How it works

Zero-dependency Bun TypeScript: hand-rolled JSON-RPC 2.0 over newline-delimited stdio (MCP spec 2025-11-25). No SDK, no node_modules. The client spawns it as an ephemeral container with a read-only repo mount and no network:

```bash
podman run -i --rm --network=none -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
```

| File | Role |
|---|---|
| `patterns.registry.json` | The product: curated pattern records (id, docs, code, tests, showcases, invariants, emulation notes, depends_on) |
| `server.ts` | Entry: stdio loop, dispatch, lifecycle (exits on stdin EOF / SIGTERM — no orphan containers) |
| `protocol.ts` | JSON-RPC framing and line buffering |
| `registry.ts` | Types, structural validation, topological sort |
| `security.ts` | Path containment (realpath prefix check) + secret denylist + bounded excerpts |
| `tools.ts` | The five tools |
| `validate-registry.ts` | Drift guard: every referenced path must exist; DAG check. Wired into `bun run validate` as `mcp:validate` |
| `server.test.ts` / `smoke.ts` | `bun:test` units / spawned-subprocess handshake test |

## Tools

1. `search_patterns` — lexical search over the registry; lean ranked cards
2. `get_pattern` — full card by id, invariants included
3. `get_file_excerpt` — bounded line-numbered read of referenced repo files (max 250 lines; secrets denied)
4. `trace_capability` — concept → docs → code → tests → showcase trail
5. `recommend_emulation_plan` — deterministic, dependency-ordered plan assembly (no inference)

## Registration

Project scope: `.mcp.json` at the repo root (committed; approve once when prompted). Its mount arg is `${V10R_REPO:-/home/ad/dev/velociraptor}` — `${CLAUDE_PROJECT_DIR}` does not expand inside `.mcp.json` args, so cloning this repo elsewhere means exporting `V10R_REPO` to your own path before the client spawns the server.

User scope, to query v10r patterns from *other* projects:

```bash
claude mcp add --scope user --transport stdio v10r-patterns -- \
  podman run -i --rm --network=none -v /home/ad/dev/velociraptor:/v10r:ro \
  docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
```

## Testing

```bash
podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun test /v10r/mcp/       # units
podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/smoke.ts    # e2e handshake
podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/validate-registry.ts
```

Vitest/svelte-check don't sweep `mcp/` (tests use `bun:test`); Biome does — keep its style.

## Adding a pattern

Add a record to `patterns.registry.json` (copy an existing one's shape), then run `validate-registry.ts` — it fails on any missing path, malformed field, or dependency cycle. Curate `invariants` and `emulation_notes` from the pattern's docs; they are the value the raw repo can't provide.

## Constraints worth knowing

- Tool definitions deliberately omit `outputSchema`/`title`/`annotations` — a live Claude Code bug silently drops a server's entire tool list when any tool carries them. `smoke.ts` guards this.
- Tool results are text-only markdown, never `structuredContent` — E2E dogfooding found that when both are present, Claude Code shows the model *only* the structured payload and hides the text body (`get_file_excerpt` came through as bare metadata, no code). Don't re-add `structuredContent`.
- All logging goes to stderr; stdout is protocol-only. The process exits on stdin EOF or SIGTERM/SIGINT — Claude Code has a known issue leaving child processes orphaned otherwise.
- Every response stays well under Claude Code's 10k-token warning threshold by construction.
