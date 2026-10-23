---
title: "Untrusted-content boundary (the lethal trifecta, one rule per leg)"
description: "Every AI tool declares where its result comes from and whether it can send data out; user-origin results reach the model as one escaped <untrusted-content>…"
category: "AI"
---

# Untrusted-content boundary (the lethal trifecta, one rule per leg)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-10-23 @ 3cd3a97-dirty) · **Risk:** medium — the wrapper lowers but cannot remove the chance a model follows embedded text; the guarantee comes from leg 2 and leg 3 staying closed, which the gate holds

Every AI tool declares where its result comes from and whether it can send data out; user-origin results reach the model as one escaped <untrusted-content> element (this turn via toModelOutput, replayed turns via the history), external-reach tools must be approval-gated, and model output renders no image or unlisted link — a gate test holds all three legs.

**When to use:** Use when an assistant reads content a user or third party wrote — files, retrieved documents, web pages, tool output — and can also act or answer with links.

**Requires:** ai-provider

## Avoid when

- The assistant only ever reads a corpus you own and has no tools that act or send — there is no untrusted leg to bound
- You need to detect injection attempts for moderation; this bounds and removes legs, it does not classify

## Alternatives

- **Dual-LLM or CaMeL-style quarantine (a privileged planner never sees untrusted text)** — prefer when the assistant must act on untrusted content and also hold external tools
- **Injection classifiers (Prompt Guard, Lakera)** — prefer when you want telemetry on attempts on top of the structural rule, never instead of it

## Docs

- [docs/blueprint/ai/untrusted-content.md#untrusted-content-boundary](/docs/blueprint/ai/untrusted-content) — The three legs, where each is enforced, what is not claimed ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/untrusted-content.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/untrusted-content.md))

## Code

- `src/lib/server/ai/untrusted-content.ts` — resultOriginOf, wrapUntrusted, withUntrustedBoundary, boundHistoryToolResults ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/untrusted-content.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/untrusted-content.ts))
- `src/lib/types/ai-tools.ts` — TOOL_MANIFEST: resultOrigin and reach per tool ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/types/ai-tools.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/types/ai-tools.ts))
- `src/lib/server/ai/profile/profile.ts` — composeTurn bounds the composed tool set ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/profile/profile.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/profile/profile.ts))
- `src/lib/utils/markdown.ts` — Leg 3: no img, allowlisted link hosts for model output ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/utils/markdown.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/utils/markdown.ts))

## Tests

- `src/lib/server/ai/untrusted-content.gate.test.ts` — Through the real streamText loop: wrapped for the model, raw for the loop; history; external reach gated; renderer ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/untrusted-content.gate.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/untrusted-content.gate.test.ts))
- `src/lib/server/ai/prompt-injection.test.ts` — Prompt-block delimiter escaping and the data rule on both surfaces ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/prompt-injection.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/prompt-injection.test.ts))

## Invariants

- Every tool declares its result origin and reach; an undeclared tool is treated as user-origin.
- No user-origin tool result reaches the model unescaped, in the turn that ran it or a later one.
- No tool that can send data out of the deployment runs without a human-approved proposal.
- Model output renders no image and no link to an unlisted host.

## Emulation notes

- Bound at the model boundary (toModelOutput), not inside each tool — the loop's raw value then keeps feeding sentinels, effects and traces unchanged.
- Remember replayed history: results rebuilt from stored messages skip toModelOutput and need the same wrapping.
- Gate the legs you removed, not only the wrapper: a test that fails when an external tool appears ungated is what keeps the trifecta open.

## Depends on

- [AI tool manifest & harness split (tool defs, risk metadata, registry)](/docs/pattern-library/ai-tool-harness)
- [Deskbot approval gate (proposal → approve, plan-gated mutation)](/docs/pattern-library/deskbot-approval-gate)

---

_Machine-readable record: `ai-untrusted-content-boundary` in `pattern-library/registry.json`._
