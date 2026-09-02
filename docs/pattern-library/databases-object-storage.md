---
title: "Object storage (Cloudflare R2, presigned transfer)"
description: "S3-compatible object storage on Cloudflare R2, accessed via @aws-sdk/client-s3 with presigned URLs for direct client uploads and downloads."
category: "Databases & Storage"
---

# Object storage (Cloudflare R2, presigned transfer)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Cloudflare R2)

S3-compatible object storage on Cloudflare R2, accessed via @aws-sdk/client-s3 with presigned URLs for direct client uploads and downloads.

**When to use:** Use when the app needs to store or serve user files without routing large payloads through the server.

## Docs

- [docs/stack/data/r2.md](/docs/stack/r2) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/r2.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/r2.md))

## Code

- `src/lib/server/store/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/store) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/store))

## Proof

- [`/showcases/db/storage/connection`](/showcases/db/storage/connection)
- [`/showcases/db/storage/objects`](/showcases/db/storage/objects)
- [`/showcases/db/storage/transfer`](/showcases/db/storage/transfer)

---

_Machine-readable record: `databases-object-storage` in `pattern-library/registry.json`._
