---
title: "Image metadata reader (vision)"
description: "A vision-capable LLM proposes title, caption, alt text, keywords, and category for an uploaded image, which a human reviews and approves before anything…"
category: "AI"
---

# Image metadata reader (vision)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

A vision-capable LLM proposes title, caption, alt text, keywords, and category for an uploaded image, which a human reviews and approves before anything persists.

**When to use:** Use when uploaded media needs AI-drafted metadata but a human must confirm every field before it is saved.

## Docs

- [docs/blueprint/ai/image-metadata.md](/docs/blueprint/ai/image-metadata) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/image-metadata.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/image-metadata.md))

## Code

- `src/lib/server/imagemeta/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/imagemeta) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/imagemeta))

## Proof

- [`/showcases/toolkits/image-metadata`](/showcases/toolkits/image-metadata)

---

_Machine-readable record: `ai-image-metadata` in `pattern-library/registry.json`._
