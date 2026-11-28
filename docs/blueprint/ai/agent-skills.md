# Agent Skills — the pattern library as portable agent knowledge

**Maturity: built** (generated, gated in `validate`, and checked by the official validator).

## Problem

Coding agents (Claude Code, Codex, Copilot, Cursor, Gemini CLI and ~70 other products)
load *Agent Skills* — folders with a `SKILL.md` (frontmatter + instructions) and optional
`references/`, `scripts/`, `assets/`, disclosed progressively. v10r's knowledge already has a
canonical source, the pattern registry, projected into docs pages, MCP tools and the RAG
corpus. A hand-written set of skills would be a second body of knowledge that drifts.

## Decision

`skills/` at the repository root is a **generated surface** of `pattern-library/registry.json`:

| Agent skill | Contents |
|---|---|
| `v10r-architecture-selection` | How to choose patterns: the requirement vocabulary, `recommend_emulation_plan` / `get_pattern` / `search_patterns` over MCP, the by-hand method, the group table; `references/relationship-graph.md` (every builds-on, composes and specializes relationship in build order) |
| `v10r-<group>` × 7 (foundations, data, identity-safety, intelligence, features, velocity, integrity) | When to use, the method (avoid-when and alternatives first, then infrastructure needs by level and depends-on, invariants as MUST-hold), a maturity legend (implemented ≠ proven; non-proven rows bold), the group's pattern index; `references/<id>.md` per deep record |

Granularity is one skill per registry **group**: every installed skill's description sits in
the agent's context permanently (8 ≈ cheap; 30 categories ≈ 6k tokens), a group is a domain an
agent recognises from a task, and per-pattern detail is disclosed on demand.

- Generator: `scripts/agent-skills/build.ts` (`skills:build`, `--check` as `skills:check` in
  `validate`; `skills:build` in `refresh`). Deterministic, orphan-cleaning, no timestamps.
  Rendering shares `patternBody` with the docs pages (`src/lib/server/patterns/render.ts`).
- Validator: `src/lib/server/patterns/agent-skill-spec.ts` — name rules and name = directory,
  description 1–1,024 chars, `compatibility` ≤ 500, `metadata` a string map, `allowed-tools`,
  unknown fields, body ≤ 500 lines and ≤ 5,000 tokens (errors, not warnings), broken relative
  links. `metadata`: `{ source, registry-digest, generated: "true" }`; `license: MIT`.

## Sizes

| Agent skill | Lines | ~Tokens | References |
|---|---|---|---|
| v10r-architecture-selection | 39 | 820 | 1 |
| v10r-foundations | 130 | 4,367 | 13 |
| v10r-data | 43 | 1,098 | 0 |
| v10r-identity-safety | 55 | 1,452 | 1 |
| v10r-intelligence | 72 | 2,313 | 9 |
| v10r-features | 103 | 2,769 | 5 |
| v10r-velocity | 96 | 3,107 | 19 |
| v10r-integrity | 57 | 1,563 | 8 |

Tokens are chars/4 estimates. Foundations has ~12 % headroom; the gate fails when it outgrows it.

## Install

Two sources, one content. Both install the same bytes the registry renders.

| Source | Command | When |
|---|---|---|
| The repository | `npx skills add ApeDevil/v10r --skill v10r-architecture-selection` | Pinning a git ref (`ApeDevil/v10r@<sha>`); pass `--skill`, because the CLI also lists the repository's own development skills in `.claude/skills/` |
| A running v10r (discovery) | `npx skills add https://v10r.dev --skill v10r-intelligence -a claude-code` | No clone, no repository access, only the eight agent skills; digest-verified |

### Discovery endpoint

`/.well-known/agent-skills/index.json` serves the Agent Skills discovery index, schema
0.2.0 (`src/lib/server/patterns/agent-skill-discovery.ts`, routes under
`src/routes/.well-known/agent-skills/`). Each entry is an `archive`: a deterministic
`.tar.gz` of one agent skill folder (SKILL.md plus `references/`) with a `sha256:` digest.

- **One source.** Built from `renderAgentSkills(REGISTRY)` once per server process, the same
  projection committed under `skills/` (the test asserts byte equality). Nothing is
  hand-maintained, and the hub `README.md` is not offered as an agent skill.
- **Integrity.** The installer downloads the archive, computes its digest and refuses on a
  mismatch before writing anything. It records the digest in `skills-lock.json`
  (`wellKnownDigest`), so `skills check` and `skills update` see content changes.
- **Stable digests.** mtime 0, uid/gid 0, fixed mode, registry order, gzip without a
  timestamp. The same registry gives the same bytes on every deployment.
- **Read-only and public.** `GET` only, `Access-Control-Allow-Origin: *`, one-hour cache, an
  unknown archive name is 404. It exposes exactly what the public repository's `skills/`
  already holds.
- **No promotion.** The archives carry the registry's maturity tags unchanged: an
  `experiment` or `implemented` pattern is marked bold as non-proven, as in `skills/`.

Not chosen: an npm package (a second release process for content the registry already
versions), per-file v0.1.0 entries (no integrity digest), and a Claude Code plugin
marketplace (one agent product only; the discovery index serves every agent the skills CLI
supports).

### Measured (2026-11-24, skills CLI 1.9.0, local dev server)

| Measure | Result |
|---|---|
| Install | One command, about 10 s for two agent skills including `npx` resolution; files byte-identical to `skills/` |
| Resident context | All eight descriptions: 5,018 chars, about 1,250 tokens. Two installed: about 300 |
| Progressive disclosure | A body loads only when the agent picks the skill (≤ 4,400 tokens); a reference only when the body links it |
| Archive sizes | 2.4 KB (data) to 34 KB (foundations), 121 KB for all eight |
| Tampering | An archive with one appended byte: `SKILLS_WELLKNOWN_DIGEST_MISMATCH`, nothing installed |
| Updates | `skills check` against the source lists the six not yet installed agent skills; a changed archive changes its digest |
| Use in an external agent | Claude Code 2.1 in a fresh scratch project, after the install: it listed both v10r skills, opened `v10r-intelligence` and answered `mcp-client` for consuming external MCP tools (3 turns) |

The production endpoint is not live until the branch ships; the measurements above are
against the local dev server.

## Validation

`agent-skill-discovery.test.ts` (every generated agent skill listed, archive round-trips to the committed files, digest matches, byte-deterministic, no hub README) and `agent-skills.test.ts` (committed tree = generated tree, valid, deterministic, one reference
per deep record, every pattern once, portable links) and `agent-skill-spec.test.ts` (bad
fixtures for every rule). The official `skills-ref validate` (Python, run once by hand)
reported all 8 valid.

## Not done

The MCP skills extension (`io.modelcontextprotocol/skills`, SEP-2640: `skills/list`,
`skills/get`, `skill://` resources) is not served — waiting for SDK support. The generated
skills are not ingested into the RAG corpus (it reads `docs/` only), so nothing is counted twice.
