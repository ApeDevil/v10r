# Gate tests

v10r's distinctive security pattern: **static scans that fail the build**.

They exist because of a specific, repeated failure mode. Every control in this
codebase is correct by convention, and conventions hold right up until someone
is tired. Behaviour tests do not catch "you forgot entirely" — they only test
the paths someone thought to write. A gate tests the *shape of the source*, so
you cannot omit a control without editing a line the gate reads.

The clearest example of why: the desk domain has 22 genuine cross-user isolation
tests, and every one of them passed `null` as the move destination. The
destination-ownership hole sat directly underneath a suite written to catch
exactly that class of bug, for as long as it took to notice.

## The gates

All live in `src/lib/server/security/*.gate.test.ts` and run in `bun run validate`.

| Gate | Rule | Prevents |
|---|---|---|
| `authz-coverage` | Every `+server.ts` references a guard scheme, or is allowlisted with a reason | A new endpoint shipping unguarded. SvelteKit cannot gate endpoints by folder, so nothing else would notice |
| `guard-contract` | `guards.ts` and endpoints never `throw apiError(...)` | Guards throwing a `Response`, which SvelteKit converts to 500 instead of 401/403 |
| `ownership-predicate` | Any module writing a caller-supplied `parentId`/`folderId` references `assertOwnedDestination`; recursive folder CTEs carry `user_id` in **both** terms | Cross-tenant trees, and the cascade delete that reaches them |
| `handle-chain` | The `sequence()` order matches a reviewed snapshot | Silent reordering — IP stamping, the auth terminator, and session population are all order-dependent |
| `load-leak-gate` | No client-facing file returns the raw user/session, a secret field, or a local bound from `locals.user` | Serialising internal fields into the SSR payload |
| `sql-injection-guard` | `sql.raw` / `sql.identifier` only in allowlisted files | Request-derived input reaching unparameterised SQL |
| `safe-path` | Redirect targets reject `//host`, `/\host`, absolute URLs | Open redirects |

## Conventions

- **Allowlist entries carry a reason**, as data rather than a comment, so they
  appear in review. `authz-coverage` asserts the reason is a real sentence.
- **Stale entries fail.** An allowlisted route that no longer exists, or that has
  since gained a guard, breaks the build — otherwise the list rots into noise.
- **The escape hatch is capped.** `load-leak-gate` fails if `leak-gate-allow:`
  markers exceed a threshold: past a point, the gate is being routed around
  rather than satisfied.

## What they cannot do

Say this plainly, because a gate that is trusted beyond its reach is worse than
no gate:

- They prove a symbol is **mentioned in the file**, not that it is called on
  every branch, before the sensitive work, or with the right arguments.
- They cannot follow a value through a helper function.
- `load-leak-gate` cannot catch a fresh unprojected re-read of the same row —
  that code never mentions `locals` at all. Closing it needs type-aware
  analysis.
- `ownership-predicate` cannot confirm the check targets the right table.

They are a regression net for the mistakes that actually happen. They are not a
substitute for reading the endpoint.

## Adding one

1. Copy the shape of `sql-injection-guard.test.ts` — `readdirSync(recursive)`, a
   regex, a `Set`/`Record` allowlist. There is no shared helper and that is
   fine; each gate stays independently readable.
2. Assert the scan is non-empty. A gate that silently matches nothing passes
   forever and protects nothing.
3. Write the failure message so it says what to do, not just what broke.
4. Document the limit in the file header.
