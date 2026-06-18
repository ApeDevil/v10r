---
name: image-telemetry-admin-contract
description: Contract verdict for surfacing Image Metadata Reader AI telemetry on /admin/ai/models — UnifiedModelUsageRow + honest ModelUsageSummary under partial cost coverage
metadata:
  type: project
---

Round-2 (cross-pollination) contract verdict for adding Image Metadata Reader telemetry to the admin AI monitoring "Usage by Model" table.

**Decision:** Two separate queries, app-layer combine (NO UNION/VIEW), loader-only (no REST endpoint), `requireAdmin`. Cost derived at read via `estimateCost`, never a query column.

**`UnifiedModelUsageRow`** (locked): `surface: 'chat'|'image'` discriminator (load-bearing) + `model` + `providerId: string|null` + `inputTokens/outputTokens: number|null` (NULL preserved — drop COALESCE) + `reasoningTokens: number|null` (always null for chat) + `calls` + `callUnit: 'step'|'analysis'` + `cost: CostEstimate|null`.

**`ModelUsageSummary`** (the honesty piece): `rowCount`, `pricedRowCount`, `costCoverage: 'full'|'partial'|'none'`, nullable token totals (input+output only, reasoning excluded), `totalCostUsd: number|null` (summed over priced rows only), `costKind: 'reference'`. `costCoverage` is THE load-bearing field — it makes a misleading grand total structurally un-renderable when cost coverage is partial.

**Why:** UXY raised C3 — chatbot rows show no cost, image rows do; one shared table with a cost column + totals row sums a half-populated column into a number that reads as "total spend". Math is correct, the *claim* is false. `costCoverage` discriminant forces the UI to qualify partial totals.

**C3 verdict:** EXTEND `MODEL_PRICES` to cover chat-only models (groq etc.) with documented published rates so `costCoverage:'full'` is the common case; leave genuinely-unpriced models out → `estimateCost` returns null → render `—`. Adding price rows needs real `verifiedOn`/`sourceUrl` — a developer data-entry task, never fabricate rates.

**C4 confirmed from source:** `estimateCost` (pricing.ts:84-85) already returns null when model unpriced OR both tokens null. COALESCE-to-0 is LIVE in `getModelUsage` (admin-queries.ts:193-194) — must drop it so all-null SUM stays NULL, else instrumentation-pending rows render "$0.0000 free" instead of "not reported".

**How to apply:** Modify `getModelUsage` (add providerId, nullable tokens, drop COALESCE); add `getImageModelUsage(days)` over `image.ai_proposal` (GROUP BY modelId,providerId; bare SUM; count AS analyses). Reuse `CostEstimate` from [[image-metadata]] schemas — don't redefine. Combine+summary helper goes framework-free in $lib/server/ai/ for testability. Biggest risk = shipping UnifiedModelUsageRow without costCoverage, or keeping COALESCE — both honesty fixes must land together.
