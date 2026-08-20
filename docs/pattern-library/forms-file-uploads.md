---
title: "File uploads (withFiles + Sharp + R2)"
description: "Server-side file upload handling that processes images with Sharp and persists them to Cloudflare R2, validating file metadata via Valibot rather than the…"
category: "Forms & Validation"
---

# File uploads (withFiles + Sharp + R2)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Forms & Validation · **Tier:** light · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** medium — server-side file handling (sharp, r2 storage)

Server-side file upload handling that processes images with Sharp and persists them to Cloudflare R2, validating file metadata via Valibot rather than the file bytes themselves in-schema.

**When to use:** Use when a form needs to accept file uploads (e.g. images) that are processed and stored server-side.

## Docs

- [docs/blueprint/forms.md](/docs/blueprint/forms) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/forms.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/forms.md))

## Code

- `src/lib/server/store/` ([GitHub](https://github.com/ApeDevil/v10r/tree/main/src/lib/server/store) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/tree/main/src/lib/server/store))

## Tests

- `src/lib/server/store/blog/upload-ticket.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/store/blog/upload-ticket.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/store/blog/upload-ticket.test.ts))

## Proof

- [`/showcases/db/storage/transfer`](/showcases/db/storage/transfer)

---

_Machine-readable record: `forms-file-uploads` in `mcp/patterns.registry.json`._
