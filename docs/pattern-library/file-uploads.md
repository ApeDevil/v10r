---
title: "File uploads"
description: "Server-side file upload handling that processes images with Sharp and persists them to Cloudflare R2, validating file metadata via Valibot rather than the…"
category: "Forms & Validation"
---

# File uploads

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Kind:** pattern — build it in the target project

**Category:** Forms & Validation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — server-side file handling (sharp, r2 storage)

Server-side file upload handling that processes images with Sharp and persists them to Cloudflare R2, validating file metadata via Valibot rather than the file bytes themselves in-schema.

**When to use:** Use when a form needs to accept file uploads (e.g. images) that are processed and stored server-side.

**Needs:** required object-storage · v10r's implementation uses relational-db

## Docs

- [docs/blueprint/forms.md](/docs/blueprint/forms) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/forms.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/forms.md))

## Code

- `src/lib/server/store/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/store) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/store))

## Tests

- `src/lib/server/store/blog/upload-ticket.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/store/blog/upload-ticket.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/store/blog/upload-ticket.test.ts))

## Proof

- [`/showcases/db/storage/transfer`](/showcases/db/storage/transfer)

## Relationships

**Builds on (must be available; the target’s own equivalent satisfies it)**

- [Object storage adapter](/docs/pattern-library/object-storage-adapter) — Processed files persist through the S3-compatible storage adapter; any object store satisfies it.

**Assumes (platform conventions in scope)**

- [Multi-client core](/docs/pattern-library/multi-client-core) — Server-side records put their logic in a framework-free domain module behind thin adapters (UI, AI tools, REST, jobs); they assume this layering instead of rebuilding it.


---

_Machine-readable record: `file-uploads` in `pattern-library/registry.json`._
