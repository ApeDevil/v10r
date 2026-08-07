---
title: "AI tool manifest & harness split (tool defs, risk metadata, registry)"
description: "Tool definitions are thin wrappers whose risk-tier metadata and per-surface membership live in a registry, with harness concerns (agent loop, compaction…"
category: "AI"
---

# AI tool manifest & harness split (tool defs, risk metadata, registry)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Risk:** high — governs what an LLM is allowed to execute

Tool definitions are thin wrappers whose risk-tier metadata and per-surface membership live in a registry, with harness concerns (agent loop, compaction, policy) factored out separately.

**When to use:** Use as soon as an LLM gets tools: the manifest/harness split is what keeps tool permissions auditable and surfaces honest.

## Docs

- [docs/blueprint/ai/surfaces.md](/docs/blueprint/ai/surfaces) — Tool calling and per-surface tool membership ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/surfaces.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/surfaces.md))
- [docs/blueprint/ai/harness-lens.md](/docs/blueprint/ai/harness-lens) — Harness audit lens: loop, policy, compaction ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/harness-lens.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/harness-lens.md))

## Code

- `src/lib/server/ai/tools/index.ts` — The manifest: chatbotToolMeta/deskbotToolMeta/allToolMeta maps + stepsForScopes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/index.ts))
- `src/lib/server/ai/tools/_types.ts` — Risk vocabulary: ToolRisk = read|create|write|destructive; ToolMeta ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/_types.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/_types.ts))
- `src/lib/server/ai/policy/governor.ts` — requiresApproval(risk) + shouldRequirePlan ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.ts))
- `src/lib/server/ai/tool-leak-guard.ts` — Guard against tool/surface leakage ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tool-leak-guard.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tool-leak-guard.ts))
- `src/lib/server/ai/loop/compact.ts` — Loop compaction (harness side) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/loop/compact.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/loop/compact.ts))

## Tests

- `src/lib/server/ai/tools/index.test.ts` — Drift-guards the replay map against the live tool set ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tools/index.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tools/index.test.ts))
- `src/lib/server/ai/policy/governor.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/policy/governor.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/policy/governor.test.ts))
- `src/lib/server/ai/tool-leak-guard.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/tool-leak-guard.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/tool-leak-guard.test.ts))
- `src/lib/server/ai/loop/compact.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/loop/compact.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/loop/compact.test.ts))

## Invariants

- Risk-tiered approval gates, not per-tool needsApproval flags — approval fatigue is reproducible; the tier rule is the working pattern.
- executeDeskToolCall is the single door for mutating tool execution (one SSOT).
- stepsForScopes caps agent steps per scope (read-only including desk:ask = 3, mutation = 5).

## Emulation notes

- The manifest is not a single file: meta maps in tools/index.ts + risk vocab in tools/_types.ts + the approval rule in policy/governor.ts together form it.
- Write the drift-guard test early — it is what keeps the manifest honest as tools accumulate.

## Depends on

- [Multi-client core (hexagonal domain modules)](/docs/pattern-library/multi-client-core)

---

_Machine-readable record: `ai-tool-harness` in `mcp/patterns.registry.json`._
