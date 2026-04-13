# Harness Lens

*"Harness" is a lens we use to audit the bot's post-prompt-dispatch machinery — not a module. If you're looking for the harness, read `ai/loop`, `ai/context`, `ai/policy`, and `ai/tools` together.*

## What the term means here

In agent-tooling discourse, a **harness** is everything after the first prompt dispatch: tool execution, safety gating, context compaction, state persistence, and observability. Four families exist — CLI harnesses (Claude Code), framework harnesses (Vercel AI SDK, LangGraph), IDE harnesses (Cursor), and eval harnesses (inspect-ai). v10r is a **product-embedded bot**, not a CLI, so only the subset of harness patterns that pay back in an end-user product ships here.

We use the term as a diagnostic. Asking "does v10r have all the harness primitives?" surfaces gaps. Once the gap is named and fixed, the term retires — the code lives under concrete slice names, not `harness/`.

## Primitives — who owns what

| Primitive | Owning slice | File |
|---|---|---|
| Tool dispatch & schema-level scope filtering | `ai/tools` | `tools/index.ts` — `createDeskTools(userId, scopes, layout)` |
| Tool metadata (`risk`, `scope`) | `ai/tools` | `tools/_types.ts` — `DeskToolRisk`, `DeskToolMeta` |
| Step loop control | `ai/loop` | `loop/orchestrate.ts` — `streamText` + `stopWhen` + `stepsForScopes` |
| Provider fallback & cooldown | `ai/loop` | `loop/fallback.ts` — `tryFallback` |
| Context compaction (fixes AI SDK #9631) | `ai/loop` | `loop/compact.ts` — `compactToolResults` + `resolve_ref` tool |
| System prompt assembly | `ai/context` | `context/system-prompt.ts` — `buildSystemPrompt`, cache-stable prefix ordering |
| Retrieval integration | `ai/context` | `context/retrieval-integration.ts` — Graph RAG pipeline events |
| Conversation windowing | `ai/context` | `context/system-prompt.ts` — `windowMessages` |
| Policy resolution (client floor ∩ server ceiling) | `ai/policy` | `policy/governor.ts` — `resolveEffectivePolicy` |
| Per-execute governor wrap (arg-dependent risk) | `ai/policy` | `policy/governor.ts` — `withGovernor` |
| Sensor sidecar (latency, source, governor decision) | `ai/policy` | `policy/sensor.ts` — `withSensor`, `AsyncLocalStorage` context |
| Structured policy errors (three-surface) | `ai/policy` | `policy/errors.ts` — `PolicyError` |
| Proposal state machine | `db/ai` + `ai/policy` | `db/schema/ai/proposal.ts`, `db/ai/proposals.ts` |
| Audit log (scaffolded stub) | `db/ai` | `db/schema/ai/audit-log.ts` |

## Wrap order

```
withGovernor(withSensor(execute))
```

Governor is outermost. Blocked calls never reach the sensor — blocked calls are a **policy** audit concern, not a sensor trace concern. Sensor traces only cover executions that actually ran, which is what makes latency stats meaningful.

## What ships as load-bearing vs. scaffold

**Load-bearing** (exercised on every request): tool dispatch, step loop, provider fallback, compaction, system-prompt assembly, governor, sensor, proposals table, `agent_proposals` row writes.

**Scaffolded stub** (seam visible, one write site, no query UI): `agent_audit_log` — retention policy is a product decision v10r should not make for adopters.

## What we explicitly don't ship

- **SKILL.md files** — developer-CLI pattern, category error for a product bot.
- **Visible subagent delegation** — dev-tool concept, invisible in Linear/Notion.
- **Generator-evaluator auto-review** — same-model evaluation "confidently praises regardless of quality" (Anthropic).
- **Full Mastra adoption** — framework weight without matching payoff at this scope.
- **Per-tool `needsApproval: true`** — approval fatigue is reproducible; risk-tiered gates are the working pattern.
- **A `harness/` module** — the seam is emergent across `loop/context/policy/tools`; naming it adds no value.

## Plan-before-execute — narrow scope

A `desk_propose_plan` tool exists, but plan-first is **not** the default posture. It's a latency tax on one-shot interactions, so it only kicks in when all three conditions hold:

1. Destructive-intent heuristic fires on the user message.
2. ≥2 tools with `risk: 'destructive'` are registered for this request.
3. ≥2 distinct target entities are inferred from panel context.

Predicate lives in `policy/governor.ts` as `shouldRequirePlan(request, toolset)`. Single destructive actions keep the existing two-phase `confirmed: boolean` pattern on individual tools (see `desk_delete_file`).

## Risk tiers — UI mapping

| Scope | UI treatment |
|---|---|
| `desk:read` | Silent auto; I/O log only |
| `desk:create` | Auto with notification; bot-originated writes inherit this tier |
| `desk:write` on user-originated files | Inline `ConfirmCard` with diff preview |
| `desk:delete` | Inline `ConfirmCard` with target name + persistent I/O Log undo chip (soft delete backs recovery) |
| Multi-step destructive batch | Inline `PlanCard` — one read, one motor tap, no form-like friction |

## Reading order for the curious

1. `tools/_types.ts` — the risk vocabulary
2. `tools/index.ts` — schema-level scope filtering (load-bearing seam)
3. `loop/orchestrate.ts` — the step loop
4. `loop/compact.ts` — the #9631 workaround
5. `policy/governor.ts` — the policy layer
6. `policy/sensor.ts` — the sidecar
7. `db/schema/ai/proposal.ts` — the proposal state machine
