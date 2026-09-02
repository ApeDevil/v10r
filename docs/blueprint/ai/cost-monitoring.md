# AI Cost Monitoring

Cross-surface AI-spend monitoring, served on the admin **Cost** tab (`/admin/ai/cost`). One table merges token usage from every AI surface and prices it from a reference rate table — derived at read, never charged, never faked.

> The dollars are a **reference** at standard pay-as-you-go rates. Our keys run free-tier, so the real charge is `$0`. Same honesty stance as the [provider quota board](./provider-routing.md) and the [image reader cost panel](./image-metadata.md).

---

## What it is

`/admin/ai/cost` is the 6th AI admin sub-tab: **Overview · Models · Usage · Cost · Retrieval · Tools**. It answers one question — "how many tokens did each model burn across the whole app, and roughly what would that cost?" — without ever implying a real bill.

The tab holds three things:

| Block | Source | Shows |
|-------|--------|-------|
| **Usage by Model (30 days)** | chat + image telemetry, merged | per-`(surface, model)` token counts + reference cost |
| **Image Metadata Reader health** | image telemetry | analysis KPIs + a binary save/abandon funnel |
| **Image Analyses per Day** | image telemetry | 30-day volume bar chart (`VolumeBarChart.svelte`, shared with the Usage tab) |

**Relocation:** the chatbot per-model token table once lived on the **Models** tab. It now lives here, widened to cover both surfaces. The Models tab is provider routing/config only.

---

## The cross-surface merge

Two telemetry tables feed the usage table, and they stay independent:

| Surface | Table | Counts a "call" as |
|---------|-------|--------------------|
| `chat` | `ai.conversation_step` | a step |
| `image` | `image.ai_proposal` | an analysis |

The merge is **app-layer, never SQL**. `buildUnifiedModelUsage(chatRows, imageRows)` in `src/lib/server/ai/usage-summary.ts` is the only place that knows both tables exist — no `UNION`, no DB view, no shared schema. Each surface keeps its own query module; the seam is one pure function.

Rows are keyed on `(surface, modelId)`. The same model can appear twice — once per surface — with different token profiles (a chat step and a vision analysis spend very differently). Busiest rows sort first; rows with no reported tokens sort last.

Columns: **Surface · Model · Provider · Input · Output · Thinking · Total · Calls · Ref. cost**, plus a `<tfoot>` totals row. `Calls` carries its unit (`steps` vs `analyses`) and is therefore **not summed** in the footer — the two units don't add up.

---

## Honesty model

Three rules make a misleading number structurally impossible.

### Cost is reference, derived, never stored

Each row's `cost` comes from `estimateCost(modelId, tokens)` in [`pricing.ts`](./image-metadata.md), keyed by `modelId` (vision-token cost differs ~25× across models on one provider). The estimate is computed at read from the versioned price map — token counts are the only stored fact. `CostEstimate.kind: 'reference'` is the machine-readable honesty bit; the summary's `costKind` is always `'reference'`.

### Partial coverage shows "—", never a fake $0

All three chat/vision models the app can invoke are priced (`gemini-2.5-flash`, `gpt-4o-mini`, `llama-3.3-70b-versatile`). Two things remain permanently unpriced, and both are structural rather than a missing table row:

- **The `unknown` bucket** — `admin-queries.ts` COALESCEs a NULL `model_id` to the literal `'unknown'`, which can never be a price-table key.
- **Embeddings** (`gemini-embedding-001`) — these produce **no rows in either usage table**, so `buildUnifiedModelUsage` never sees them. Pricing them needs a new telemetry source, not a `MODEL_PRICES` entry; and `ModelPrice` has no embedding-shaped field (`outputPerMillion` is meaningless for an embedding call).

`estimateCost` returns `null` for anything unpriced, and the row renders **"—"**, never `$0`.

The summary carries `costCoverage: 'full' | 'partial' | 'none'` and `pricedRowCount`. The totals row sums cost over **priced rows only**, and a caption states the coverage: *"Cost summed over N of M priced rows — unpriced models show '—', rates as of {asOf}."* A grand total that silently drops unpriced models can't masquerade as complete.

### Token Total = Input + Output only

"Thinking"/reasoning tokens are a **subset of output**, already inside Total. They get their own column for transparency but are **never added on top** — doing so double-counts reasoning-heavy models by ~40%. The footer's Thinking cell is intentionally "—".

---

## Image Metadata Reader health

A heartbeat block for the image showcase, on the same tab.

**KPI tiles:** successful analyses (30d), analyses today, distinct images (30d), last analysis (relative time).

**Binary conversion funnel — saved vs abandoned.** This is *conversion*, not approval quality. The code only ever writes metadata `status='approved'` at save time; the `rejected` / `draft` / `proposed` enum values exist but are never written, so there is no reject path to measure. "**Abandoned**" = an image was analyzed but no metadata record was saved.

**Failure visibility caveat.** Failed analyses (provider error, timeout, unreadable image) are **not recorded**. Counts are therefore labelled "successful analyses" — there is no true success rate. The tab states this limitation inline; treat the numbers as a floor.

---

## Overview-tab heartbeat

The **Overview** tab gains a small Image Metadata Reader card (analysis counts) linking here. It deliberately shows **no dollar figure** — money stays off the glance layer so a `$` next to chat counts can't be misread as "total AI spend." Dollars live only on the Cost tab, always captioned as reference.

---

## Module map

| Piece | Location | Role |
|-------|----------|------|
| Merge seam | `src/lib/server/ai/usage-summary.ts` | `buildUnifiedModelUsage()` — app-layer union + honest summary |
| Price table | `src/lib/server/ai/pricing.ts` | `MODEL_PRICES` + `estimateCost()`; reference, server-only |
| Chat usage query | `src/lib/server/db/ai/admin-queries.ts` | `getModelUsage()` — adds `providerId`, nullable token sums |
| Image usage queries | `src/lib/server/db/ai/image-metadata-queries.ts` | `getImageModelUsage` / `getImageVolumeByDay` / `getImageConversionFunnel` / `getImageUsageKpis` |
| Client DTOs | `src/lib/schemas/admin/model-usage.ts` | `UnifiedModelUsageRow`, `ModelUsageSummary`, `AiSurface` |
| Volume chart | `src/lib/components/admin/ai/VolumeBarChart.svelte` | Shared by Usage + Cost tabs |
| Page | `src/routes/[[locale=locale]]/admin/ai/cost/+page.svelte` | The tab |

A DB index `image_ai_proposal_created_model_idx (created_at DESC, model_id)` backs the per-model and per-day image rollups.

---

## Related

- [provider-routing.md](./provider-routing.md) — the quota & limits board on the Models tab; same honest-reference stance
- [image-metadata.md](./image-metadata.md) — the image reader's own cost panel + `pricing.ts` decisions
