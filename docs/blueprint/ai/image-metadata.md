# Image Metadata Reader

A vision model proposes metadata for an uploaded image; the human reviews and approves before anything persists. Lands as a server-backed showcase at `/showcases/ai/image-metadata`.

> The showcase page is the UI documentation. This doc covers the architecture, the runtime flow, and the decisions the page can't show.

---

## What it is

Upload an image → a vision-capable provider analyses it and pre-fills a metadata form (title, caption, alt text, keywords, category) with per-field confidence → a manual form is always usable → an **approval dialog** diffs AI-proposed against to-be-saved values before persisting.

The manual form is the ground floor: every AI failure mode collapses to a typed envelope so the form keeps working with zero AI.

---

## Module map

| Piece | Location | Role |
|-------|----------|------|
| Domain core | `src/lib/server/imagemeta/` | Framework-free: ingest, process, extract, persist. Modeled 1:1 on `src/lib/server/cycle/`. |
| Vision resolver | `src/lib/server/ai/providers.ts` | `supportsVision` flag + `resolveVisionProvider()`; exposed as `getVisionProvider()` from `ai/index.ts`. |
| Price board | `src/lib/server/ai/pricing.ts` | Hand-maintained reference rates (sibling of `provider-limits.ts`). `MODEL_PRICES` + `estimateCost()` → `CostEstimate \| null`. Server-only; never ships to the client. |
| Canonical schema | `src/lib/schemas/showcase/image-metadata.ts` | One source, three consumers: AI-propose schema + strict save schema + helpers. Also holds the client-safe `AnalyzeUsage` / `CostEstimate` DTO types. |
| Storage | `src/lib/server/store/showcase/image.ts` | R2 ops under the `showcase/imagemeta/` prefix. |
| DB | `src/lib/server/db/schema/showcase/image-metadata.ts` | Dedicated `image` pgSchema: `asset` / `metadata` / `ai_proposal` / `tag` / `metadata_tag`. `ai_proposal` stores token counts (incl. nullable `reasoning_tokens`), never dollars. |
| Route | `src/routes/[[locale=locale]]/(public)/showcases/ai/image-metadata/` | `+page.server.ts` (load + `upload`/`save` actions), `analyze/+server.ts` (RPC — returns `fields`/`confidence` + `usage`/`cost`), `MetadataApprovalDialog.svelte`. |

### Import wall

```
imagemeta → ai / store / db / schemas
ai ✗ never imports imagemeta
```

Vision is a **provider capability**, not a chat feature. `ai/` exposes `getVisionProvider()` and stops there; `imagemeta/` owns the image domain. The wall keeps the AI subsystem from growing an image dependency.

---

## Runtime flow

```
upload (multipart)
  └─ ingestImage
       ├─ magic-byte sniff (sniffImageMime — ignores client MIME)
       ├─ EXIF parse  ← reads GPS from the ORIGINAL bytes
       ├─ sharp re-encode/resize ≤1024px  ← strips ALL EXIF/GPS
       └─ store WebP derivative + image.asset row
  ↓
"Analyze" button  ← explicit, never auto-fires (spends AI budget)
  └─ POST analyze
       ├─ ownership gate (getUserImage)
       ├─ resolveVisionProvider  ← Google > OpenAI, Groq excluded
       ├─ generateText({ output: Output.object({ schema: jsonSchema(...) }) })
       ├─ re-validate result.output through canonical Valibot schema
       ├─ recordProposal (append-only run snapshot + token counts)
       └─ estimateCost(modelId, tokens)  ← reference $ estimate, NOT a charge
  ↓
taint-guarded merge  ← AI fills only fields the user hasn't touched
  ↓
review & approve dialog  ← diff table + GPS consent gate
  ↓
save action → saveImageMetadata (atomic upsert + tag replace)
```

The `analyze` endpoint returns a route-local `{ ok, fields, confidence }` RPC shape (not the repo-wide `{ data } / { error }` envelope) because its sole consumer is the sibling `+page.svelte`, which branches on `ok` and merges field-by-field. Failure reasons map to HTTP status: `no_provider`→503, `budget`→429, `model_refused`→422, `timeout`→504, `error`→500.

---

## Decisions & gotchas

### GPS is opt-in, and the dialog is the consent gate

EXIF (including GPS) is parsed from the original upload **before** the sharp strip. The stored derivative carries no EXIF — sharp drops all metadata by default (the code never calls `withMetadata`). GPS coordinates only reach the DB when the user toggles `includeLocation` **and** approves in the dialog; otherwise they never touch persistence.

The opt-in surfaces in the GDPR data report: the `images` section reports `withGpsCount` (records where the user persisted location), countable because GPS lives in a typed `gps_lat`/`gps_lng` column, never only inside a blob. `REPORT_SCHEMA_VERSION` bumped to `2026-06-17`.

### Vision-provider routing is load-bearing

`resolveVisionProvider()` filters to `supportsVision === true` and prefers **Google > OpenAI**. Groq is hard-excluded — `llama-3.3-70b-versatile` is text-only.

This is not optional defense. The default active provider is registry index 0 (Groq). Routing image extraction through `resolveActiveProvider` would hand a blind model an image part and get a hallucinated form. Image extraction **must** go through `getVisionProvider`.

| Provider | Model | `supportsVision` |
|----------|-------|------------------|
| Groq | llama-3.3-70b-versatile | false (excluded) |
| OpenAI | gpt-4o-mini | true |
| Google Gemini | gemini-2.5-flash | true (preferred) |

### Cost is a reference estimate, never a charge

The cost panel shows token counts as the primary fact and a `≈ $X` dollar figure as secondary. The dollars are a **reference** at standard pay-as-you-go rates — our Gemini key is free-tier, so the real charge is `$0`. `CostEstimate.kind: 'reference'` is the machine-readable honesty bit; the UI carries an always-visible "Reference estimate · not a charge" badge plus a "You're on the free tier — this run cost $0.00" footnote (the one place `$0.00` is literally true: it states the real charge, not the estimate). Same "honest reference, not a fake gauge" stance as the [admin AI quota board](./provider-routing.md).

`estimateCost(modelId, tokens)` returns `null` — never a guess — for an unpriced model or missing tokens. `pricing.ts` is keyed by **`modelId`, not `providerId`**: per-image vision-token cost differs ~25× between models on the same provider, so a per-provider rate would be wrong.

**Cost is derived, never stored.** `ai_proposal` persists token counts only; dollars are computed at read-time from the versioned price map. A future rate change re-prices historical runs correctly. The price table is server-only — it never crosses the wire.

### Thinking tokens are a subset of output

gemini-2.5-flash runs reasoning ON. `thoughtsTokenCount` is read defensively from `result.providerMetadata.google.usageMetadata`, persisted to the nullable `reasoning_tokens` column, and shown as an indented "of which thinking" sub-line.

**The SDK's `outputTokens` already includes thinking tokens.** Confirmed live 2026-06-18 against gemini-2.5-flash: `usage.totalTokens 1051 === input 491 + output 560`, with `reasoning 380` already inside output. So the displayed total is `input + output` — reasoning is **not** added (that would double-count), and cost prices output as-is. Encoded as `OUTPUT_TOKENS_INCLUDE_THINKING = true` in `pricing.ts`; flip to `false` only if a future provider reports thinking separately.

The wire payload reflects this: the `analyze` RPC success shape gained `usage` (provider/model/token counts + `durationMs`, counts individually nullable) and `cost` (`CostEstimate | null`) beside `fields`/`confidence`.

### AI SDK v6 structured-output reality

Use `generateText({ output: Output.object({ schema }) })` with an SDK `jsonSchema()` — not a Valibot schema passed directly, and not the deprecated `generateObject`. Read the result via `result.output`.

The `jsonSchema()` in `extract.ts` mirrors the canonical Valibot `imageAnalysisSchema`. The model output is then **re-validated** against that Valibot schema (single source of truth), so any drift between the two surfaces as a `model_refused` rather than corrupt data. A structurally-valid all-null object (`analysisIsEmpty`) also maps to `model_refused` — the model couldn't read the image.

### Whole-form atomic approval

One `status` enum drives the entire metadata record (`draft` → `proposed` → `approved` → `rejected`). Approval is whole-form, not per-field.

`fieldProvenance` (`empty` | `ai-draft` | `human`, per content field) is **advisory audit only** — it never gates save. It rides the save action as a JSON hidden field, parsed defensively: a missing or garbage value defaults every field to `human` (the user is clicking save).

### Dedicated `image` schema, not `ai.agent_proposal`

The feature carries real per-user data with a GDPR surface, so it gets its own `image` Postgres namespace rather than sharing `showcase`. It deliberately does **not** reuse `ai.agent_proposal`: that table's `conversationId`/`messageId` are NOT-NULL FKs and its payload is `ProposedToolCall[]` — an image proposal is neither.

### Server-proxied upload (not client-direct presigned)

Upload routes through the server `upload` action specifically so EXIF can be stripped before any bytes are stored. A client-direct presigned PUT would land the original (GPS-bearing) file in R2.

### Client gotchas (SvelteKit + Superforms)

Three client-side traps this page hit. All verified in-browser.

**Relative fetch resolves against the parent path.** The page is `/showcases/ai/image-metadata` (no trailing slash), so `fetch('./analyze')` resolved to `/showcases/ai/analyze` → 404; the sibling `analyze/+server.ts` never ran. Build the URL from the live pathname instead — locale-prefix-safe and rename-safe:

```ts
fetch(`${location.pathname.replace(/\/$/, '')}/analyze`)
```

**A `$effect` reading `$form.x` subscribes to the whole store.** The keyword effect read `$form.keywords`, so it re-ran on *every* field edit (title, caption, …) and spuriously marked keywords as human-edited — routing AI-proposed keywords into a "conflict" instead of applying them. Key the effect off a memoized derived of just that field:

```ts
const keywordsKey = $derived($form.keywords.join(' '));
```

**A sibling plain `$app/forms` `enhance` that calls `update()` resets `$form`.** The upload action returns `{ uploaded }`, not a form. Calling `update({ reset: false })` applied that form-less result to `$page.form`, triggering Superforms' `applyAction` to reset `$form` to its loaded defaults — wiping the `$form.imageId` the callback had just set, so the later save posted an empty `imageId` and failed validation. Don't call `update()` in the upload callback; handle the result manually so upload stays decoupled from the Superforms form.

**Array fields serialize back to the same root issue.** The keyword array is a `bind:value` component with no named inputs, so it needs a hidden-input mirror (or `dataType: 'json'`) to post at all — see [../forms.md](../forms.md) (Array/Dynamic Fields).

### Ops: register the schema in `schemaFilter`

The new `image` pgSchema **must** be added to `drizzle.config.ts`'s `schemaFilter`, or `db:push` silently skips it and the tables never get created.

---

## Related

- `src/lib/server/imagemeta/` — domain core (extract, process, handlers, types)
- `src/lib/schemas/showcase/image-metadata.ts` — canonical propose + save schemas
- [provider-routing.md](./provider-routing.md) — the dual chat/tool resolvers this vision resolver sits beside
- [../../stack/capabilities/gdpr.md](../../stack/capabilities/gdpr.md) — the privacy report `images` section + GPS opt-in
