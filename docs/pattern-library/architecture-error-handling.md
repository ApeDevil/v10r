---
title: "Error handling (expected/unexpected/form/API)"
description: "Classifies errors into expected, unexpected, form, and API categories, each handled by a distinct SvelteKit mechanism (error(), handleError, fail(), json())."
category: "Architecture & Request Pipeline"
---

# Error handling (expected/unexpected/form/API)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Risk:** low — structural pattern, no external services

Classifies errors into expected, unexpected, form, and API categories, each handled by a distinct SvelteKit mechanism (error(), handleError, fail(), json()).

**When to use:** Reach for it when deciding how to surface a failure from a load function, form action, or API endpoint.

## Docs

- [docs/blueprint/error-handling.md](/docs/blueprint/error-handling) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/error-handling.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/error-handling.md))

## Code

- `src/lib/server/errors/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/errors) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/errors))
- `src/lib/errors/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/errors) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/errors))

## Proof

- [`/showcases/shell/errors`](/showcases/shell/errors)

---

_Machine-readable record: `architecture-error-handling` in `mcp/patterns.registry.json`._
