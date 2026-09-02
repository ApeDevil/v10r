# Image Kit

One image, three AI tools, one flow: **upload → Run → adjust → Approve**. Lands as the first page of the `toolkits` showcase collection at `/showcases/toolkits/image-kit`.

> The showcase page is the UI documentation. This doc covers the architecture, the geometry rule, and the decisions the page can't show.

Image Kit is the sibling and evolution of the [Image Metadata Reader](./image-metadata.md). The reader persists one thing — metadata. Image Kit persists **nothing** and bundles three capabilities behind a single upload. It reuses the reader's framework-free logic by import and leaves the reader, its `image` schema, and its GDPR surface untouched.

---

## What it is

A single page with three in-page `<section>` tools chained on one upload:

| # | Tool | Output |
|---|------|--------|
| 1 | **AI metadata reader** | title / caption / altText / keywords / category + per-field confidence |
| 2 | **AI frame-cropper** | 1:1 / 16:9 / 9:16 crops; AI suggests a focal region, the user adjusts |
| 3 | **Image embedder** | embeds the caption text (default) or the image (multimodal toggle); heatmap + cosine bars against a fixed concept corpus |

The flow: upload an image → **Run** fires one vision call that fills metadata *and* suggests crops → adjust crops, optionally embed → **Approve** opens an honest terminal that shows exactly what a real app would persist, lets you download crops / copy JSON, then discards the upload.

---

## Hard constraint: it persists nothing

No DB rows. No schema. The only durable artifact is an **ephemeral R2 object** under the `showcase/imagekit/` prefix, deleted by the `discard` RPC on Approve and reclaimed by an R2 lifecycle TTL if the session is abandoned.

This is the defining difference from the reader, which has its own `image` pgSchema, persistence, and GDPR consumers. Image Kit has none of those and adds none.

---

## Module map

| Piece | Location | Role |
|-------|----------|------|
| Wire + validation schema | `src/lib/schemas/showcase/image-kit.ts` | Client+server safe. Merged-vision Valibot schema (metadata + crop HINT), `CROP_RATIOS`, `largestRatioRect`, wire DTOs (`VisionResponse` / `CropDerivativeResponse` / `EmbedResponse` / `UploadResult`), `isImageId` / `isCropRatio`. Re-uses the reader's category/confidence vocab so the two can't drift. |
| Server domain | `src/lib/server/showcases/imagekit/` | Framework-free, **no DB**. `ingest.ts`, `vision.ts`, `geometry.ts`, `crop.ts`, `embed.ts`, `corpus.ts`, `cost-estimate.ts`, `types.ts`, `index.ts` barrel. |
| R2 store | `src/lib/server/showcases/store/imagekit.ts` | Sibling of `image.ts` on a SEPARATE prefix (`showcase/imagekit/`) so ephemeral objects can be TTL-expired independently. |
| Routes | `src/routes/[[locale=locale]]/(public)/showcases/toolkits/` | Collection chrome (`+layout`, `+page.ts` redirect) + `image-kit/` page (`+page.server.ts` auth-gated load + upload action; `+page.svelte` orchestration) + RPC endpoints `vision/` `crop/` `embed/` `discard/`. Components in `image-kit/_components/`. |

### Server domain files

| File | Exports | Role |
|------|---------|------|
| `ingest.ts` | `ingestEphemeralImage` | Sniff MIME + process (resize + EXIF strip, reused from `imagemeta`) + R2 put. No DB write. |
| `vision.ts` | `runVision` | ONE merged `generateText` + `Output.object(jsonSchema)` call. Budget-gated, charges tokens, snaps crops via `snapToAspect`. Never throws — every failure is a typed envelope. |
| `geometry.ts` | `snapToAspect` | Pure, unit-tested aspect-ratio snap. No sharp, no AI. |
| `crop.ts` | `generateCropDerivative`, `generateAttentionCrop` | sharp extract (user/AI rect) + sharp `attention` saliency baseline. |
| `embed.ts` | `embedCaptionText`, `embedImage`, `cosineSimilarity`, `l2Norm`, `neighborsFrom` | Caption-text (1536-dim) or multimodal (3072-dim) embedding + cosine neighbors. |
| `corpus.ts` | `getCorpus` | Fixed in-memory concept corpus, embedded with the matching model so cosine is comparable. |
| `cost-estimate.ts` | `estimatePreRunCost` | Pre-Run reference estimate from image dimensions. |

### Import wall — same boundary as the reader

```
imagekit  → ai / store / schemas / imagemeta (image processing) / retrieval (embeddings)
imagekit  ✗ no DB, writes nothing
ai        ✗ never imports imagekit
imagemeta ✗ never imports imagekit  (greenfield-additive — the reader is untouched)
```

Image Kit reuses framework-free logic **by import**: `processImage` / `sniffImageMime` from `imagemeta`, `generateEmbedding` from `retrieval`, `estimateCost` / `pricing` from `ai`. It deletes nothing and depends on no DB.

---

## Runtime flow

Client-orchestrated **JSON RPCs**, not SSE. Each RPC is a thin auth-gated route adapter over the framework-free domain — the multi-client-core / hexagonal pattern ([../architecture/multi-client-core.md](../architecture/multi-client-core.md)).

```
upload (multipart, +page.server.ts action)
  └─ ingestEphemeralImage
       ├─ sniffImageMime  (magic-byte, ignores client MIME)
       ├─ processImage    (sharp resize ≤1024px + EXIF strip — reused from imagemeta)
       └─ R2 put under showcase/imagekit/{userId}/{uuid}.webp   ← NO DB row
     → returns { imageId, previewUrl, width, height, estimate }
  ↓
"Run" button  ← explicit, never auto-fires (spends AI budget)
  └─ POST vision
       ├─ checkUserBudget
       ├─ getVisionProvider  (Google > OpenAI, Groq excluded)
       ├─ ONE generateText({ output: Output.object({ schema: jsonSchema }) })
       │     fills metadata AND a crop hint in a single pass (image tokens paid once)
       ├─ re-validate result.output through canonical Valibot schema (drift → model_refused)
       ├─ snapToAspect per ratio  ← server re-derives exact crop rects (see below)
       └─ chargeTokens + estimateCost  → { fields, confidence, crops, usage, cost }
  ↓
adjust crops (CropStudio)         optionally → POST crop  (sharp derivative + attention baseline)
optionally embed (EmbedViz)       → POST embed  (caption text default | image multimodal)
  ↓
Approve (ApproveDialog)  ← honest terminal: shows what would persist, download/copy, then
  └─ POST discard  → delete the R2 object (TTL is the safety net)
```

Each RPC uses a route-local `{ ok }` envelope (same convention as the reader's `analyze` RPC), not the repo-wide `{ data } / { error }` shape, because the sole consumer is the sibling `+page.svelte`. Vision failure reasons map to HTTP status: `no_provider`→503, `budget`→429, `model_refused`→422, `timeout`→504, `error`→500.

---

## Decisions & gotchas

### The server never trusts model pixel coordinates

This is the load-bearing geometry rule. The vision model returns only a **salient hint**, never a crop rectangle:

- `subjectBox` — Gemini-native `[ymin, xmin, ymax, xmax]`, each `0–1000`, **y-first**. `[0,0,0,0]` = no subject.
- `focalPoint` — `[x, y]`, each `0–1`. The crop centers here. `[0.5, 0.5]` = no clear subject.

The server re-derives the **exact aspect-ratio rectangle deterministically** via `snapToAspect`, using the true image dimensions, centered on the hint, clamped into bounds. Garbage or absent hints degrade to a deterministic center crop flagged `fallback: true` — they can never throw or escape the image.

Because the server owns the geometry, range validation is intentionally NOT enforced on the model's numbers; out-of-range values are clamped, not rejected. `snapToAspect` lives in `geometry.ts` — pure, no sharp, no AI, fully unit-tested (`geometry.test.ts`).

`largestRatioRect` (the largest ratio rectangle that fits W×H) lives in the **client-safe schema** so the server snap and the client cropper share one implementation and stay in lockstep.

### One merged vision call, not two

Metadata extraction and crop suggestion happen in a single `generateText` pass. Image tokens are the dominant cost; a second call would pay them twice. The system prompt asks for both the metadata fields and the crop hint; the `jsonSchema()` mirrors `imageKitVisionSchema`, and the result is re-validated against that canonical Valibot schema so any drift surfaces as `model_refused` rather than corrupt data. A structurally-valid all-null result (`visionIsEmpty`) also maps to `model_refused` — the model couldn't read the image.

Vision routing is the same load-bearing rule as the reader: `resolveVisionProvider()` filters to `supportsVision === true` and prefers **Google > OpenAI**; Groq is hard-excluded (text-only). See [image-metadata.md](./image-metadata.md#vision-provider-routing-is-load-bearing) for why routing through the default active provider would hand a blind model an image.

### Auth-gated v1 needs no signed handle

The page redirects anonymous users to login. Because the server derives the R2 key from `locals.user.id` + a client-sent UUID `imageId`, **cross-user access is structurally impossible** — a user can only ever address their own keyspace. No signed handle, HMAC, or capability token is needed. `isImageId` validates the id is a real UUID so a client can't smuggle a path segment into the key. Every RPC re-checks `locals.user` and rebuilds the key from the session id.

### Embeddings — text by default, image opt-in

| Modality | Model | Dim | When |
|----------|-------|-----|------|
| **Text** (default) | `gemini-embedding-001` | 1536 | Embeds the AI caption — the honest "this is how RAG indexes an image: via its description" story. Reuses the RAG pipeline's `generateEmbedding`. |
| **Image** (toggle, off by default) | `gemini-embedding-2-preview` | 3072 | Embeds the actual image. **Viz-only, never stored** — dimension-incompatible with the 1536-d text index, and the page persists nothing anyway. |

The fixed concept corpus is re-embedded with whichever model the run used, so cosine similarity is comparable. The raw vector crosses the wire only when the client asks (heatmap); `l2Norm` is reported as a "look inside the model" stat.

### Pre-run cost estimate

A reference estimate is computed from the image dimensions and shown next to the Run button **before** spending, so the cost is visible up front. It uses the same `estimateCost` / `pricing.ts` reference board as the reader — derived, never a charge, `null` for unpriced models. See [image-metadata.md](./image-metadata.md#cost-is-a-reference-estimate-never-a-charge).

### Deterministic crop comparison

The cropper has a **"Compare with deterministic crop"** button. It shows the AI-guided crop side-by-side with sharp's `attention` (saliency) crop at the same ratio — no AI, fully deterministic. This makes the showcase demonstrate "deterministic baseline vs AI guidance" directly.

### Cropper — corner-handle resize (`CropStudio.svelte`)

A custom frame-over-image overlay (no external lib) that maps 1:1 to the server's pixel-rect model. Four draggable **corner handles** resize the frame directly on the image: **ratio-locked / proportional**, with the **opposite corner anchored**, always clamped in-bounds. Drag-to-move, arrow-key nudge (Shift = faster), and the size slider remain. The slider is the keyboard-accessible resize path; handles are pointer-only. The frame can never leave the image; its geometry mirrors the server's `snapToAspect`.

### Approve dialog shows the full crop definition (`ApproveDialog.svelte`)

The terminal is honest: nothing is saved, so instead of a fake "Saved!" it shows exactly what a real app *would* persist. Each ratio lists `width × height px · at (left, top)`.

**The position origin is the image's top-left corner** (x→right, y→down) — the offset to the crop rectangle's top-left, exactly what sharp's `.extract({ left, top, width, height })` consumes. These are pixels of the processed (WebP) derivative. Closing the dialog fires the `discard` RPC.

### Greenfield-additive — the reader is untouched

Image Kit is entirely new code. The `/showcases/toolkits/image-metadata` reader, its `image` pgSchema, its `imagemeta/` persistence, and all admin/GDPR consumers are unchanged. Image Kit reuses framework-free pieces by import only; it deletes nothing.

---

## Ops

The `showcase/imagekit/` prefix needs an **R2 lifecycle TTL rule** so abandoned uploads expire even when `discard` never fires (e.g. a closed tab). This is a manual step in the Cloudflare R2 dashboard, **not code** — the app only does best-effort delete on Approve.

No schema registration is needed: Image Kit writes no Postgres tables, so there is no `schemaFilter` entry and no `db:push` step.

---

## Related

- [image-metadata.md](./image-metadata.md) — the Image Metadata Reader; the persisted sibling Image Kit evolved from (vision routing, cost reference board, `Output.object` reality).
- [provider-routing.md](./provider-routing.md) — the chat/tool/vision resolver split the vision call uses.
- [../architecture/multi-client-core.md](../architecture/multi-client-core.md) — the hexagonal core / thin-adapter pattern the RPC routes follow.
- [graph-rag.md](./graph-rag.md) — the RAG pipeline whose `generateEmbedding` the text-embedding tool reuses.
- `src/lib/server/showcases/imagekit/` — domain core. `src/lib/schemas/showcase/image-kit.ts` — wire + validation contracts.
