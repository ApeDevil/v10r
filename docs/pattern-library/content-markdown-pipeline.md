---
title: "Markdown pipeline & custom syntax (directives, wikilinks)"
description: "A remark/rehype-based markdown rendering pipeline extended with custom directive syntax for embeds; wikilink cross-references are designed for but not yet…"
category: "Content & Blog"
---

# Markdown pipeline & custom syntax (directives, wikilinks)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Content & Blog · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** low — parsing/rendering pipeline, no db writes

A remark/rehype-based markdown rendering pipeline extended with custom directive syntax for embeds; wikilink cross-references are designed for but not yet implemented.

**When to use:** Use when rendering blog/content markdown that needs project-specific directive syntax beyond plain CommonMark.

## Docs

- `docs/blueprint/blog.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/blog.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/blog.md))

## Code

- `src/lib/server/content/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/content) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/content))
- `src/lib/content-syntax/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/content-syntax) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/content-syntax))

## Tests

- `src/lib/server/blog/pipeline.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/blog/pipeline.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/blog/pipeline.test.ts))

---

_Machine-readable record: `content-markdown-pipeline` in `pattern-library/registry.json`._
