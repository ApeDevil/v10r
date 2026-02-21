# R2 Storage Showcase: Implementation Record

> Status: **Implemented**
> Branch: `015-db-graph` (committed alongside graph DB work)

This records what was built for the Cloudflare R2 object storage showcase.

---

## What Was Built

An R2 storage showcase demonstrating the S3-compatible API for object storage, integrated into Velociraptor's `/showcases/db/` route tree alongside PostgreSQL and Neo4j.

### Route Structure

```
/showcases/db/                          → Hub (Relational, Graph, Storage link cards)
  /showcases/db/storage/                → Storage hub
    /showcases/db/storage/connection/   → R2 health check, bucket stats, reseed
    /showcases/db/storage/objects/      → List, inspect metadata, presigned download
    /showcases/db/storage/transfer/     → Presigned upload, byte-range hex dump
```

Nav entry: accessed via `/showcases/db` hub card — deep routes via hub, not top nav.

---

## Dependencies

| Package | Version | Notes |
|---------|---------|-------|
| `@aws-sdk/client-s3` | `^3.x` | S3 API client for R2 |
| `@aws-sdk/s3-request-presigner` | `^3.x` | Presigned URL generation |

No R2-specific SDK — uses standard S3 client with R2 endpoint.

---

## Store Layer

The store layer at `$lib/server/store/` mirrors the structure of `db/` (relational) and `graph/` (Neo4j):

```
src/lib/server/store/
├── index.ts           # S3Client setup with R2 endpoint, BUCKET export
├── types.ts           # ObjectInfo, ObjectDetail, BucketStats, PresignedUrlResult, etc.
├── errors.ts          # StoreError class, classifyS3Error() normalizer
└── showcase/
    ├── queries.ts     # verifyConnection, listShowcaseObjects, getObjectDetail,
    │                  # generateDownloadUrl, getObjectRange
    ├── mutations.ts   # generateUploadUrl, confirmUpload, deleteShowcaseObject
    ├── seed.ts        # reseedBucket() with 11 seed objects
    └── guards.ts      # assertShowcaseKey(), checkObjectLimit()
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `R2_ACCOUNT_ID` | Endpoint derived: `https://{id}.r2.cloudflarestorage.com` |
| `R2_ACCESS_KEY_ID` | S3 API token access key |
| `R2_SECRET_ACCESS_KEY` | S3 API token secret |
| `R2_BUCKET_NAME` | Target bucket |

All four validated at module load — missing any throws immediately.

---

## Showcase Pages

### Connection (`/showcases/db/storage/connection`)

- `HeadBucket` to verify connectivity
- Measures latency
- Counts objects and total size under `showcase/` prefix
- Form actions: `retest` (re-measure), `reseed` (wipe and re-upload seed data)

### Objects (`/showcases/db/storage/objects`)

- `ListObjectsV2` with pagination for object listing
- `HeadObject` for detailed metadata inspection (content-type, cache-control, custom metadata)
- Presigned download URL generation with configurable TTL

### Transfer (`/showcases/db/storage/transfer`)

- **Presigned upload flow**: server validates MIME type + size → generates presigned PUT URL → client uploads directly to R2 → server confirms via `HeadObject`
- **Byte-range requests**: `GetObject` with `Range` header, rendered as hex dump (address, hex bytes, ASCII)
- Range limited to 1024 bytes per request

---

## Seed Data

11 objects across five categories:

| Category | Objects | Purpose |
|----------|---------|---------|
| `showcase/text/` | hello.txt, readme.md, data.csv | Plain text content types |
| `showcase/json/` | config.json, package.json | Structured JSON content |
| `showcase/binary/` | pixel.png (67B), gradient.svg | Binary + image content |
| `showcase/metadata/` | tagged.txt, cached.txt, encoded.txt | Custom metadata, Cache-Control, Content-Encoding |
| `showcase/large/` | padded.bin (1 MB) | Byte-range request demo |

Reseed is idempotent: deletes all `showcase/*` objects then re-uploads.

---

## Safety Guards

| Guard | Limit | Purpose |
|-------|-------|---------|
| `assertShowcaseKey()` | `showcase/` prefix | Prevent operations outside showcase namespace |
| `checkObjectLimit()` | 20 objects max | Prevent unbounded growth |
| MIME allowlist | 7 types (images + PDF) | Upload type restriction |
| Size limit | 2 MB | Upload size cap |
| UUID keys | `showcase/uploads/{uuid}.{ext}` | Prevent collision/overwrite |

---

## Error Handling

`classifyS3Error()` maps AWS SDK errors to normalized `StoreErrorKind`:

| SDK Error | StoreErrorKind |
|-----------|---------------|
| `NoSuchKey`, `NotFound`, HTTP 404 | `not_found` |
| `NoSuchBucket`, `InvalidAccessKeyId`, HTTP 401/403 | `credentials` |
| `AccessDenied`, `SignatureDoesNotMatch` | `forbidden` |
| `TimeoutError`, `RequestTimeout` | `timeout` |
| `SlowDown`, `ServiceUnavailable` | `unavailable` |
| Everything else | `unknown` |

All route handlers catch errors through `classifyS3Error()` and return structured error responses.

---

## Design Decisions

**Driver-free approach** — like the Neo4j layer (raw HTTP), the R2 layer uses the standard `@aws-sdk/client-s3` rather than any R2-specific SDK. This keeps the code portable to any S3-compatible provider.

**Presigned uploads over form-action uploads** — files go directly from browser to R2, never touching the SvelteKit server. This avoids serverless function size limits and reduces latency.

**Showcase prefix isolation** — all operations are sandboxed to `showcase/` to prevent accidental modification of non-showcase data in the same bucket.
