---
title: "Agent Experience (AX) surfaces"
description: "Five derived surfaces make the repo consumable by coding agents: a root AGENTS.md contract, raw-markdown doc variants with Accept negotiation, an /llms.txt…"
category: "Docs & Agent Experience"
---

# Agent Experience (AX) surfaces

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Docs & Agent Experience · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — read-only derived surfaces; no new state

Five derived surfaces make the repo consumable by coding agents: a root AGENTS.md contract, raw-markdown doc variants with Accept negotiation, an /llms.txt URL map with in-band prior corrections, MCP tool errors that carry machine-actionable recovery steps, and a generated pattern library (README index + per-pattern docs pages) rendered from the pattern registry.

**When to use:** Adopt when a repo's primary consumers are AI agents: it turns passive docs into addressable, self-correcting surfaces without any hand-maintained duplicate content.

## Docs

- [docs/blueprint/architecture/agent-experience.md](/docs/blueprint/architecture/agent-experience) — The full AX layer: surfaces, derivation map, negotiation contract ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/agent-experience.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/agent-experience.md))
- [docs/blueprint/architecture/hosted-mcp.md](/docs/blueprint/architecture/hosted-mcp) — The hosted MCP surface the Next-actions convention lives on ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/hosted-mcp.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/hosted-mcp.md))

## Code

- `AGENTS.md` — Universal agent contract at the repo root ([GitHub](https://github.com/ApeDevil/v10r/blob/main/AGENTS.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/AGENTS.md))
- `src/lib/server/docs/markdown.hook.ts` — The .md layer + Accept: text/markdown negotiation (303 + Vary + no-store) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/docs/markdown.hook.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/docs/markdown.hook.ts))
- `src/lib/server/docs/llms-txt.ts` — /llms.txt built per request from the docs manifest ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/docs/llms-txt.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/docs/llms-txt.ts))
- `src/lib/server/mcp/snippet/engine.ts` — validate_snippet rule engine (findings are a success; input never echoed) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/snippet/engine.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/snippet/engine.ts))
- `scripts/patterns/build-derived.ts` — Pattern-library generator (README region + per-pattern pages) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/patterns/build-derived.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/patterns/build-derived.ts))

## Tests

- `src/lib/server/docs/llms-txt.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/docs/llms-txt.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/docs/llms-txt.test.ts))
- `src/lib/server/mcp/next-actions.gate.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/mcp/next-actions.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/mcp/next-actions.gate.test.ts))

## Proof

- [`/showcases/ax`](/showcases/ax)

## Invariants

- Every surface is derived — llms.txt from the docs manifest, .md bodies from the published registry, tool cards from shared JSON, the README Pattern Index and /docs/pattern-library pages from the pattern registry; none is hand-maintained.
- Every registry-produced MCP error carries a required diag code AND a Next-actions recovery trailer — a new error branch without them is a compile error.
- Content negotiation is 303 + Vary: Accept + no-store; each cacheable artifact lives at exactly one URL.
- Tool results are text-only and never echo caller input beyond the bounded id reflection.

## Emulation notes

- Start with AGENTS.md and llms.txt — the standards that won adoption — and advertise them in-page/headers; an unadvertised llms.txt is dead weight.
- Make recovery hints structural (a required parameter on the error constructor), not a style guideline reviewers must remember.

## Depends on

- [Docs navigation hubs (README-per-directory convention)](/docs/pattern-library/docs-nav-hubs)

---

_Machine-readable record: `agent-experience` in `pattern-library/registry.json`._
