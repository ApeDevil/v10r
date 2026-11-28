---
title: "Image metadata reader"
description: "A vision-capable LLM proposes title, caption, alt text, keywords, and category for an uploaded image, which a human reviews and approves before anything…"
category: "AI"
---

# Image metadata reader

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** AI · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external LLM providers with quota limits

A vision-capable LLM proposes title, caption, alt text, keywords, and category for an uploaded image, which a human reviews and approves before anything persists.

**When to use:** Use when uploaded media needs AI-drafted metadata but a human must confirm every field before it is saved.

**Needs:** required llm-provider, object-storage, relational-db

## Docs

- [docs/blueprint/ai/image-metadata.md](/docs/blueprint/ai/image-metadata) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/image-metadata.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/image-metadata.md))
- [docs/blueprint/ai/image-kit.md](/docs/blueprint/ai/image-kit) — Image Kit — A single-page toolkit that chains an AI metadata reader, frame-cropper, and embedder on one uploaded image, then discards the upload after an honest approval terminal. Use as a reference for building a stateless, multi-tool AI workflow that never persists user-uploaded media. ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/image-kit.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/image-kit.md))

## Code

- `src/lib/server/imagemeta/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/imagemeta) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/imagemeta))
- `src/lib/server/showcases/image-kit/` — Image Kit ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/showcases/image-kit) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/showcases/image-kit))

## Proof

- [`/showcases/toolkits/image-metadata`](/showcases/toolkits/image-metadata)
- [`/showcases/toolkits/image-kit`](/showcases/toolkits/image-kit) — Image Kit

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `image-metadata-reader` in `pattern-library/registry.json`._
