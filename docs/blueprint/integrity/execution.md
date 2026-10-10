# Execution

Work that outlives one request, or one tab, has to leave the world in a known state when
something dies halfway through. The two patterns here cover the two places that happens. On
the server, a run is interrupted between steps. In the browser, a document session is
interrupted between saves.

## Durable step execution

**Problem.** A multi-step operation (deliver a notification, replay an approved plan, reset a
database branch) can be killed by a timeout, a deploy or a crash. A retry then has to answer
three questions. What already happened? Who owns the work now? Can the old worker still write?

**Method.** v10r has three hand-rolled implementations of the same contract. It does not use
a workflow engine; `docs/stack/vendors.md` records why Inngest and Trigger.dev were passed
over. Here is the contract they share:

| Element | What it guarantees | Outbox (`notifications/outbox.ts`) | Approved plan (`db/ai/proposals.ts` + `ai/proposals/execute-proposal.ts`) | Branch reset (`dbops/operations.ts`) |
|---|---|---|---|---|
| **Status machine** | Every transition is a conditional `UPDATE … WHERE status = <from>`, so exactly one caller wins | `pending → processing → sent \| failed \| dead` (a retry is `pending` again with `attempts > 0`) | `pending → approved → executing → executed \| failed` (+ `expired`, `rejected`) | `queued → running → succeeded \| failed \| canceled` |
| **Claim** | Exactly one worker owns the run | `FOR UPDATE SKIP LOCKED` claim that bumps `attempts` | `markExecuting`'s conditional `approved → executing` | one-in-flight guard + `idempotency_key` under a unique index |
| **Lease + reaper** | A dead owner is detected, never waited on forever | 5-minute claim lease, `reclaimStaleDeliveries` | 120 s per-step heartbeat, `markInterruptedIfStale` heals lazily on the next read | lease checked on every poll, `dbops-reaper` job |
| **Fence** | A stale owner cannot write after losing the lease | terminal writes match `attempts = <claimed>` | `lockExecuting` locks the row in each step's transaction and refuses unless still `executing` | every transition guarded on `status = 'running'` |
| **Receipts** | What committed is recorded *with* the effect, not after it | the delivery row itself | `agent_proposal_step`, PK `(proposal_id, step_index)`, written in the step's own transaction | `neonOpStatuses` on the row |
| **Retry policy** | Retries are bounded and spaced | exponential backoff on `next_attempt_at`, `dead` after max attempts | none: a failed step is a receipt, and a new plan is a new proposal | none: the external operation is polled, never re-issued |

**Lease time is the database clock.** The outbox and the proposals compare and stamp leases
with Postgres `now()`, the same clock their claim predicates read. A serverless instance's
`Date.now()` is a second, skewable opinion. `dbops` still computes its lease in application
time. That is acceptable there because the lease is generous and only guards crashes, but it
is a deviation, recorded as one.

**Exactly-once is a claim about the record, not the world.** The receipt and the database
mutation commit together, so a database effect happens exactly once per step. An external
side effect such as an email, a Telegram message or a Neon API call happens *at least once*.
A worker whose lease lapsed mid-send can send again after a reclaim. The outbox accepts
this, because a duplicate notification is cheaper than a lost one. `dbops` avoids it by never
re-issuing the external call: it only polls the operation it started.

**Compensation is not atomicity.** An approved plan stops at the first step that is not
`ok`, and the steps before it stay committed. Undoing them is a separate, compensating run
with its own receipts. No cross-step rollback is ever claimed.

**Invariants.**

- Every transition is conditional on the state it leaves; a transition that matches no row
  is a lost race, not an error.
- A lease is always paired with a fence. Without one, a stalled owner commits behind a
  terminal status.
- A step's receipt commits in the same transaction as the step's database effect.
- Step identity is stable across retries: a position in a frozen payload, or a row id. It is
  never a counter of calls made so far.
- A terminal run answers every repeat request from its receipts and never re-executes.
- External effects are at-least-once unless the external API takes an idempotency key, and
  each implementation says which it is.

**Do not use** for a single-statement mutation, where one transaction is already all-or-
nothing. And do not grow this into a workflow engine. Long sleeps, fan-out and hundreds of
steps are where a durable-execution platform (Vercel Workflow, Temporal) earns its cost. Know
its limits before adopting it: Vercel Workflow keeps run state in its own store, not your
database, and replay-based engines break on code changes to in-flight runs.

## Versioned document session

**Problem.** A user edits a document in the browser while the server, another tab or an AI
write can change the same document. Saves fail on flaky networks. The tab can close mid-save.
The aim is that no edit is ever lost silently and no overwrite is ever silent either.

**Method.** The server stays authoritative and every save carries the version it was based
on. The client is a small state machine around that, owned by the document rather than by a
component. In v10r it lives in `spreadsheet-autosave.ts`, `spreadsheet-drafts.ts` and
`spreadsheet-session.svelte.ts`.

- **Save queue.** Edits debounce into one latest snapshot, and requests are serialised. An
  edit made while a save is in flight stays pending; a success never clears it.
- **Compare-and-swap.** `PUT /api/desk/files/[id]` requires `expectedVersion`. A mismatch is
  `409 version_conflict`, and the session enters an explicit `conflict` state. There is no
  automatic rebase or merge.
- **Per-writer drafts.** Every unsaved snapshot is written to its own localStorage slot
  (`v10r:spreadsheet-draft:{user}:{file}:{writerId}`), so one tab never erases another's
  draft. On load, sibling drafts are offered to adopt or discard, never applied silently.
- **Stale-read guard.** Out-of-order reads, and reads that raced a local edit, are dropped
  using a read sequence and a generation counter.
- **Reload that cannot destroy work.** `discardAndReload()` fetches first and replaces
  local state only once the fetch succeeded, so going offline does not erase the only copy.

**Why not a CRDT.** Sync engines converge on server-authoritative writes even when their
reads are local-first: Zero moved permissions into server mutators, and Electric and PowerSync
send writes through your API. A CRDT pays for itself in concurrent rich-text co-editing. It
costs bundle size (about 232 KB gzipped for Zero's client), an unsolved authorisation story,
and merge semantics that cells with formulas do not have. An explicit conflict on a
spreadsheet cell is more honest than a silent merge.

**Invariants.**

- Every save carries its base version, and the server rejects a stale one.
- Unsaved work exists in exactly one place per writer, and nothing deletes it until a save
  of that work succeeded or the user discarded it.
- A conflict is a state the user resolves; it is never resolved by last-write-wins.
- The session's lifetime is the document's, not a component's. Closing a panel flushes,
  never drops.

**Do not use** for append-only input such as a chat message or a form submission, where a
plain request with an idempotency key suffices. Or for data no one else writes, where the
version check never fires. Reach for a CRDT only when two people must type into the same
paragraph at the same time.
