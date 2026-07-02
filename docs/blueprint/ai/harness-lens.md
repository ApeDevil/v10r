# Harness Lens

*"Harness" is a lens we use to audit the bot's post-prompt-dispatch machinery — not a module. If you're looking for the harness, read `ai/loop`, `ai/context`, `ai/policy`, and `ai/tools` together.*

## What the term means here

In agent-tooling discourse, a **harness** is everything after the first prompt dispatch: tool execution, safety gating, context compaction, state persistence, and observability. Four families exist — CLI harnesses (Claude Code), framework harnesses (Vercel AI SDK, LangGraph), IDE harnesses (Cursor), and eval harnesses (inspect-ai). v10r is a **product-embedded bot**, not a CLI, so only the subset of harness patterns that pay back in an end-user product ships here.

We use the term as a diagnostic. Asking "does v10r have all the harness primitives?" surfaces gaps. Once the gap is named and fixed, the term retires — the code lives under concrete slice names, not `harness/`.

## Primitives — who owns what

| Primitive | Owning slice | File |
|---|---|---|
| Tool dispatch & schema-level scope filtering | `ai/tools` | `tools/index.ts` — `createDeskTools(userId, scopes, layout)` |
| Tool metadata (surface-split) | `ai/tools` | `tools/_types.ts` — surface-neutral `ToolRisk`/`ToolMeta` (chatbot retrieval, no scope) + `DeskToolMeta` (adds `scope`); collections `chatbotToolMeta` / `deskbotToolMeta` / `allToolMeta` in `tools/index.ts` |
| Desk-mutation SSOT (one-door rule) | `ai/tools` | `tools/desk-execute.ts` — `executeDeskToolCall`: the proposal-approval replay routes every desk mutation through it; `index.test.ts` drift-guards the replay map against the live tool set |
| Approval gate (risk → proposal) | `ai/policy` + `ai/tools` | `policy/governor.ts` — `requiresApproval(risk)` (`write`/`destructive` gated); write/destructive tools return a `requiresApproval` sentinel instead of mutating |
| Step loop & provider fallback | `ai` | `chat-orchestrator.ts` — `streamText` + `stopWhen` + `tryFallback` (provider fallback & cooldown) |
| Per-request scope step caps | `ai/tools` | `tools/index.ts` — `stepsForScopes` (read-only incl. `desk:ask` = 3, mutation = 5) |
| Context compaction (fixes AI SDK #9631) | `ai/loop` | `loop/compact.ts` — `compactToolResults` + `resolve_ref` tool |
| System prompt assembly | `ai/context` | `context/system-prompt.ts` — `buildSystemPrompt`, cache-stable prefix ordering |
| Retrieval integration | `ai` | `chat-orchestrator.ts` — llmwiki + rawrag pipeline events |
| Conversation windowing | `ai/context` | `context/system-prompt.ts` — `windowMessages` |
| Plan-gating predicate | `ai/policy` | `policy/governor.ts` — `shouldRequirePlan` |
| Proposal state machine | `db/ai` + `ai/policy` | `db/schema/ai/proposal.ts`, `db/ai/proposals.ts` |
| Audit log (scaffolded stub) | `db/ai` | `db/schema/ai/audit-log.ts` |

## What ships as load-bearing vs. scaffold

**Load-bearing** (exercised on every request): tool dispatch, step loop, provider fallback, compaction, system-prompt assembly, proposals table, `agent_proposals` row writes.

**Scaffolded stub** (seam visible, one write site, no query UI): `agent_audit_log` — retention policy is a product decision v10r should not make for adopters.

## What we explicitly don't ship

- **SKILL.md files** — developer-CLI pattern, category error for a product bot.
- **Visible subagent delegation** — dev-tool concept, invisible in Linear/Notion.
- **Generator-evaluator auto-review** — same-model evaluation "confidently praises regardless of quality" (Anthropic).
- **Full Mastra adoption** — framework weight without matching payoff at this scope.
- **Per-tool `needsApproval: true`** — approval fatigue is reproducible; risk-tiered gates are the working pattern.
- **A `harness/` module** — the seam is emergent across `loop/context/policy/tools`; naming it adds no value.

## Approval gate + plan-before-execute

Two distinct mechanisms govern deskbot mutations.

**The hard gate is at the tool layer.** A deskbot **write or destructive** tool (`desk_update_cells`, `desk_rename_file`, `desk_update_markdown`, `desk_delete_file`) never mutates in the agent loop — its `execute` validates the target and returns a `requiresApproval` sentinel. `requiresApproval(risk)` in `policy/governor.ts` is the single rule: `write`/`destructive` gated, `read`/`create` not (creates are reversible via soft delete, so they mutate in-loop, auto-approved). The orchestrator turns the sentinel into a pending `agent_proposal` (PlanCard); the mutation runs **only** via the approve-route replay through `executeDeskToolCall` (the one-door SSOT), which records a real `approvedBy`/`approvedAt`. Even a single-target overwrite or delete is gated — the old self-serve `confirmed: boolean` two-phase handshake (which the model could satisfy itself) is gone.

**Planning is soft guidance, not the gate.** `shouldRequirePlan({ mutatingScopeGranted, destructiveIntent })` decides only whether to *instruct* the model to plan first — inject the `<planning>` block so it batches work into one `desk_propose_plan`. It was widened from the old three-condition AND (≥2 tools + ≥2 targets), which let every single-target destructive op skip planning; now any granted-mutating-scope + destructive-intent turn gets the nudge. It no longer decides whether a mutation may run — the `requiresApproval` sentinel does.

The execute path closes the loop. Each `desk_propose_plan` step carries its exact `args`, persisted on the proposal payload; on approval the approve-route replays them step-by-step through `executeDeskToolCall`, short-circuiting on first failure with the partial result kept (no rollback). The resume turn that follows is **read-only** — its desk scopes are filtered to `desk:read`/`desk:ask` so it can only acknowledge, never re-mutate or diverge: approval binds execution.

Overwrites and deletes are recoverable: `db/desk` snapshots a pre-image `desk.file_revision` before mutating (capture only — no restore UI yet).

## Risk tiers — UI mapping

| Scope | UI treatment |
|---|---|
| `desk:read` | Silent auto; I/O log only |
| `desk:create` | Auto with notification; bot-originated writes inherit this tier |
| `desk:write` on an existing file | Pending proposal → **`PlanCard`**; approve to run (pre-image `desk.file_revision` backs recovery) |
| `desk:delete` | Pending proposal → **`PlanCard`** with target name; soft delete + `desk.file_revision` back recovery |
| Multi-step destructive batch | One **`PlanCard`** covering all steps — one read, one approval |

## Reading order for the curious

1. `tools/_types.ts` — the risk vocabulary
2. `tools/index.ts` — schema-level scope filtering + `stepsForScopes` (load-bearing seam)
3. `chat-orchestrator.ts` — the step loop + `tryFallback`
4. `loop/compact.ts` — the #9631 workaround
5. `policy/governor.ts` — the approval gate (`requiresApproval`) + plan-gating predicate (`shouldRequirePlan`)
6. `db/schema/ai/proposal.ts` — the proposal state machine
