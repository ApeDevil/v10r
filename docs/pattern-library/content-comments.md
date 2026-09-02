---
title: "Comments (flat, per-locale, moderated)"
description: "A flat, per-locale comment system with a short author edit window and admin moderation (hide/unhide/remove)."
category: "Content & Blog"
---

# Comments (flat, per-locale, moderated)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Content & Blog · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — persists user-generated content, moderation authority

A flat, per-locale comment system with a short author edit window and admin moderation (hide/unhide/remove).

**When to use:** Use when a content page needs reader comments with moderation controls rather than nested threads.

## Docs

- `docs/blueprint/blog.md` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/blog.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/blog.md))

## Code

- `src/lib/server/blog/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/blog) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/blog))

## Proof

- [`blog`](blog) (app route, no showcase) — Comment threads on blog posts

---

_Machine-readable record: `content-comments` in `pattern-library/registry.json`._
