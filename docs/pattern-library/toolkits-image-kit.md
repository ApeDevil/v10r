---
title: "Image Kit (upload → AI pipeline → adjust → approve, persists nothing)"
description: "A single-page toolkit that chains an AI metadata reader, frame-cropper, and embedder on one uploaded image, then discards the upload after an honest approval…"
category: "Toolkits"
---

# Image Kit (upload → AI pipeline → adjust → approve, persists nothing)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Toolkits · **Tier:** light · **Risk:** low — no persistence of uploaded media, vision-call cost is the main concern

A single-page toolkit that chains an AI metadata reader, frame-cropper, and embedder on one uploaded image, then discards the upload after an honest approval terminal.

**When to use:** Use as a reference for building a stateless, multi-tool AI workflow that never persists user-uploaded media.

## Docs

- [docs/blueprint/ai/image-kit.md](/docs/blueprint/ai/image-kit) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/image-kit.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/image-kit.md))

## Code

- `src/lib/server/imagekit/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/imagekit) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/imagekit))

## Proof

- [`/showcases/toolkits/image-kit`](/showcases/toolkits/image-kit)

---

_Machine-readable record: `toolkits-image-kit` in `mcp/patterns.registry.json`._
