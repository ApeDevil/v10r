---
title: "Deskbot approval gate (proposal → approve, plan-gated mutation)"
description: "Write/destructive desk tools never mutate inside the agent loop; they return a requiresApproval sentinel that becomes a proposal (PlanCard), executed only via…"
category: "AI"
---

# Deskbot approval gate (proposal → approve, plan-gated mutation)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-08-20 @ 1a130d67) · **Risk:** high — the safety boundary for AI mutation

Write/destructive desk tools never mutate inside the agent loop; they return a requiresApproval sentinel that becomes a proposal (PlanCard), executed only via an approve-route replay that records the real approver and time.

**When to use:** Mandatory companion to any mutating AI tool: it converts 'the model wants to write' into an auditable human decision.

## Docs

- [docs/blueprint/ai/harness-lens.md](/docs/blueprint/ai/harness-lens) — Where the gate sits in the harness ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/harness-lens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/harness-lens.md))
- [docs/blueprint/ai/desk-integration.md](/docs/blueprint/ai/desk-integration) — Proposal lifecycle in the desk ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/desk-integration.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/desk-integration.md))

## Code

- `src/lib/server/ai/tools/propose-plan.ts` — Proposal creation ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/propose-plan.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/propose-plan.ts))
- `src/lib/server/ai/tools/desk-execute.ts` — executeDeskToolCall — the one door ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-execute.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-execute.ts))
- `src/lib/server/ai/policy/governor.ts` — requiresApproval(risk): write/destructive gated, read/create not ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.ts))
- `src/routes/api/ai/proposals/[id]/approve/+server.ts` — Approve-route replay ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/ai/proposals/[id]/approve/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/ai/proposals/[id]/approve/+server.ts))

## Tests

- `src/lib/server/ai/tools/propose-plan.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/propose-plan.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/propose-plan.test.ts))
- `src/lib/server/ai/tools/desk-execute.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/desk-execute.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/desk-execute.test.ts))
- `src/lib/server/ai/policy/governor.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.test.ts))

## Invariants

- The hard gate is at the tool layer — write/destructive tools return a requiresApproval sentinel; requiresApproval(risk) is the single rule.
- Planning is soft guidance, not the gate — shouldRequirePlan only decides whether to instruct the model to plan.
- Approval binds execution — the post-approval resume turn is filtered to read-only scopes so it cannot re-mutate.

## Emulation notes

- An earlier design (inline ConfirmCard with a model-minted confirmed=false→true handshake) was superseded and never shipped — do not emulate it; the proposal→approve flow is the proven shape.
- Record who approved and when at the approve route — the audit trail is the point.

## Depends on

- [AI tool manifest & harness split (tool defs, risk metadata, registry)](/docs/pattern-library/ai-tool-harness)
- [AI surfaces (chatbot vs deskbot split over one guard)](/docs/pattern-library/ai-surfaces)

---

_Machine-readable record: `deskbot-approval-gate` in `pattern-library/registry.json`._
