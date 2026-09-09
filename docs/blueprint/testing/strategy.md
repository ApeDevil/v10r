# Testing strategy

What earns an automated test here, what does not, and why the suite is shaped the way it is.

`bun run validate` is the only gate — there is no CI. Everything below exists to keep that
one command trustworthy and fast enough to actually run.

## The two lanes

`vitest.config.ts` declares two projects, and membership is decided by the filename:

| lane | files | timeout | what it costs |
|---|---|---|---|
| `unit` | `src/**/*.test.ts` | 5s | pure computation, no I/O |
| `db` | `src/**/*.pglite.test.ts` | 30s | restores a PGlite datadir snapshot per file |

```bash
podman exec v10r bunx vitest run                  # both
podman exec v10r bunx vitest run --project unit   # the fast inner loop
```

The `unit` lane keeps vitest's 5s default deliberately. A test there that needs longer is a
database test that forgot its suffix — and `naming.gate.test.ts` fails on exactly that, so the
timeout is only the second line of defence.

### Why the `db` lane restores a snapshot

Measured, on this schema (80 tables, 15 namespaces, 415 DDL statements):

| step | cost |
|---|---|
| PGlite `initdb` | **840 ms** |
| `CREATE EXTENSION vector` | 26 ms |
| `import drizzle-kit/api` (drags esbuild in) | 221 ms |
| `pushSchema` (the diff) | **61 ms** |
| DDL replay (415 `exec`s) | 287 ms |
| **total, per file, × 26 files** | **1,435 ms** |

The intuitive fix — hoist `pushSchema` into a `globalSetup` and hand workers the DDL — targets
the 61 ms. `initdb` is 59% of the cost and no amount of hoisting removes it. So
`test/pglite-schema.setup.ts` builds the database once per run, dumps the datadir, and each
file restores it: **294 ms**, measured, with `dumpDataDir`/`loadDataDir`.

Two things about that path are load-bearing and easy to get wrong:

- **`extensions` must still be passed on restore.** The dump carries the extension's data, not
  its registration.
- **`search_path` does not travel in the dump.** It is session state, so `createTestDb` re-applies
  it; without it, unqualified enum references in the schema fail to resolve.

The dump goes to the OS temp dir, never the repo, and is rebuilt every run: datadir dumps are
not portable across PGlite versions, so a stale one must be impossible to commit or reuse.
Vitest's global teardown deletes the per-run dump after every database worker exits, which
keeps the long-lived development container from accumulating snapshots.
`electric-sql/pglite#462` (intermittent `RuntimeError: unreachable` on `loadDataDir`) did not
reproduce in a 12× burn-in with `vector` enabled — re-run that burn-in after a PGlite bump.

Worker count was measured too: total duration *rises* as workers fall (16.5s → 23s → 40s at
8/4/2), so the lane is not contention-bound and the pool is deliberately left unbounded.

## What earns a test

- domain and business invariants; complex state transitions
- security and authorization boundaries — tenancy, realm isolation, gate ordering
- persistence and data-integrity guarantees that live in SQL, not TypeScript
- important error and failure paths, especially fail-closed ones
- architectural boundaries that must not regress (see [gate tests](../security/gate-tests.md))
- parity and drift, where two independently-correct halves must agree
- a previously discovered bug whose recurrence is realistic

## What does not

- trivial getters, constructors, pass-throughs, `instanceof`, or the shape of a returned object
- anything TypeScript, a schema validator, or a database constraint already enforces —
  "the schema rejects a wrong-typed field" tests the validator, not us
- framework or library behaviour: that `insert().returning()` returns the inserted row is
  Drizzle's guarantee, and asserting it here cost a full schema push
- a second, weaker witness of something a stronger test already proves
- code whose only realistic correctness risk is a remote service the test would mock away

Some code legitimately has no test. `monitoring/` and `cache/` are thin adapters over remote
services; `platform/`, `preferences/`, `schemas/` are types and constants. Mocking those would
test the mock.

## Rules the suite follows

**Collect offenders, assert once.** A source-scanning gate emits ONE test per rule, with the
offending paths in the failure message — never one test per scanned file. Four gates used to
emit ~1,130 cases for ~4 rules; a failure was a needle in a field of green, and `-t` filtering
was impossible because no title could be typed in advance. This is also what
`eslint-plugin-vitest`'s `valid-title` rule exists to prevent.

**Every scan asserts it scanned something.** A gate that silently matches nothing passes
forever. `showcases/ai/leak-gate.test.ts` scanned a mistyped directory for its whole life and
its single non-empty sentinel was satisfied by its *other* root — so non-emptiness is now
asserted per root, and each gate carries a self-test that its matchers still fire.

**Allowances ratchet.** `architecture.gate.test.ts`'s `expectRatchet` fails on a new violation
*and* on a recorded one that no longer applies. That second half is what stops an allowlist
rotting into noise.

**Mocks are seams, not scaffolding.** If a test only observes mocks the test itself installed,
it is asserting its own wiring. Forty cases once sat behind eighteen `vi.mock` calls because
they shared a file with a heavyweight import — they now live in
`ai/context/system-prompt.test.ts` with none.

**Test files are part of the product.** `pattern-library/registry.json` references test paths,
`maturity: "proven"` requires one, and `mcp/public-excerpts.snapshot.json` byte-mirrors the
content of the deep-tier ones. Renaming, deleting or *editing* one of those can fail
`patterns:validate` or `mcp:excerpts:check` — run `bun run refresh` after a batch of test edits.

## Where UI is proven

There is no jsdom, no browser mode, no Playwright. `$effect` does not fire in the node
environment, so Svelte 5 effects cannot be unit-tested — test the state half here and verify
the effect in the browser. The showcase pages under `(public)/showcases/` are the primary test
strategy for UI patterns, and `bun run validate:build` catches what only a production build can.

## The MCP suite

`mcp/server.test.ts` runs under `bun:test`, not vitest — its imports resolve without SvelteKit
aliases. `bun run test:mcp` runs it and is wired into `validate`; it is not in the vitest
include globs and must not be.
