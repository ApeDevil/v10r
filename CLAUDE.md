# CLAUDE.md

Agent navigation map for this repository: where to look, when to look there, and the rules
that apply to every task. The knowledge itself lives in the code and in `docs/`; this file
routes to it. Do not add summaries here — a summary is a second source of truth that drifts.

**Stas is your human development partner** — this project's solo developer and the only human in the loop.

**Velociraptor (v10r)** is a full-stack SvelteKit **pattern library**: proven patterns an AI
agent reads and adapts to a new project. Emulation, not cloning. What it is: `README.md`
("What v10r is"); goals: `docs/foundation/PRD.md`.

## Always-on rules

- **Everything runs inside the `v10r` Podman container.** The host has only Podman. Prefix
  every command with `podman exec v10r …`; never run a package manager on the host. Details
  only when a task needs them: `docs/foundation/development-environment.md`.
- **Find docs through their hubs.** Every docs directory has a `README.md` with a topic
  table. Read the directory README, pick the file from its table, then read the file. Never
  grep blindly through `docs/`. Entry: `docs/README.md`.
- **Load context per task, not per session.** Identify the domain from the routing table
  below, read its canonical source, inspect the implementation, then edit. A copy change does
  not need the database docs; a UI change does not need the deployment docs.
- **Architecture boundaries.** Business logic lives in framework-free `$lib/server/[domain]/`;
  thin adapters (`+page.server.ts`, `+server.ts`, AI tools, jobs) wrap it. Four invariants —
  no framework imports in domains, dates serialized in adapters, `redirect`/`error`/`fail`
  only in adapters, domains call down not across (barrels only) — are executable in
  `src/lib/architecture.gate.test.ts`. Read `docs/codebase-organization.md` before any
  structural or cross-cutting change.
- **Self-expressive project and naming integrity.** See the section below; it applies to
  every name, file, table and comment you write.
- **Component-first.** Never use a raw `<button>`, `<input>`, `<select>` or `<textarea>` when
  a `$lib/components/` component exists. Exceptions: `docs/blueprint/design/components.md`.
- **No backward compatibility.** Active development, no production users. No migration shims,
  compat layers or deprecation paths — change the code directly.
- **Generated surfaces are never hand-edited.** `docs/pattern-library/`, `src/lib/paraglide/`,
  MCP excerpts and the RAG index are built; rebuild them (see Verification).

## Self-expressive project

The project itself should represent the system. By looking at the codebase and database —
their names, structure, boundaries, schemas, relationships and constraints — a developer
should understand how the product works and how its concepts relate. Documentation and
comments are exceptions, not the primary explanation mechanism.

- **Self-expressive code:** functions, types and modules communicate their purpose without
  explanatory comments.
- **System-reflective architecture:** the codebase structure mirrors the product and domain
  architecture.
- **Self-expressive data model:** tables, columns, relationships and constraints communicate
  their meaning directly; the database structure mirrors the domain model.
- **Comments explain why:** rationale, constraints, invariants and non-obvious decisions —
  never what the code already says.
- **One source of truth:** a fact or rule has one authoritative owner; reference it instead
  of duplicating it.

**Code expresses behavior. Structure expresses architecture. Schema expresses the domain.
Constraints express the rules. Documentation explains the why.**

### Naming integrity

One Name, One Concept: never reuse a canonical name for a different concept, never give one
concept several names. Before adding an important name, check the codebase and keep the
existing term.

`docs/naming.md` is the vocabulary — the canonical term per concept, the metaphors already
spoken for, and the names that cannot move. `src/lib/naming.gate.test.ts` fails on a retired
term, a shouted acronym inside a mixed-case name (`AIError`), an unnamespaced i18n key, a
second declaration of an existing name, and a file named for a bucket rather than a
responsibility (`service.ts`, `helpers.ts`, `utils.ts`, `constants.ts`, `shared.ts`, `core.ts`,
`handler.ts`, …). Read the doc before inventing a name; add to it when you settle one.

## Task → source routing

Read the first column's sources only when the task touches that row. Implementation paths are
where to look after the docs.

| When working on… | Read first | Then inspect |
|---|---|---|
| Product purpose / behavior | `README.md`, `docs/foundation/PRD.md`, `docs/foundation/principles.md` | `src/routes/` |
| Architecture: how it runs | `docs/system-abstraction.md` (hooks pipeline, multi-client core) | `src/hooks.server.ts` |
| Architecture: where code lives | `docs/codebase-organization.md`, `docs/blueprint/architecture/README.md` | `src/lib/server/[domain]/` |
| Naming | `docs/naming.md` | `src/lib/naming.gate.test.ts` |
| Database (schema, queries, push) | `docs/codebase-organization.md` (`db/` section), `docs/blueprint/data/README.md`, `docs/stack/data/README.md` | `src/lib/server/db/`, `drizzle.config.ts` |
| Auth / sessions / grants | `docs/blueprint/auth.md`, `docs/stack/auth/better-auth.md` | `src/lib/server/auth/` |
| Request pipeline / middleware | `docs/system-abstraction.md` (Spine A), `docs/blueprint/middleware.md` | `src/hooks.server.ts` |
| AI / RAG / chatbot | `docs/blueprint/ai/README.md`, `docs/stack/ai/ai-sdk.md` | `src/lib/server/ai/`, `retrieval/`, `llmwiki/` |
| UI / design system / styling | `docs/blueprint/design/README.md` → `components.md`, `tokens.md`, `styling.md`; `docs/stack/ui/README.md` | `src/lib/components/`, `src/app.css`, `src/lib/styles/tokens.ts` |
| Svelte state / runes | `docs/blueprint/state.md` | `src/lib/state/` |
| API (REST / SSE) | `docs/blueprint/api.md`, `docs/stack/capabilities/api.md` | `src/routes/api/`, `src/lib/server/http/` |
| i18n | `docs/blueprint/i18n.md`, `docs/stack/i18n/paraglide.md` | `messages/*.json` |
| Runtime / container / deployment | `docs/foundation/development-environment.md`, `docs/stack/core/README.md`, `docs/stack/ops/README.md` | `compose.yaml`, `package.json` scripts |
| Background jobs / cron | `docs/blueprint/architecture/jobs.md` | `src/lib/server/jobs/` |
| Testing | `docs/blueprint/testing/strategy.md`, then `ai-testing-infrastructure.md` | co-located `*.test.ts` |
| Patterns / MCP | `pattern-library/README.md`, `docs/blueprint/architecture/pattern-mcp.md`, `hosted-mcp.md` | `pattern-library/registry.json`, `mcp/`, `src/lib/server/mcp/` |
| Showcases | `src/lib/server/showcases/README.md` | `src/routes/[[locale=locale]]/(public)/showcases/` |
| Security / abuse / privacy | `docs/blueprint/security/README.md`, `docs/blueprint/abuse/README.md`, `docs/stack/capabilities/gdpr.md` | `src/lib/server/security/`, `abuse/`, `privacy/` |
| Any other feature area | `docs/blueprint/README.md` (analytics, desk, notifications, app-shell, …) | the like-named `src/lib/server/` domain |

## Agents and sub-agents

- The roster lives in `.claude/agents/*.md`; each file's frontmatter `description` says when
  to use it (and when not to). Skills live in `.claude/skills/*/SKILL.md`. Route by those
  descriptions; do not preload them.
- Launch independent agents in one message so they run concurrently; keep the conclusion, not
  the file dumps.
- **Every sub-agent prompt that edits files must forbid working-tree-mutating git commands**
  (no `stash`/`reset`/`checkout`/`restore`/`commit`; `git mv`/`git rm` only for its own
  renames) and must say the tree carries concurrent uncommitted work. One `git stash -u` by
  one agent once wiped twenty in-flight edits from three others.

## Verification

There is no CI pipeline. The gate is the authority:

```bash
podman exec v10r bun run validate     # typecheck + biome + tests + registry/i18n/content/quality checks
```

- Individual checks (`check`, `test`, `lint`, `knip`, `db:push`, …) are the scripts in
  `package.json`; run one test file with `podman exec v10r bunx vitest run <path>`.
- Pattern-library or docs changes: `podman exec v10r bun run refresh` (validate → build pages →
  MCP excerpts → RAG ingest). The excerpt snapshot byte-mirrors registry-referenced files, so
  editing one of them fails `mcp:excerpts:check` until rebuilt.
- Report outcomes as they are: a failing gate is reported with its output, never called green.

## Critical warnings

- **Source control is Stas's.** Never commit, stage, push, stash or reset on your own
  initiative — and never offer to. Uncommitted changes are how he reviews your work. Read-only
  git (`status`, `diff`, `log`) is always fine.
- **Never run a `vr` command** (`bin/vr`, Stas's host-side dispatcher). `vr ship` pushes
  `main`, which deploys to production. Run the container commands it wraps directly instead.
- **Never import `$lib/server/` from a `.svelte` file or a universal `+page.ts`** — the path
  is the server/client boundary.
- **A new i18n key needs a dev-server restart**; the running Vite process 500s on the unknown
  key until then (`docs/stack/i18n/paraglide.md`).
- **Never name a prop `state`** — it collides with the `$state` rune (`docs/naming.md`).
- **Never hardcode a color**; every color is a token in `src/app.css`.

## Acknowledgment

Optimize responses for signal over narration. End every substantive response with a final line
prefixed **`⚜️TL;DR for Stas:`** — the outcome in one or two sentences, plus open issues if any.
In a terminal the bottom of the response is what's on screen when output stops, so this is the
scan-anchor. Skip it only when the whole response is already one or two sentences. Its presence
also confirms this file is loaded and in effect.
