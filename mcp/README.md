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
| `patterns.registry.json` | The product: the complete two-tier pattern record set — deep emulation cards (invariants + emulation notes) and light index rows — each carrying a machine-checked `maturity` grade (`proven` ⇔ linked test/showcase + `verifiedAt`), plus the `groups`/`categories` taxonomy that orders every generated surface |
| `server.ts` | Entry: stdio loop, dispatch, lifecycle (exits on stdin EOF / SIGTERM — no orphan containers) |
| `protocol.ts` | JSON-RPC framing and line buffering |
| `registry.ts` | Types, structural validation, topological sort |
| `security.ts` | Path containment (realpath prefix check) + secret denylist + bounded excerpts |
| `tools.ts` | The six tools |
| `validate-registry.ts` | Drift guard: every referenced path must exist; DAG check. Wired into `bun run validate` as `mcp:validate` |
| `server.test.ts` / `smoke.ts` | `bun:test` units / spawned-subprocess handshake test |

## Tools

1. `search_patterns` — lexical search over the registry; lean ranked cards
2. `get_pattern` — full card by id, invariants included
3. `get_file_excerpt` — bounded line-numbered read of referenced repo files (max 250 lines; secrets denied)
4. `trace_capability` — concept → docs → code → tests → showcase trail
5. `recommend_emulation_plan` — deterministic, dependency-ordered plan assembly (no inference)
6. `validate_snippet` — checks a Svelte/TS snippet against v10r conventions (runes, component-first, tokens, Valibot); returns line-numbered findings with fixes — call it in a loop until clean

## Registration

There is deliberately no committed project-scope `.mcp.json`. Inside this repo the tools are redundant — Read and Grep reach the same files — so the server is registered at **user scope**, where it earns its keep: querying v10r patterns from *other* projects. Substitute your own clone path for the mount:

```bash
claude mcp add --scope user --transport stdio v10r-patterns -- \
  podman run -i --rm --network=none -v /home/ad/dev/velociraptor:/v10r:ro \
  docker.io/oven/bun:1.3.12 bun /v10r/mcp/server.ts
```

No clone at all? The same six tools are served over HTTP at `POST https://www.v10r.dev/api/mcp/public` — no podman, no mount, no setup.

## Testing

```bash
podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun test /v10r/mcp/       # units
podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/smoke.ts    # e2e handshake
podman run --rm -v <repo>:/v10r:ro docker.io/oven/bun:1.3.12 bun /v10r/mcp/validate-registry.ts
```

Vitest/svelte-check don't sweep `mcp/` (tests use `bun:test`); Biome does — keep its style.

## Adding a pattern

Pick a tier first. A **light** record is an index row: pointers to docs/code/showcase, empty `invariants`/`emulation_notes` (the validator rejects depth on light records). A **deep** record is a full emulation card: `invariants` and `emulation_notes` are required — curate them from the pattern's docs; they are the value the raw repo can't provide. Add the record to `patterns.registry.json` (copy a same-tier sibling's shape; `category` must be one of the root `categories[]` ids) and grade it honestly: `maturity: "proven"` needs at least one `tests`/`showcases` ref plus a `verifiedAt` date (and ideally `verifiedSha`); no proof surface yet means `"implemented"`, design-only means `"planned"`. Then run `bun run mcp:validate` — it fails on any missing path, unregistered showcase route, malformed field, tier violation, maturity/proof contradiction, or dependency cycle. Finally run `bun run patterns:build` (or the full `vr ref` chain) to regenerate the README Pattern Index and the `docs/pattern-library/` pages, and commit them with the registry change.

## Also served over HTTP (read-only)

This same curated registry is also exposed read-only at `POST /api/mcp/public` — no bearer token, same six tools, no mutation path. It's a separate hosted trust surface built on top of a shared transport, not a change to anything in this directory: the local stdio server described above is unchanged, remains read-only, and keeps running exactly as documented — ephemeral container, network-isolated, repo mounted `:ro`. There is also a separate, unrelated private admin MCP (`/api/mcp/admin`, bearer-gated, demo-state tools only) that has nothing to do with the pattern registry. Full detail: [docs/blueprint/architecture/hosted-mcp.md](../docs/blueprint/architecture/hosted-mcp.md).

## Constraints worth knowing

- Tool definitions deliberately omit `outputSchema`/`title`/`annotations` — a live Claude Code bug silently drops a server's entire tool list when any tool carries them. `smoke.ts` guards this.
- Tool results are text-only markdown, never `structuredContent` — E2E dogfooding found that when both are present, Claude Code shows the model *only* the structured payload and hides the text body (`get_file_excerpt` came through as bare metadata, no code). Don't re-add `structuredContent`.
- All logging goes to stderr; stdout is protocol-only. The process exits on stdin EOF or SIGTERM/SIGINT — Claude Code has a known issue leaving child processes orphaned otherwise.
- Every response stays well under Claude Code's 10k-token warning threshold by construction.
