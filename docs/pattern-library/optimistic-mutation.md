---
title: "Optimistic mutation (fold-based rollback, idempotency keys)"
description: "The confirmed value and the pending intents are stored separately and the UI reads the fold of one over the other, so a failed mutation rolls back exactly …"
category: "Interaction Velocity"
---

# Optimistic mutation (fold-based rollback, idempotency keys)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Interaction Velocity · **Tier:** deep · **Maturity:** proven (verified 2026-09-09 @ 921e8266-dirty) · **Risk:** low — client-side state; the server contract is unchanged

The confirmed value and the pending intents are stored separately and the UI reads the fold of one over the other, so a failed mutation rolls back exactly — even with later mutations applied on top — and a repeated intent executes once.

**When to use:** Use for reversible, predictable actions where failure is uncommon: rename, toggle, reorder, move, favourite. Never for payments, irreversible deletion, or permission changes.

## Docs

- [docs/blueprint/velocity/interaction.md#optimistic-mutation](/docs/blueprint/velocity/interaction) — The pattern, and what must never go through it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/velocity/interaction.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/velocity/interaction.md))

## Code

- `src/lib/state/optimistic.svelte.ts` — OptimisticValue: base + pending intents, folded on read ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/optimistic.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/optimistic.svelte.ts))

## Tests

- `src/lib/state/optimistic.svelte.test.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/optimistic.svelte.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/optimistic.svelte.test.ts))

## Proof

- [`/showcases/velocity/interaction`](/showcases/velocity/interaction)

## Invariants

- Optimistic UI never silently diverges permanently from canonical state — the confirmed value is stored separately and is only ever replaced by the server's answer.
- Rollback is the removal of one intent from the pending list, never an undo applied in place; later intents stay applied because they are re-folded over the unchanged base.
- `apply` is re-run on every read and must be pure.
- A retried or double-submitted mutation with the same key executes once — the second caller joins the first.
- Security and authorization are never optimistic. The server stays the authority.

## Emulation notes

- Derive the mutation key from what the intent MEANS (`rename:file-7`), never from when it was issued — a timestamp makes every double-click a distinct intent, which is the thing the key prevents.
- Pass the same key as the request's idempotency header and the duplicate protection extends across the network.
- `mutate` resolves with an outcome object instead of throwing: a fire-and-forget caller that ignores the promise must not produce an unhandled rejection.
- `$effect` never runs under vitest's node environment — unit-test the state machine and prove the reactive wiring in a browser.

---

_Machine-readable record: `optimistic-mutation` in `pattern-library/registry.json`._
