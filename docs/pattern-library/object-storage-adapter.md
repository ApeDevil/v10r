---
title: "Object storage adapter"
description: "S3-compatible object storage on Cloudflare R2, accessed via @aws-sdk/client-s3 with presigned URLs for direct client uploads and downloads."
category: "Databases & Storage"
---

# Object storage adapter

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Databases & Storage · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — external managed service (Cloudflare R2)

S3-compatible object storage on Cloudflare R2, accessed via @aws-sdk/client-s3 with presigned URLs for direct client uploads and downloads.

**When to use:** Use when the app needs to store or serve user files without routing large payloads through the server.

**Needs:** required object-storage · v10r's implementation uses relational-db

## Docs

- [docs/stack/data/r2.md](/docs/stack/r2) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/data/r2.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/data/r2.md))

## Code

- `src/lib/server/store/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/store) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/store))

## Proof

- [`/showcases/db/storage/connection`](/showcases/db/storage/connection)
- [`/showcases/db/storage/objects`](/showcases/db/storage/objects)
- [`/showcases/db/storage/transfer`](/showcases/db/storage/transfer)

## Relationships

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.

**Built on by**

- [File uploads](/docs/pattern-library/file-uploads)


---

_Machine-readable record: `object-storage-adapter` in `pattern-library/registry.json`._
