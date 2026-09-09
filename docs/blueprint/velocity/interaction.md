# Interaction Velocity

The half of Velocity the user actually feels. Every pattern here shortens the gap between
acting and seeing a result, mostly without making the server any faster.

Live showcase: `/showcases/velocity/interaction`

## Optimistic mutation

**Problem.** A reversible, predictable action — rename, toggle, reorder, move, favourite —
blocks the interface on a server round trip it did not need to.

**Use when** failure is uncommon, the intended result is predictable, rollback can genuinely
restore the previous state, and immediate feedback materially improves the experience.

**Do not use when** the action is a payment, an irreversible deletion, a permission or
security change, or anything whose server-side outcome the client cannot predict.
Authorization is never optimistic — a rollback that "restores" a privilege the user never
had is worse than a wait.

**Architecture.** `$lib/state/optimistic.svelte.ts` keeps the confirmed value and the pending
intents *separately*, and what the UI reads is the fold of one over the other:

```text
user intent
    │
    ├── intent pushed onto `pending`  →  `current` recomputes  →  UI updates
    │
    └── authoritative commit
             ├── success → base := server value (or the applied value)
             └── failure → intent dropped → `current` recomputes → rolled back
```

That is what makes rollback exact. Keeping a mutated copy and undoing it in place is where
optimistic UIs drift permanently out of sync, because a later mutation applied on top has to
be un-applied too. Re-folding cannot get that wrong.

Consequences of the design worth knowing:

- `apply` is re-run on every read and **must be pure**.
- `reconcile(next)` replaces the confirmed value and keeps pending intents folded on top, so
  an unrelated refresh mid-flight does not make an in-flight rename flicker away.
- `commit` may resolve with the server's value — that is how a server-assigned id replaces a
  `temporaryId()` placeholder — or with nothing, which accepts the optimistic value.

**Duplicate protection.** Every mutation carries a `key`, the client-side idempotency key.
Two mutations with the same key are the same intent: the second joins the first instead of
running again, so a double-clicked button executes once. Derive it from what the mutation
*means* (`rename:file-7`), never from when it was issued — a timestamp makes every
double-click a distinct intent, which is the thing this prevents. Pass the same value as the
request's idempotency header and the protection extends across the network.

**Failure behaviour.** `mutate` never throws and never rejects. It resolves with
`{ ok: false, error }` and records the failure on `.error`, because a fire-and-forget caller
that ignores the promise must not produce an unhandled rejection.

**Invariants.**

- Optimistic UI never silently diverges permanently from canonical state.
- Failed mutations have deterministic recovery.
- A retried mutation does not execute twice.
- Server state remains authoritative.
- Security and authorization are never optimistic.

**Measurement.** `/showcases/velocity/interaction` runs the same mutation against an
artificial 500 ms server delay, both ways, and shows the failure and duplicate-submit paths.

**Implementation.** `src/lib/state/optimistic.svelte.ts`, tests in
`src/lib/state/optimistic.svelte.test.ts`.

## Intent-based preloading

**Problem.** The application knows what is probably next and waits to be asked anyway.

**Use when** there is a real signal: hover, pointer-down, touch, a focused command, a
workflow that strongly predicts its next screen, or the browser going idle after the
critical render.

**Do not use when** the data is expensive, highly volatile, or unlikely to be used; when
bandwidth may be constrained; or when preloading would pollute a cache or create real
backend work on a guess.

**Levels.** `$lib/nav/preload.ts` maps intent onto SvelteKit's own triggers:

| Intent | Code | Data | For |
|---|---|---|---|
| `none` | off | off | expensive, rarely-followed, or mutating links |
| `code` | viewport | off | an expensive route — warm the chunk, spend nothing on the server |
| `data` | hover | hover | the default case, matching the app-wide `<body data-sveltekit-preload-data="hover">` |
| `code-data` | viewport | tap | high-probability links: chunk early, data on pointer-down |
| `idle` | off | off | driven by `preloadOnIdle`, not by an attribute |

`viewport` never appears in the data column. On a page of forty links it would run forty
route loads for someone who scrolled past.

**Invariants.**

- Preloading is never required for correctness — every function here swallows its failures,
  so a warm cache cannot become load-bearing and let the cold path rot unnoticed.
- Speculation is cancellable or harmless; nothing here mutates.
- Nothing expensive fires from mere visibility.

**Measurement.** `/showcases/velocity/interaction` times `preloadData` against a cold URL
and against one already preloaded — which is exactly the work a navigation does before it
can render. The cold arm uses a fresh query string each run, because the router caches by
URL and re-measuring a resolved one would report a difference of zero.

**Implementation.** `src/lib/nav/preload.ts`, `src/app.html` (the app-wide default),
tests in `src/lib/nav/preload.test.ts`.

## Virtualized rendering

**Problem.** A long list costs the size of the data instead of the size of the viewport — and
not only in DOM nodes. Layout, style recalculation and hit-testing are all proportional to
what is in the tree, which is why a long list gets slower to *scroll*, not merely slower to
appear.

**Use when** rendering long tables, trees, explorer lists, timelines, feeds, logs, or
thousands of cards. `VIRTUALIZE_ABOVE` (200) is the number to argue against, not a hard gate.

**Do not use when** the collection is small enough that windowing adds more complexity than
it removes.

**Architecture.** The arithmetic (`virtual-list.ts`) is separate from the component
(`VirtualList.svelte`): the maths has the edge cases worth pinning and can be tested without
a browser, while the component's half is effects, which vitest's node environment never runs.

A spacer element carries the full data height so the scrollbar describes the list rather than
the window, and the rendered block is translated into place.

**Uniform row height only, on purpose.** Variable heights need measurement, a resize observer
and a running offset table, and every one of those is a source of scroll jump. A list that
needs them is a different pattern, not an option on this one.

**Invariants.**

- Hidden items create no DOM or layout cost.
- Keyboard navigation and accessibility stay correct — the list owns focus and moves a roving
  `aria-activedescendant`, because the rows a user would Tab through mostly do not exist.
- Scroll position stays stable; a `scrollTop` past the end (the list shrank, or the browser
  restored a stale position) clamps instead of stranding the user on a blank screen.

**Implementation.** `src/lib/components/primitives/virtual-list/`, tests in
`virtual-list.test.ts`.

## Idle and speculative work

**Problem.** The browser is idle after the critical render and the application does nothing
with it.

**Use for** warming caches, loading probable feature code, preparing command indexes,
initializing editors, decoding optional assets, computing low-priority derived data.

**Architecture.**

```text
critical render → interactive → idle capacity → speculative preparation
```

v10r already does this in three places: `preloadOnIdle` (with a timer fallback, because
Safari still lacks `requestIdleCallback` — late rather than never is the right failure for
work nobody waits on), the PWA update toast, which never calls `skipWaiting` automatically,
and `$lib/actions/hydrate-embeds.ts`, which hydrates embeds on intersection rather than on
load.

**Invariants.**

- Idle work yields to real user work.
- Speculative work is never required for correctness.
- Expensive speculation needs a reasonable expected benefit, not a plausible one.

**Implementation.** `src/lib/nav/preload.ts` (`preloadOnIdle`), `src/lib/actions/hydrate-embeds.ts`,
`docs/blueprint/pwa.md` (update flow).
