---
title: "Docs navigation hubs (README-per-directory convention)"
description: "An AI-optimized docs tree where every directory's README.md is a navigation hub with topic tables, so agents read index → target file, never everything."
category: "Docs & Agent Experience"
---

# Docs navigation hubs (README-per-directory convention)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Docs & Agent Experience · **Tier:** deep · **Risk:** low — documentation convention only

An AI-optimized docs tree where every directory's README.md is a navigation hub with topic tables, so agents read index → target file, never everything.

**When to use:** Adopt in any repo meant to be read by AI agents: it turns documentation from a pile of files into an addressable index.

## Docs

- `docs/README.md` — Root hub — the entry point of the whole convention ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/README.md))
- `docs/blueprint/README.md` — Example directory hub with topic tables ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/README.md))
- `docs/blueprint/ai/README.md` — Second example hub (AI subsystem) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/README.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/README.md))

## Invariants

- Each documentation directory has a README.md acting as a navigation hub: a 2-3 sentence intro plus a topic table showing which file covers what.
- Navigation rule: start at docs/README.md and drill down through directory READMEs — read index, then target file, never everything.

## Emulation notes

- This is a convention, not code — emulate by writing the hubs, not by copying files.
- Keep hub intros to 2-3 sentences; the topic table is the payload.

---

_Machine-readable record: `docs-nav-hubs` in `mcp/patterns.registry.json`._
