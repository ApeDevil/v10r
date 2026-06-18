---
name: plancard-approval-precedent
description: PlanCard is v10r's existing AI human-in-the-loop approval UI — non-modal during stream, streamReady-gated focus shift, aria-live announce; the trust-review pattern to extend, not reinvent
metadata:
  type: project
---

`src/lib/components/composites/chatbot/PlanCard.svelte` is the project's existing human-in-the-loop approval surface (renders `message.metadata.harness.proposal`, backs the `desk_propose_plan` -> `ai.agent_proposal` -> POST `/api/ai/proposals/:id/approve` flow).

Key UX decisions already baked in (reuse these when designing any AI-proposes / human-approves surface):
- **Deliberately NOT a modal while content is still arriving** — a focus trap mid-stream would hijack reading. It is a `role="region"` inline card. Focus only shifts to the primary button once `streamReady` is true AND status is still `pending`, via `$effect`.
- **Risk surfaced with text+badge, never color alone** — destructive steps get a left-border + a literal "Permanent" uppercase token + a count badge in the header. Matches the project forbidden-color-only rule.
- **Terminal status** (executed/rejected/failed/expired) swaps the action row for an `aria-live="polite"` status line; buttons disappear so there's no dead re-click.
- **`busy` prop** disables both buttons + dims the card while approve/reject is in flight (prevents double-submit, mirrors superforms `$submitting`).
- Copy is currently hardcoded English in this component (not Paraglide) — a known gap; cony owns fixing it.

**Why:** The Image Metadata Reader approval dialog is the same trust shape (AI fills, human verifies before persist). Don't reinvent the focus/announce/risk-display logic — lift it.

**How to apply:** For Image Metadata Reader, the approval surface differs in ONE way: persistence is gated and synchronous (not a streaming batch), so a real `ConfirmDialog`-style modal WITH focus trap is correct there (vs PlanCard's non-modal). But keep PlanCard's: streamReady→focus rule (here: analysis-complete→focus), aria-live completion announce, text+shape risk/provenance cues, busy-disables-actions. Related: [[ai-control-room-a11y-floor]], [[mydata-color-only-state]].
