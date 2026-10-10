---
title: "Deskbot approval gate (proposal → approve, plan-gated mutation)"
description: "Write/destructive desk tools never mutate inside the agent loop; they return a requiresApproval sentinel that becomes a proposal (PlanCard), executed only via…"
category: "AI"
---

# Deskbot approval gate (proposal → approve, plan-gated mutation)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-10-10 @ 91f61a76-dirty) · **Risk:** high — the safety boundary for AI mutation

Write/destructive desk tools never mutate inside the agent loop; they return a requiresApproval sentinel that becomes a proposal (PlanCard), executed only via an approve-route replay that records the real approver and a receipt per step — and a plan that ran can be undone once, step by step, by compare-and-swap compensation.

**When to use:** Mandatory companion to any mutating AI tool: it converts 'the model wants to write' into an auditable human decision.

**Requires:** postgres, ai-provider

## Avoid when

- Every tool is read-only or a reversible create — requiresApproval gates write and destructive risk only, so nothing would become a proposal
- The agent runs unattended with no human to approve — proposals would sit pending and the mutation would never execute

## Alternatives

- **Mutate in the loop and rely on reversal (soft delete, pre-image revision)** — prefer when every mutation is cheaply reversible, as desk creates are, so an auto-approved in-loop run loses nothing

## Docs

- [docs/blueprint/ai/harness-lens.md](/docs/blueprint/ai/harness-lens) — Where the gate sits in the harness ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/harness-lens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/harness-lens.md))
- [docs/blueprint/ai/desk-integration.md](/docs/blueprint/ai/desk-integration) — Proposal lifecycle in the desk ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/desk-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/desk-integration.md))
- [docs/blueprint/ai/surfaces.md](/docs/blueprint/ai/surfaces) — The one door, receipts, and undo ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/surfaces.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/surfaces.md))

## Code

- `src/lib/server/ai/tools/propose-plan.ts` — Proposal creation ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/propose-plan.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/propose-plan.ts))
- `src/lib/server/ai/tools/desk-execute.ts` — executeDeskToolCall — the one door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-execute.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-execute.ts))
- `src/lib/server/ai/policy/governor.ts` — requiresApproval(risk): write/destructive gated, read/create not ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.ts))
- `src/routes/api/ai/proposals/[id]/approve/+server.ts` — Approve-route replay ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/proposals/[id]/approve/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/proposals/[id]/approve/+server.ts))
- `src/lib/server/ai/proposals/execute-proposal.ts` — Replay: receipt + recovery point per step, fenced ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/proposals/execute-proposal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/proposals/execute-proposal.ts))
- `src/lib/server/ai/proposals/revert-proposal.ts` — Undo: chained compare-and-swap compensation with revert receipts ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/proposals/revert-proposal.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/proposals/revert-proposal.ts))
- `src/routes/api/ai/proposals/[id]/revert/+server.ts` — Undo route — one revert per proposal ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/proposals/[id]/revert/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/proposals/[id]/revert/+server.ts))

## Tests

- `src/lib/server/ai/tools/desk-gated.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-gated.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-gated.test.ts))
- `src/lib/server/ai/tools/desk-execute.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-execute.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-execute.test.ts))
- `src/lib/server/ai/policy/governor.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.test.ts))
- `src/lib/server/ai/proposals/execute-proposal.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/proposals/execute-proposal.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/proposals/execute-proposal.pglite.test.ts))
- `src/lib/server/ai/proposals/revert-proposal.pglite.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/proposals/revert-proposal.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/proposals/revert-proposal.pglite.test.ts))
- `src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/desk/panels/bot/desk-bot-session.svelte.test.ts))

## Invariants

- The hard gate is at the tool layer — write/destructive tools return a requiresApproval sentinel; requiresApproval(risk) is the single rule.
- Planning is soft guidance, not the gate — shouldRequirePlan only decides whether to instruct the model to plan.
- Approval binds execution — the persisted args replay under the scopes frozen at proposal time, against the reviewed baseline, and no model turn follows: the door writes a deterministic execution receipt message.
- A run healed to failed('interrupted') is fenced: each step's transaction locks the proposal and refuses unless it is still executing, so a stalled executor cannot commit behind the terminal status.
- Undo is compensation, not rollback: one compensating step per receipt, in reverse, each a compare-and-swap against the state the plan left (chained per file) — work the user did since is reported as a conflict, never overwritten.
- Undo never widens the model's surface: restores go to the desk domain directly as the asking user, outside executeDeskToolCall and the tool manifest.
- The one undo a plan has belongs to the owner of its conversation — checked in the claim itself, so no door can spend it for someone else; a plan whose steps recorded no recovery point is refused rather than 'undone' as a no-op.

## Emulation notes

- An earlier design (inline ConfirmCard with a model-minted confirmed=false→true handshake) was superseded and never shipped — do not emulate it; the proposal→approve flow is the proven shape.
- Record who approved and when at the approve route — the audit trail is the point.
- Capture what an undo needs when the step runs (its recovery point, on the receipt, in the same transaction) — reconstructing it later from the current file is guessing.
- Key the revert receipt by the forward step it undoes, with a foreign key onto that receipt: a revert of a step that never ran, or a second undo of one step, then cannot be written at all.

## Depends on

- [AI tool manifest & harness split (tool defs, risk metadata, registry)](/docs/pattern-library/ai-tool-harness)
- [AI surfaces (chatbot vs deskbot split over one guard)](/docs/pattern-library/ai-surfaces)
- [Durable step execution (claim, lease, fence, receipts)](/docs/pattern-library/durable-step-execution)

---

_Machine-readable record: `deskbot-approval-gate` in `pattern-library/registry.json`._
