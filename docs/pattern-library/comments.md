---
title: "Comments"
description: "A flat, per-locale comment system with a short author edit window and admin moderation (hide/unhide/remove)."
category: "Content & Blog"
---

# Comments

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Content & Blog · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — persists user-generated content, moderation authority

A flat, per-locale comment system with a short author edit window and admin moderation (hide/unhide/remove).

**When to use:** Use when a content page needs reader comments with moderation controls rather than nested threads.

**Needs:** required key-value-store (via rate-limiting), relational-db

## Docs

- `docs/blueprint/blog.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/blog.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/blog.md))

## Code

- `src/lib/server/blog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/blog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/blog))

## Proof

- [`blog`](blog) (app route, no showcase) — Comment threads on blog posts

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Rate limiting](/docs/pattern-library/rate-limiting) — Posting is rate limited; the target's own limiter satisfies it.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Part of**

- [Blog engine](/docs/pattern-library/blog-engine) (optional)


---

_Machine-readable record: `comments` in `pattern-library/registry.json`._
