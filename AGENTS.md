# AGENTS.md

Instructions for AI coding agents working in this repository. Claude Code reads
`CLAUDE.md` instead, which supersedes this file for Claude.

This file carries only the universal contract. Anything stack-specific lives in
`/docs`; anything Claude-specific lives in `CLAUDE.md`. Do not add a stack table
here — a second hand-maintained corpus is the failure mode this file avoids.

## What this project is

Velociraptor (v10r) is a full-stack reference and test-sandbox: proven,
high-performance SvelteKit patterns that an AI agent reads and adapts to a new
project. Emulation, not cloning. Full goals: `docs/foundation/PRD.md`.

## Non-negotiables

1. **Container-first.** Never run a package manager on the host machine. All
   tooling, dependencies and the runtime live in the `v10r` Podman container;
   add dependencies to `package.json` and install inside the container.
2. **Component-first.** Never use a raw `<button>`, `<input>`, `<select>` or
   `<textarea>` when a `$lib/components/` component exists. Exceptions:
   `<input type="hidden">`, `<input type="checkbox">` inside table rows,
   `<select>` binding numeric values, and custom interactive regions that need
   specialized styling.
3. **No backward compatibility.** Active development, no production users. No
   migration shims, no compat layers, no deprecation paths — change the code
   directly.
4. **Never run a `vr` command on your own initiative.** `vr` is the host-side
   dev CLI; `vr ship` deploys to production. Run one only when the user
   explicitly asks for that specific command.

## The gate

```
bun run validate
```

One command (typecheck + biome + tests + registry/i18n/content/quality checks),
run inside the container. There is no CI pipeline — this gate is the authority.

## Finding documentation

Every documentation directory has a `README.md` navigation hub with a topic
table. Read the directory README first, use its table to pick the file, then
read the file. Never grep blindly through `docs/`.

Architecture entry points: `docs/system-abstraction.md` (how the system runs)
and `docs/codebase-organization.md` (where code lives).

## Machine-readable surfaces

- `/llms.txt` — curated URL map of the published documentation (absolute URLs).
- Every published `/docs/**` page also serves raw markdown at the same URL with
  `.md` appended, and honors `Accept: text/markdown` on the clean URL.
- `POST https://www.v10r.dev/api/mcp/public` — hosted read-only MCP server
  (JSON-RPC 2.0 over HTTP): pattern search, curated pattern cards, file
  excerpts, emulation plans, and a loopable `validate_snippet` checker.
- `mcp/server.ts` — the same tools as a local stdio MCP server, spawned as an
  ephemeral Podman container (`.mcp.json` has the invocation).

## For Claude Code

Read `CLAUDE.md` — it carries the agent delegation policy, model selection, and
the skills policy. This file deliberately does not.
