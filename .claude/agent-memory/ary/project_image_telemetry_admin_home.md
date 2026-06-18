---
name: image-telemetry-admin-home
description: Canonical home for Image Metadata Reader admin telemetry queries + the /admin/ai cost-tab placement and sub-nav registry location
metadata:
  type: project
---

Image Metadata Reader admin telemetry (read-side aggregates over `image.ai_proposal`) lives in **`$lib/server/imagemeta/admin.ts`**, exported via `imagemeta/index.ts` — NOT in `db/showcase/` or `db/ai/`.

**Why:** `image.ai_proposal` is in its OWN `image` pgSchema (declared in `schema/showcase/image-metadata.ts`, despite the folder name). The only module that touches that table is the `imagemeta` domain (`handlers.ts::recordProposal` writes it). Canonical-home rule: a read aggregate over a table belongs in the domain that owns the table. `db/showcase/` is a 3-file barrel (guards/mutations/seed) for ephemeral demo tables — it hosts NO admin queries. `db/ai/` owns `ai.*` tables only; parking an `image.*` query there is a file lying about its concern.

**How to apply:** When asked where Image Reader telemetry/admin queries go → `imagemeta/admin.ts`. The chatbot equivalent (`getModelUsage`, `ModelUsageRow`) stays in `db/ai/admin-queries.ts` over `ai.conversation_step`. The two telemetry domains never import each other; cross-surface union happens ONLY at the loader (see C2 below).

**Cross-surface AI telemetry UI (task-force verdict 2026-06-18):** new `/admin/ai/cost` tab owns a unified usage-by-model table keyed on **(surface, modelId)** — NOT modelId alone (gemini-2.5-flash appears in both chat and image with different token profiles). Relocate the existing chatbot `getModelUsage` table OUT of the Models tab (Models = routing/config only) INTO Cost. Image health (approval funnel + heartbeat) gets a card on Cost. Cost shown only where `ai/pricing.ts` has a price; em-dash unpriced rows; `<tfoot>` total = priced rows only, labelled "priced models only." Union seam = loader, page owns the row-type mapping (no shared `db/telemetry-types.ts` leaf at N=2).

**Sub-nav registry GOTCHA:** the `/admin/ai` sub-tabs (Overview/Models/Usage/nRAG/Tools) are a HARDCODED `tabs` array inside `src/routes/[[locale=locale]]/admin/ai/+layout.svelte` (lines 10-16) — NOT in `$lib/nav/nav.ts`. Adding a tab = one edit there. `.ai-tabs` already has `overflow-x:auto` so a 6th tab is fine. Loaders live per-tab at `admin/ai/<tab>/+page.server.ts`.

**Tripwire:** lift a neutral `UsageBySurfaceRow` + `collectUsageBySurface()` fan-out into `$lib/server/ai/telemetry/` only when a THIRD AI surface needs the cost tab — adapter-per-surface (like transparency `collectUserData`), not speculatively at N=2. See [[transparency-data-surfaces]] for the fan-out-not-god-module precedent.
