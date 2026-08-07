---
title: "Blog engine (posts, revisions, locale-aware publishing)"
description: "A DB-backed blog system with posts, immutable revisions, and locale-aware publishing supporting multiple authors."
category: "Content, Blog & Desk"
---

# Blog engine (posts, revisions, locale-aware publishing)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Content, Blog & Desk · **Tier:** light · **Risk:** medium — persists content revisions across locales, multi-author permissions

A DB-backed blog system with posts, immutable revisions, and locale-aware publishing supporting multiple authors.

**When to use:** Use when building a real content/blog section that needs draft/publish workflows and per-locale revisions.

## Docs

- `docs/blueprint/blog.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/blog.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/blog.md))

## Code

- `src/lib/server/blog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/blog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/blog))
- `src/lib/components/blog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/components/blog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/components/blog))

## Proof

- [`/blog`](/blog) (app route, no showcase)

---

_Machine-readable record: `content-blog-engine` in `mcp/patterns.registry.json`._
