---
title: "AI eval regression suite (golden set, deterministic graders over the turn trace, floor ratchet)"
description: "A committed golden set of questions, each with the facts its recorded turn must show — citations surfaced not recalled, the right tool called, no forbidden…"
category: "AI"
---

# AI eval regression suite (golden set, deterministic graders over the turn trace, floor ratchet)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** AI · **Tier:** deep · **Maturity:** proven (verified 2026-10-23 @ cf85a2c-dirty) · **Risk:** low — the suite is advisory until the floor is raised; a flaky phrase check shows as a named failing fact, not a vague score

A committed golden set of questions, each with the facts its recorded turn must show — citations surfaced not recalled, the right tool called, no forbidden tool, an approval stop, no invented command — graded by pure functions over the turn trace, with a pass-rate floor that only rises; live runs go through the app's own routes against a local dev server.

**When to use:** Use when prompts, retrieval, tools or models change often and unit tests mock the model, so quality regressions would ship unnoticed.

**Requires:** ai-provider, postgres

## Avoid when

- Turns are not recorded — without a trace of tools and citations the graders have nothing deterministic to read
- The quality question is open-ended style or tone that no fact in the trace can decide

## Alternatives

- **LLM-as-judge suites (promptfoo, Braintrust, LangSmith)** — prefer when the facts to check are judgments no trace field records, and the judge is calibrated against human labels
- **Offline retrieval benchmarks (Acc@1, Recall@k)** — prefer when only the retrieval layer changes and no model call is needed to score it

## Docs

- [docs/blueprint/ai/evals.md#ai-eval-regression-suite](/docs/blueprint/ai/evals) — Golden set, graders, floor ratchet, where it runs ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/evals.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/evals.md))

## Code

- `src/lib/server/ai/eval/eval-case.ts` — The case and expectation schema ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/eval-case.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/eval-case.ts))
- `src/lib/server/ai/eval/graders.ts` — One pure grader per expectation kind ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/graders.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/graders.ts))
- `src/lib/server/ai/eval/scorecard.ts` — Case pass, run pass rate, floor check ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/scorecard.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/scorecard.ts))
- `src/lib/server/ai/eval/run-eval.ts` — HTTP client over the app's own routes; runEval ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/run-eval.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/run-eval.ts))
- `src/lib/server/ai/eval/golden-cases.json` — The golden set ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/golden-cases.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/golden-cases.json))
- `scripts/ai/eval.ts` — bun run ai:eval [--check] ([GitHub](https://github.com/ApeDevil/v10r/blob/main/scripts/ai/eval.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/scripts/ai/eval.ts))

## Tests

- `src/lib/server/ai/eval/graders.test.ts` — Graders over the committed turn fixtures and synthetic failures; scorecard and floor ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/graders.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/graders.test.ts))
- `src/lib/server/ai/eval/golden-cases.test.ts` — Schema, unique ids, tools exist on the case's surface ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/golden-cases.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/golden-cases.test.ts))
- `src/lib/server/ai/eval/run-eval.test.ts` — The runner against a stand-in HTTP server: cookie, CSRF header, envelopes, failed cases ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/ai/eval/run-eval.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/ai/eval/run-eval.test.ts))

## Invariants

- Every expectation is a deterministic check over the recorded turn; no model grades a model.
- A case names only tools that exist on its surface.
- A run passes only at or above the committed floor, and the floor never moves down.
- A case whose turn cannot be obtained fails with its reason and the run continues.

## Emulation notes

- Grade the trace (tools, citation matches, outcome), not the prose — those facts are stable across runs where wording is not.
- Run evals through the app's real endpoints as a signed-in user, so the graded turn is exactly what a user's turn records.
- Start the floor at the first honest run and log every raise; a floor set by hope fails the first time and gets ignored.

## Depends on

- [Turn trace (recorded account of every AI turn) + turn graph](/docs/pattern-library/ai-turn-trace)
- [Performance budget and ratchet (targets aspire, ceilings hold)](/docs/pattern-library/performance-budget-ratchet)

---

_Machine-readable record: `ai-eval-regression-suite` in `pattern-library/registry.json`._
