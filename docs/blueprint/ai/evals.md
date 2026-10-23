# Evals

How v10r guards AI answer quality the way it guards bundle size: a committed golden set, a
deterministic grader per fact, and a floor the pass rate must hold.

## AI eval regression suite

**Problem.** Prompts, profiles, retrieval and models change every week; unit tests mock the
model, so nothing notices when the assistant starts citing paths it never retrieved, stops
calling the catalog for a where-question, or invents a deploy command. LLM-as-judge suites
catch more but disagree with themselves run to run, and a judge's verdict names no fact.

**Method.** Grade recorded turns, deterministically.

| Piece | Where | What it does |
|---|---|---|
| Golden set | `src/lib/server/ai/eval/golden-cases.json` | A question per case, for one surface, and the facts its turn must show. Each case says what regression it guards |
| Case schema | `eval-case.ts` | Expectations: `cites-only-surfaced`, `cites`, `no-citations`, `calls-tool`, `calls-any-tool`, `never-calls`, `answer-includes`, `answer-excludes`, `stops-at-approval`, `outcome` |
| Graders | `graders.ts` | One pure function per kind over the turn trace (`TurnTrace`: citations with their match, tool executions, outcome, proposal) and the answer text. `cites` counts only surfaced citations; `calls-tool` only calls that did not error. A failure prints the fact: `unsurfaced: /docs/x` |
| Score + floor | `scorecard.ts`, `baseline.json` | A case passes when every expectation does; a run passes when its pass rate holds the floor. The floor is a ratchet like `perf/budgets.json`: raised to what a run achieves, never lowered, each raise logged in `_comment` |
| Runner | `run-eval.ts`, `scripts/ai/eval.ts` (`bun run ai:eval`) | Posts each question to the surface's endpoint as the signed-in user, reads the conversation and the recorded trace through the owner-guarded routes `ai:record-turn` uses, grades, prints, `--check` exits 1 below the floor |

**Why grade the trace, not the prose.** The trace records what happened — which tools ran,
which citations matched a surfaced item (`path`, `quote`) and which were recalled
(`unsurfaced`), whether the deskbot stopped on a proposal. Those are facts a check can
assert without a second model. Phrase checks on the answer are kept to the cheap,
unambiguous ones (a command that must not appear).

**Where it runs.** The graders, the schema and the runner are proven in `bun run validate`
against the committed turn fixtures and a stand-in HTTP server. A live run needs what a real
turn needs — a dev server with saved provider connections and the database — so it runs
locally:

```bash
podman exec v10r bun run ai:eval -- --cookie 'better-auth.session_token=…' --check
```

Every case opens a new conversation under that account and deletes it once graded (an account
holds a capped number of conversations); `--keep` leaves them for the turn inspector. The first
live run sets the floor.

**Invariants.**
- Every expectation is a deterministic check over the recorded turn; no model grades a model.
- A case names only tools that exist on its surface (`golden-cases.test.ts`).
- A run passes only at or above the committed floor; the floor never moves down.
- A case whose turn cannot be obtained fails with the reason; the run goes on.

**Next.** Thumbs-down answers as eval-case candidates: the turn id and trace already exist,
so a rated turn can be proposed into the golden set by an administrator.

Related: [turn-trace.md](./turn-trace.md) (what a turn records), [untrusted-content.md](./untrusted-content.md).
