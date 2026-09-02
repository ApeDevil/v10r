# AI Testing Infrastructure

> **Status: built.** The Vitest + PGlite harness described here exists and works (`vitest.config.ts`, the `createTestDb()` helper in `src/lib/server/test/db.ts`, hundreds of `*.test.ts` files, in-process PGlite Postgres). Schema setup uses `pushSchema` from `drizzle-kit/api` — no migration files, no `drizzle/` directory, no schema-gen step. One piece remains **not built**: the root `AGENTS.md` file (and any CI). Treat that as plan; everything else reflects current code.

This document describes the testing approach — what exists, why, and how.

The target is an AI agent testing loop: implement → run tests → parse output → fix failures → repeat. Claude Code does this natively. The infrastructure's job is to give the agent clear, structured feedback so that loop terminates quickly.

---

## Container Execution Model

Nothing is installed on the host machine except Podman. Claude Code runs on the host but all tools (Bun, Vitest, Biome, node_modules) live inside the `v10r` container. Every command must go through `podman exec`.

```
HOST (Podman + Claude Code only)
 │
 │  edits files at /home/ad/dev/velociraptor/
 │  runs: podman exec v10r <cmd>
 │
 └──► CONTAINER v10r (WORKDIR /app)
      ├── Bun runtime
      ├── node_modules (named volume)
      ├── Source at /app/ (bind mount ← host)
      ├── Vitest runs here
      ├── PGlite runs here (in-process)
      └── Biome runs here
```

**Bind mount** (`.:/app` in `compose.yaml`): file edits on the host are instantly visible in the container. No copy step.

**Exit codes pass through**: `podman exec` returns whatever the inner command returns. Hooks work correctly — a failing test exits non-zero.

**No path translation needed**: Vitest and Biome run from the project root against `src/`. Host paths never enter the commands.

**Container must be running**: `podman exec` fails if `v10r` isn't up. If you're coding, the dev server is running — this is always true in practice.

**No wrapper scripts**: Use `podman exec v10r <cmd>` directly. Explicit is better.

---

## Test Strategy

Two tools. No more.

| Tool | Purpose |
|------|---------|
| **Vitest 4.x** | All automated tests — unit, integration, Svelte components |
| **Claude Chrome extension** | Browser interaction, E2E validation |

### Why Vitest and not Bun test

Every module in `$lib/server/` eventually imports `$env/static/private` or `$env/dynamic/private`. These are SvelteKit virtual modules — Vite resolves them at build time. Bun test has no Vite plugin system and cannot resolve them. Tests fail immediately on import ([oven-sh/bun#5541](https://github.com/oven-sh/bun/issues/5541), [oven-sh/bun#10712](https://github.com/oven-sh/bun/issues/10712) — both still open as of early 2026). Additionally, PGlite itself produces out-of-bounds WASM errors with `bun test` ([oven-sh/bun#15032](https://github.com/oven-sh/bun/issues/15032)).

Vitest with the `@sveltejs/kit/vite` plugin resolves `$lib/*`, `$env/*`, and all SvelteKit aliases automatically. Same tool handles both server-side unit/integration tests and Svelte component tests.

**Vitest 4.x:** Use the `projects` field (not `workspace`, deprecated in Vitest 3.2) for multi-project configuration. Browser Mode is now stable in Vitest 4.0 but not needed for this project's initial phases.

### Why no Playwright

The Claude Chrome extension handles browser interaction. Playwright would duplicate this capability and add configuration overhead for zero benefit. `vitest-browser-svelte` (real browser component testing via Playwright) is the future direction but requires ~300MB Chromium in the container — not justified until jsdom-based tests hit real limitations.

### Why `vi.mock` and not dependency injection

Every query and mutation module imports `db` as a module-level singleton (`import { db } from '../index'`). Converting to DI would change 30+ function signatures across 8+ files plus all call sites — high cost, zero production benefit. The multi-client core architecture explicitly chose module-level imports over DI containers (zero-cost imports vs 50–200ms cold start on serverless). `vi.mock('$lib/server/db', ...)` is a one-line swap at a clean module boundary.

---

## Directory Structure

Tests live next to source (co-located). A test file for `send.ts` sits at `send.test.ts`.

```
src/
  lib/
    server/
      errors/
        index.ts
        index.test.ts              ← unit test
      retrieval/
        rank.ts
        rank.test.ts               ← unit test (pure logic, highest value)
        chunk.ts
        chunk.test.ts              ← unit test (pure logic)
      db/
        notifications/
          queries.ts
          queries.test.ts          ← integration test (PGlite)
      notifications/
        send.ts
        send.test.ts               ← integration test (PGlite)
      test/                        ← shared test utilities (not a test runner target)
        db.ts                      ← PGlite setup + schema push (drizzle-kit/api)
        fixtures.ts                ← test data factories
    components/
      primitives/
        button/
          Button.svelte
          Button.test.ts           ← component test
```

---

## Database Test Isolation

### PGlite (unit and integration tests)

PGlite runs WASM Postgres in-process inside the `v10r` container. No external DB, no network, no shared state. Each test file gets its own database instance — parallel-safe by default. PGlite installs as an npm devDependency into the named `node_modules` volume — no host installation needed. Target version: **0.3.14+** (PostgreSQL 17.4 based).

**Schema sync via `pushSchema`:** The harness calls `pushSchema(schema, db)` from `drizzle-kit/api`. This compiles the live TypeScript schema into DDL in-process — no migration files, no `drizzle/` directory, no codegen step. It matches the project's push-only workflow (`drizzle-kit push` against the live Neon DB), so test and production schemas come from the same source with nothing to regenerate.

`pushSchema` returns `{ statementsToExecute }`. The harness executes those statements manually rather than calling the bundled `apply` helper — `apply` fails on this project's unqualified enum references. The execution order matters:

1. Run every `CREATE SCHEMA` statement first.
2. Set `search_path` so unqualified enum references resolve.
3. Run the remaining DDL.

This project defines 14 custom PostgreSQL schemas (`admin`, `ai`, `analytics`, `app`, `auth`, `blog`, `dbops`, `desk`, `feedback`, `image`, `jobs`, `notifications`, `rag`, `showcase`) plus `public`, with schema-scoped enums and cross-schema foreign keys. The schema-first + `search_path` ordering is what makes those resolve under PGlite, which starts with only `public`. The `search_path` set in `createTestDb()` lists 11 of the 14 — it omits `dbops`, `feedback`, and `image` (a known gap; those three define enums too).

**Rejected: `migrate` with generated files.** The `migrate` function from `drizzle-orm/pglite/migrator` needs SQL migration files. The project is push-only — there is no `drizzle/` directory and no `drizzle-kit generate` step. Adding one solely for tests would split the schema source and create drift between the test schema and the live DB. `pushSchema` reads the same TypeScript schema the app uses, so no sync step exists to forget.

**Driver difference:** Production uses `drizzle-orm/neon-serverless`. Tests use `drizzle-orm/pglite`. Same query API, different connection. Swap via `vi.mock`.

**pgvector:** PGlite supports pgvector via `@electric-sql/pglite/vector`. Must be loaded explicitly via the `extensions` option — without it, any column using `vector(1536)` fails with "type vector does not exist." The `CREATE EXTENSION` must run before any DDL that references the `vector` type.

**Custom schemas:** PGlite starts with only `public`. `pushSchema` emits `CREATE SCHEMA` statements for every custom schema; the harness runs them first (before any table DDL), then sets `search_path` across them (currently 11 of the 14 — `dbops`, `feedback`, `image` omitted) so unqualified enum references resolve.

**Cross-schema foreign keys:** Almost every schema references `auth.user.id`. PGlite tolerates forward references within a single `exec` batch, but the `auth` schema and its tables must exist before dependent tables are created — `pushSchema` orders the returned statements so they do. Schemas cannot be loaded in true isolation; when bootstrapping new test coverage, expand incrementally:

| Phase | Schemas | Why |
|-------|---------|-----|
| First | `jobs` | Standalone, zero cross-schema FKs — validates the PGlite + `pushSchema` pipeline |
| Then | `auth` + `notifications` | Cross-schema FKs, real business queries |
| Then | `auth` + `ai` | Another cross-schema domain |
| Last | `auth` + `rag` | Adds pgvector, custom types, post-push SQL |

**Out-of-schema DDL:** `src/lib/server/db/retrieval/setup.ts` contains raw SQL for a generated tsvector column (`search_vector`), an HNSW index (`chunk_embedding_hnsw_idx`), a GIN index on `search_vector`, and a seed row in `embedding_model`. These live outside Drizzle schema definitions and are **not emitted by `pushSchema`**. They require a separate `client.exec(sql)` after the push — only when testing RAG-specific queries.

**Index support:** PGlite supports GiST (for range types), GIN (for tsvector/jsonb), and B-tree indexes natively — no extensions needed. HNSW indexes (pgvector) are theoretically supported but unverified in WASM at scale — functional correctness is expected, not performance parity with native Postgres.

**Snapshot/restore (future optimization):** PGlite's `dumpDataDir`/`loadDataDir` API can cut test init time by creating the schema once and restoring per suite instead of re-running the push. The API is documented and stable, but the pattern is experimental at scale. Consider this if the test suite grows slow.

The real helper lives at `src/lib/server/test/db.ts`:

```typescript
// src/lib/server/test/db.ts
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { pushSchema } from 'drizzle-kit/api';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '$lib/server/db/schema';

export async function createTestDb() {
  const client = new PGlite({ extensions: { vector } });
  await client.exec('CREATE EXTENSION IF NOT EXISTS vector');
  const db = drizzle(client, { schema });

  // Get DDL from drizzle-kit push. Don't call apply — it fails on unqualified enums.
  const { statementsToExecute } = await pushSchema(schema, db as any);

  // Create schemas first, then set search_path, then run the rest.
  const schemaStmts = statementsToExecute.filter((s) => s.startsWith('CREATE SCHEMA'));
  const otherStmts = statementsToExecute.filter((s) => !s.startsWith('CREATE SCHEMA'));

  for (const stmt of schemaStmts) await client.exec(stmt);

  await client.exec(
    'SET search_path TO public, admin, ai, analytics, app, auth, blog, desk, jobs, notifications, rag, showcase',
  );

  for (const stmt of otherStmts) await client.exec(stmt);

  return { db, client };
}
```

The `db as any` cast is needed because PGlite's `db` type doesn't match `pushSchema`'s strict `PgDatabase` generic. Setting `search_path` before the table DDL is the load-bearing step — without it, the schema-scoped enums in unqualified column definitions fail to resolve.

**Inject into tests via `vi.mock`:**

```typescript
// In any test file that needs the DB
vi.mock('$lib/server/db', async () => {
  const { createTestDb } = await import('$lib/server/test/db');
  const { db } = await createTestDb();
  return { db };
});
```

**Cleanup:** Each test file creates one PGlite instance (via `vi.mock` factory, called once per module). Vitest runs files in parallel across workers — this is safe. Use `afterAll` to shut down the client:

```typescript
// In test files using PGlite
let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
  const { createTestDb } = await import('$lib/server/test/db');
  const { db, client } = await createTestDb();
  testClient = client;
  return { db };
});

afterAll(async () => {
  await testClient?.close();
});
```

### Neo4j (unit and integration tests)

Mock the `cypher()` function. It's a single import — one mock covers all graph calls.

```typescript
vi.mock('$lib/server/graph', () => ({
  cypher: vi.fn().mockResolvedValue({ records: [] }),
}));
```

For tests that need specific graph responses, configure the mock per test:

```typescript
vi.mocked(cypher).mockResolvedValueOnce({
  records: [{ get: (key: string) => mockData[key] }],
});
```

Test Aura instance: only if graph features require E2E validation. Not needed for unit or integration coverage.

---

## Test Data Factories

Factories produce valid test objects with sensible defaults. Override only what the test cares about.

```typescript
// src/lib/server/test/fixtures.ts
import type { InferInsertModel } from 'drizzle-orm';
import type { user } from '$lib/server/db/schema/auth/_better-auth';
import type { notifications } from '$lib/server/db/schema/notifications/notifications';

type UserInsert = InferInsertModel<typeof user>;
type NotificationInsert = InferInsertModel<typeof notifications>;

export function makeUser(overrides?: Partial<UserInsert>): UserInsert {
  const id = overrides?.id ?? crypto.randomUUID();
  return {
    id,
    name: `Test User ${id.slice(0, 6)}`,
    email: `${id.slice(0, 8)}@test.local`,
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeNotification(overrides?: Partial<NotificationInsert>): NotificationInsert {
  return {
    id: crypto.randomUUID(),
    userId: 'must-be-set',
    type: 'system',
    messageKey: 'notif_system',
    messageParams: {},
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  };
}
```

---

## Claude Code Hooks

Hook commands run on the **host machine** (where Claude Code runs). Since all tools live in the container, every command uses `podman exec v10r`.

### PostToolUse — lint only

Runs after every `Edit` or `Write`. Fast (sub-second). Biome only — no tests.

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{
          "type": "command",
          "command": "podman exec v10r bun biome check --write --reporter json src/"
        }]
      }
    ]
  }
}
```

No path translation needed — Biome runs against `src/` from the container's `/app` workdir.

**Why not run tests here:** Running full tests after every edit causes thrashing. The agent gets failure reports for partially-complete work and starts fixing intermediate states before the feature is done.

### Stop hook — quality gate

Runs when the agent declares completion. Uses a shell script that reads Claude Code's hook input JSON, checks for infinite loop prevention, and runs validation.

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [{
          "type": "command",
          "command": ".claude/hooks/stop-gate.sh"
        }]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/stop-gate.sh

# Read hook input from stdin
INPUT=$(cat)
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active')

# CRITICAL: prevent infinite loop. When stop_hook_active is true,
# we are already in forced-continuation from a previous block.
# Allow the agent to stop to avoid looping forever.
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

# Run full validation inside the container.
# Uses bash (not sh) for pipefail support — without it,
# piping to tail swallows the exit code from vitest.
OUTPUT=$(podman exec v10r bash -c 'set -o pipefail; bun run check && bun biome check . && bun vitest run 2>&1 | tail -80' 2>&1)
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  # Block the stop — feed failure output back to the agent
  echo "{\"decision\": \"block\", \"reason\": \"Validation failed:\\n${OUTPUT}\"}"
  exit 0
fi

# All checks passed — allow stop
exit 0
```

**Why `bash -c` not `sh -c`:** POSIX `sh` does not support `set -o pipefail`. Without `pipefail`, `vitest run 2>&1 | tail -80` returns `tail`'s exit code (always 0), silently masking test failures. Using `bash -c` ensures the pipeline returns vitest's exit code.

**Why `stop_hook_active` check:** Claude Code sets `stop_hook_active: true` in the hook input when the agent is already in forced-continuation from a previous block. Without this check, the agent loops infinitely: fail → block → retry → fail → block → ... This is a confirmed issue ([claude-code#10205](https://github.com/anthropics/claude-code/issues/10205)).

**Why JSON output (not exit code 2):** Exit code 2 with stderr is supposed to block the stop, but has a known bug in plugin-installed hooks ([claude-code#10412](https://github.com/anthropics/claude-code/issues/10412)). JSON `{"decision": "block", "reason": "..."}` on stdout with exit 0 is the reliable approach.

**Risk:** If pre-existing failures exist, the agent loops trying to fix them (until stopped by `stop_hook_active`). Fix all pre-existing failures before enabling this hook.

**Container down:** If `v10r` isn't running, `podman exec` fails and the output contains "no such container" — a clear signal, not a confusing test failure.

### Machine-readable output

All commands prefixed with `podman exec v10r` when run from the host.

| Tool | Format | Agent benefit |
|------|--------|--------------|
| `bun vitest run` | Console (default) | File paths, line numbers, diff output |
| `bun biome check --reporter json` | Structured JSON | File path, line number, fix suggestions |
| `bun vitest run --reporter=junit --outputFile=./junit.xml` | JUnit XML | CI integration |

---

## Configuration Files

### vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.svelte.test.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 15_000,
    setupFiles: ['src/lib/server/test/vitest.setup.ts'],
    passWithNoTests: true,
  },
});
```

The `sveltekit()` plugin resolves all SvelteKit virtual modules — `$lib/*`, `$env/*`, `$app/*`. Without it, every server-side test fails on import.

**`testTimeout: 15_000`:** PGlite WASM startup + schema push can take 3–5 seconds per test file. The default 5000ms timeout causes false failures. Set higher globally, keep individual tests fast.

**`setupFiles`:** Runs once per worker (per test file). Used for global mocking.

**Vitest 4.x note:** The `workspace` field is deprecated since Vitest 3.2. Use `projects` for multi-project configuration if needed later. The simple single-project config above works for the initial phases.

### vitest.setup.ts

```typescript
// src/lib/server/test/vitest.setup.ts
import { vi } from 'vitest';

// Prevent job schedulers from starting. Both check globalThis
// sentinels before starting setInterval loops. Without this,
// any transitive import of hooks.server.ts starts real schedulers.
globalThis.__v10r_scheduler = 'test';
globalThis.__v10r_delivery_scheduler = 'test';

// $env/dynamic/private resolves to an empty object in Vitest because
// no SvelteKit adapter calls server.init(). Redirect to process.env
// so that values from .env.test are available.
vi.mock('$env/dynamic/private', () => ({
  env: new Proxy({}, { get: (_target, prop: string) => process.env[prop] }),
}));

// $env/static/private — same redirect, for modules that read it at load time
vi.mock(
  '$env/static/private',
  () => new Proxy({}, { get: (_target, prop: string) => process.env[prop] }),
);

// $app/environment — needed if any import chain touches schedulers or SSR guards
vi.mock('$app/environment', () => ({
  building: false,
  browser: false,
  dev: true,
  version: 'test',
}));
```

**Why `$env/dynamic/private` mock:** `$env/static/private` works via the `sveltekit()` plugin (reads `.env` at Vite startup). But `$env/dynamic/private` depends on adapter initialization that never happens during `vitest run`. Without this mock, any module importing `env` from `$env/dynamic/private` gets an empty object. Known open issue: [sveltejs/kit#9564](https://github.com/sveltejs/kit/issues/9564).

**Why scheduler sentinels:** `hooks.server.ts` imports `$lib/server/jobs/scheduler` and `$lib/server/jobs/delivery-scheduler` as side effects. Both start `setInterval` loops unless a `globalThis` sentinel is set. The sentinels are the cleanest containment — no need to mock the platform module.

**Why `$app/environment` mock:** Both schedulers check `building` from `$app/environment`. Other modules (`sidebar.svelte.ts`) check `browser`. Providing deterministic values prevents runtime detection logic from firing.

### .env.test

```bash
# Fake values for $env/static/private — only needed when tests import
# modules that read these at module load time. Pure logic tests
# (rank.ts, chunk.ts, errors/) don't need any of these.
NEON_DATABASE_URL_PROD=postgresql://test:test@localhost/test
BETTER_AUTH_SECRET=a-test-secret-that-is-at-least-32-chars
BETTER_AUTH_URL=http://localhost:5173
GITHUB_CLIENT_ID=test
GITHUB_CLIENT_SECRET=test
GOOGLE_CLIENT_ID=test
GOOGLE_CLIENT_SECRET=test
NEO4J_URI=neo4j+s://test.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=test
```

**Why this is needed:** `$lib/server/auth/index.ts` throws at module load if `BETTER_AUTH_SECRET` is shorter than 32 characters. `$lib/server/db/index.ts` reads `NEON_DATABASE_URL_PROD` at module load. The `sveltekit()` plugin reads `.env.test` automatically for `$env/static/private` values. These are never used for real connections — PGlite replaces the DB, and auth is mocked.

### package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "validate": "bun run check && biome ci . && bun run test && bun run i18n:check-missing && bun run content:check"
  }
}
```

`validate` is the quality gate command. From the host: `podman exec v10r bun run validate`.

There is no schema-gen step. `createTestDb()` builds the schema in-process via `pushSchema`, reading the same TypeScript schema the app uses. The live Neon database is managed via `drizzle-kit push` (`db:push`); tests need nothing regenerated after a schema change.

---

## Implementation Phases

### Phase 0 — Foundation

1. Add `vitest` to `devDependencies` in `package.json`
2. Create `vitest.config.ts` with `sveltekit()` plugin, `testTimeout`, and `setupFiles`
3. Create `src/lib/server/test/vitest.setup.ts` — global mocks and scheduler sentinels
4. Create `.env.test` with fake values for `$env/static/private` modules
5. Add test scripts to `package.json` (`test`, `test:watch`)
6. Restart container so deps install: `podman compose down && podman compose up -d`
7. Ensure `.svelte-kit/` types exist — the `sveltekit()` plugin needs them. The dev server creates them automatically on startup (`svelte-kit sync`). If running tests before the dev server has started, run `podman exec v10r bun run check` first (which triggers `svelte-kit sync`).

No tests yet. Verify from host: `podman exec v10r bun run test` exits cleanly with "no test files found."

### Phase 1 — Pure logic tests

Start with modules that have zero external dependencies — no DB, no mocks, maximum signal. These validate the full pipeline (host → container → Vitest → results) while testing the highest-value algorithmic code.

**Priority order:**

1. `$lib/server/retrieval/rank.ts` — RRF algorithm, deduplication, fusion. Four functions, deterministic math, highest ROI. The ranking logic is non-trivial and could easily have off-by-one errors.
2. `$lib/server/retrieval/chunk.ts` — text splitting with overlap and hierarchy. Only needs `crypto.subtle` (available in Bun). Complex enough to have real bugs.
3. `$lib/server/errors/index.ts` — `ServerError` class, `toStatus()` mapping, JSON serialization. Pure logic, validates the pipeline.
4. `$lib/schemas/showcase/` — Valibot schema rules. Test with `v.safeParse()`. The `realtimeSchema` password-confirm cross-field validation is the most interesting.

```typescript
// src/lib/server/errors/index.test.ts
import { describe, expect, it } from 'vitest';
import { ServerError } from './index';

describe('ServerError', () => {
  it('sets kind and message', () => {
    const err = new ServerError('db', 'something failed');
    expect(err.kind).toBe('db');
    expect(err.message).toBe('something failed');
  });

  it('is an Error instance', () => {
    expect(new ServerError('ai', 'provider unavailable')).toBeInstanceOf(Error);
  });

  it('maps to 500 by default', () => {
    const err = new ServerError('unknown', 'test');
    expect(err.toStatus()).toBe(500);
  });

  it('serializes to JSON', () => {
    const err = new ServerError('db', 'connection lost', 'ECONNREFUSED');
    const json = err.toJSON();
    expect(json).toEqual({
      name: 'ServerError',
      kind: 'db',
      message: 'connection lost',
      code: 'ECONNREFUSED',
      status: 500,
    });
  });
});
```

Goal: verify the full pipeline works end-to-end. Claude Code (host) runs `podman exec v10r bun run test` → Vitest resolves `$lib` paths inside container → results flow back to host.

### Phase 2 — DB tests

1. Add `@electric-sql/pglite` to `devDependencies` in `package.json` (`drizzle-orm` and `drizzle-kit` are already dependencies)
2. Restart container: `podman compose down && podman compose up -d`
3. Create `src/lib/server/test/db.ts` — PGlite setup with `pushSchema` (create schemas first, set `search_path`, run the rest)
4. Create `src/lib/server/test/fixtures.ts` — data factories
5. **Validate incrementally** — start with the `jobs` schema (standalone, zero cross-schema FKs) to prove the pipeline, then `auth` + `notifications` for real business logic
6. Write first DB test for notification queries

**If `pushSchema` fails:**

- **Enums don't resolve:** confirm `search_path` is set across all custom schemas *before* the table DDL runs, and that `CREATE SCHEMA` statements run first. This is the ordering in `createTestDb()`.
- **It hangs or errors on `apply`:** don't call the bundled `apply` helper — execute the returned `statementsToExecute` yourself, as the harness does.
- **Unsupported types under PGlite:** load the needed extension via the `extensions` option (e.g. `vector`) before running DDL that references the type.

```typescript
// src/lib/server/db/notifications/queries.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser, makeNotification } from '$lib/server/test/fixtures';

vi.mock('$lib/server/db', async () => {
  const { createTestDb } = await import('$lib/server/test/db');
  const { db } = await createTestDb();
  return { db };
});

describe('getNotifications', () => {
  it('returns notifications for user', async () => {
    const { getNotifications } = await import('./queries');
    const user = makeUser();
    // seed test data, then assert
    const results = await getNotifications(user.id, 10, 0);
    expect(results).toBeInstanceOf(Array);
  });
});
```

### Phase 3 — Stop hook

1. Create `.claude/hooks/stop-gate.sh` (see Stop hook section above)
2. Make it executable: `chmod +x .claude/hooks/stop-gate.sh`
3. Add Stop hook to `.claude/settings.local.json`
4. Install `jq` in the container (needed by the hook script to parse JSON input) — or parse with `grep`/`sed` if `jq` is unavailable

Every agent session must pass `podman exec v10r bun run validate` before completing.

Prerequisite: Phase 1 and Phase 2 tests pass cleanly. Never enable the Stop hook with failing tests.

### Phase 4 — Expand coverage

Priority order based on codebase analysis (highest value first):

**Data access layer (primary test boundary):**

1. `$lib/server/db/notifications/mutations.ts` — race condition in `getOrCreateSettings()`, IDOR protection via `userId` scoping in `markAsRead()`. High bug potential.
2. `$lib/server/db/notifications/queries.ts` — core CRUD with auth scoping.
3. `$lib/server/db/ai/mutations.ts` — multi-step operations with ownership verification.
4. `$lib/server/db/errors.ts` — `classifyDbError()`, `classifyCode()`, `safeDbMessage()`.

**Orchestration layer:**

5. `$lib/server/notifications/send.ts` — `sendNotification()` coordinates DB insert, SSE push, and external routing. Requires mocking SSE and router in addition to the DB.
6. `$lib/server/retrieval/index.ts` — 261 lines of pure orchestration over embedding, three retrieval tiers, and ranking. Highly testable with mocked tier functions, no DB needed.

**Auth and security:**

7. `$lib/server/http/guards.ts` — `requireAuth`, `requireAdmin` (throwing, pages) and `guardApiUser` (returning, endpoints). Takes `App.Locals` as a plain argument — mock the object, assert redirect/error behavior.
8. `hooks.server.ts` — security middleware (headers, CSRF, auth, rate limiting). **Isolate as a separate concern:** it has side-effect imports (schedulers), Redis connection, and feature logging that must be fully mocked. Mock `auth.api.getSession`, `@upstash/ratelimit`, construct `RequestEvent` objects. 515 lines of critical security logic.

**Load functions:**

9. Form showcase load functions (`forms/basics/contact`, `forms/validation/server`, etc.) — import only from `sveltekit-superforms` and `$lib/schemas/`. No DB, easiest load function tests. Call `load()` directly with a mock event object.

**Components:**

10. `Alert.svelte` — self-contained, internal `$state(true)` for visibility, dismiss flow. Good first component test.
11. Primitives (`Switch`, `Toggle`, `Progress`) — prop-to-DOM behavior, validates custom spacing tokens.

**State machines (high value, tested as factories):**

12. `createRetrievalTrace()` from `retrieval-trace.svelte.ts` — streaming annotation processing, cursor tracking, step status transitions. Pure factory, no external imports.
13. `createDockState()` from `dock.state.svelte.ts` — tab activation, panel close, split creation. Pure factory.

**What NOT to test (thin adapters):**

- Route handlers (`+page.server.ts`, `+server.ts`) — they are 15–25 line adapters that parse params and call domain functions. If the domain functions work, the routes work. Testing them requires constructing `RequestEvent` objects with high ceremony for low signal.
- Structural components (`Card.svelte`, `BackLink.svelte`, `Kbd.svelte`) — pure slots/snippets, no logic.
- Canvas/WebGL components (`NetworkGraph.svelte`, `Scene.svelte`) — impossible in jsdom.

**Side-effect containment:** The `globalThis` sentinels in `vitest.setup.ts` prevent scheduler startup. No earlier test should import anything that chains to `hooks.server.ts`. The `vi.mock('$lib/server/db', ...)` pattern is safe because query/mutation modules only import from `'../index'` (the DB client) — they do not chain through hooks.

**Svelte 5 state testing note:** All `.svelte.ts` state files in this project use the context factory pattern (`createToastState()`, `createDockState()`, etc.), not module-level `$state` singletons. This means the `flushSync()` requirement for external reactive state does **not** apply — call the factory directly in tests.

### Phase 5 — AGENTS.md and CI

1. Write `AGENTS.md` at project root (see template below)
2. Add `.github/workflows/test.yml` running `vitest run` and `biome check` on PRs

---

## AGENTS.md Template

Place at project root. All AI coding agents read this file alongside `CLAUDE.md`.

```markdown
# AGENTS.md

Supplementary instructions for AI coding agents working in this project.
Read CLAUDE.md first. This file adds testing-specific guidance.

## Container-First Execution

Nothing is installed on the host except Podman. All commands run inside the `v10r` container:

    podman exec v10r <command>

Source is bind-mounted (host `.` → container `/app`). File edits are instantly visible.
The container must be running (`podman compose up -d`).

## Test Commands

| From host | What it does |
|-----------|-------------|
| `podman exec v10r bun run test` | Run all tests once |
| `podman exec v10r bun run test:watch` | Watch mode during development |
| `podman exec v10r bun run validate` | Full quality gate before declaring done |
| `podman exec v10r bun vitest run src/lib/server/errors/` | Run tests for one module |
| `podman exec v10r bun biome check --write src/lib/server/notifications/send.ts` | Lint and fix one file |

## Test Patterns

**Co-location:** Tests live next to source. `send.ts` → `send.test.ts`.

**DB isolation:** Use PGlite for any test touching the database.
Mock the DB module with `vi.mock('$lib/server/db', ...)` — see `src/lib/server/test/db.ts`.
Schema is built in-process via `pushSchema` from `drizzle-kit/api`. No migration files, no schema-gen step.

**Neo4j:** Mock `cypher()` for all unit and integration tests.
Only use Test Aura if the test cannot be written any other way.

**Factories:** Use `src/lib/server/test/fixtures.ts` for test data.
Override only what the test cares about.

**Schema changes:** None needed for tests. `createTestDb()` reads the live schema via `pushSchema`,
so test schemas track `src/lib/server/db/schema/` automatically — no regeneration step.

## Boundaries

- **Never** run commands on the host — always `podman exec v10r`
- **Never** add migration files or a `drizzle/` directory for tests — the project is push-only; the harness builds schema in-process via `pushSchema`
- **Never** commit `.env` or `.env.local` (`.env.test` is safe to commit — it contains only fake values)
- **Never** delete or skip a failing test — fix the code or fix the test
- **Never** use `bun test` as the test runner — use `vitest` only
- **Never** install packages on the host — add to `package.json`, restart container
- **Never** import `hooks.server.ts` in unit/integration tests — it starts real schedulers and Redis connections
```

---

## Known Issues and Gotchas

| Issue | Impact | Mitigation |
|-------|--------|------------|
| `vi.stubEnv()` does not affect `$env` modules | Env var mocking broken | Mock `$env/dynamic/private` in `vitest.setup.ts` ([sveltejs/kit#9564](https://github.com/sveltejs/kit/issues/9564)) |
| `$lib/server/auth` throws if `BETTER_AUTH_SECRET` < 32 chars | Module load crash in tests | `.env.test` with a 32+ char fake secret |
| Job schedulers start on import of `hooks.server.ts` | Real `setInterval` loops in tests | `globalThis.__v10r_scheduler = 'test'` sentinel in setup file |
| RAG setup SQL lives outside Drizzle schema | `pushSchema` doesn't create tsvector, HNSW, GIN | Separate `client.exec(sql)` after the push, for RAG tests only |
| `pushSchema` `apply` helper fails on unqualified enums | Schema setup throws | Execute the returned `statementsToExecute` manually; don't call `apply` |
| Schema-scoped enums fail to resolve under PGlite | `type ... does not exist` during table DDL | `CREATE SCHEMA` statements first, then `SET search_path` across all custom schemas, then the rest |
| Stop hook `exit 2` ignored in plugin hooks | Hook doesn't block agent | Use JSON output `{"decision": "block"}` with exit 0 ([claude-code#10412](https://github.com/anthropics/claude-code/issues/10412)) |
| Stop hook infinite loop | Agent never terminates | Check `stop_hook_active` field in hook input ([claude-code#10205](https://github.com/anthropics/claude-code/issues/10205)) |
| POSIX `sh` lacks `pipefail` | Pipe to `tail` masks exit codes | Use `bash -c` with `set -o pipefail` |
| PGlite WASM startup + schema push ~200ms–3s | Default 5s test timeout too short | Set `testTimeout: 15_000` in vitest config |
| Named `node_modules` volume persists across recreations | Stale packages after removal | Use `podman compose down -v` for clean installs |
| Bun test cannot resolve SvelteKit virtual modules | Tests fail on import | Use Vitest only ([oven-sh/bun#5541](https://github.com/oven-sh/bun/issues/5541), [oven-sh/bun#10712](https://github.com/oven-sh/bun/issues/10712)) |
| PGlite + Bun test: WASM out-of-bounds errors | PGlite crashes under Bun test runner | Use Vitest + Node ([oven-sh/bun#15032](https://github.com/oven-sh/bun/issues/15032)) |
| Vitest `workspace` field deprecated | Warning in Vitest 3.2+ | Use `projects` field instead |

### Rejected Approaches

| Approach | Why rejected |
|----------|-------------|
| `migrate` from `drizzle-orm/pglite/migrator` with generated files | Needs a `drizzle/` directory and a `drizzle-kit generate` step. The project is push-only — adding generated files solely for tests splits the schema source and invites drift. `pushSchema` reads the same TypeScript schema the app uses |
| Dependency injection for DB swap | 30+ function signatures change, all call sites affected, zero production benefit. Architecture explicitly chose module imports over DI |
| Testcontainers (real Postgres in Docker) | Container-startup latency per test run, adds Docker daemon dependency inside Podman container. PGlite is faster and sufficient |
| pg-mem | TypeScript reimplementation of Postgres, not real Postgres. No timezone support, approximate numerics, no Drizzle adapter |
| Playwright for component tests | Adds ~300MB Chromium to container. jsdom via `@testing-library/svelte` is sufficient for current component complexity |
| Neon Testing library (branch-per-test) | Real cloud Postgres branches per test file. Production parity but adds network latency, API key dependency, cost at scale. No independent practitioner reports yet — revisit in 6 months |

---

## References

### Official documentation

| Source | Relevance |
|--------|-----------|
| [Svelte Testing](https://svelte.dev/docs/svelte/testing) | Official Vitest + `@sveltejs/kit/vite` setup |
| [Drizzle + PGlite connect](https://orm.drizzle.team/docs/connect-pglite) | Official Drizzle/PGlite connection docs |
| [Drizzle migrate docs](https://orm.drizzle.team/docs/drizzle-kit-migrate) | `migrate` function — the generated-files path this project rejected (push-only) |
| [PGlite API](https://pglite.dev/docs/api) | `dumpDataDir`, `loadDataDir`, `exec`, `query`, `close` |
| [PGlite Extensions](https://pglite.dev/extensions/) | pgvector, btree_gist, pg_trgm extension loading |
| [PGlite ORM support](https://pglite.dev/docs/orm-support) | Drizzle listed as officially supported |
| [PGlite Benchmarks](https://pglite.dev/benchmarks) | Query performance data |
| [Vitest 4.0 release](https://vitest.dev/blog/vitest-4) | Browser Mode now stable, `projects` field |
| [Claude Code Hooks](https://code.claude.com/docs/en/hooks) | PostToolUse and Stop hook configuration |
| [Biome CLI](https://biomejs.dev/reference/cli/) | `--reporter json` flag, `--write` flag |

### Community implementations

| Source | Relevance |
|--------|-----------|
| [PGlite + Drizzle tutorial](https://dev.to/benjamindaniel/how-to-test-your-nodejs-postgres-app-using-drizzle-pglite-4fb3) | PGlite test setup with Drizzle ORM (team serving 2.1M users) |
| [rphlmr/drizzle-vitest-pg](https://github.com/rphlmr/drizzle-vitest-pg) | Reference implementation: Drizzle + PGlite + Vitest |
| [1300 tests in 25s benchmark](https://www.dennisokeeffe.com/blog/2025-06-09-isolating-postgresql-tests-with-pglite) | PGlite performance at scale |
| [PGlite snapshot pattern](https://nikolamilovic.com/posts/fun-sane-node-tdd-postgres-pglite-drizzle-vitest/) | Snapshot/restore for faster tests (experimental) |
| [sveltest.dev](https://sveltest.dev/docs/getting-started) | vitest-browser-svelte patterns reference |

### Issues and discussions

| Source | Relevance |
|--------|-----------|
| [sveltejs/kit#9564](https://github.com/sveltejs/kit/issues/9564) | `vi.stubEnv` vs `$env` modules — still open |
| [sveltejs/kit#8180](https://github.com/sveltejs/kit/issues/8180) | `$env/dynamic/private` in Vitest — resolved |
| [drizzle-orm#4531](https://github.com/drizzle-team/drizzle-orm/issues/4531) | `pushSchema` `apply` prompt behavior — avoided by executing `statementsToExecute` manually |
| [drizzle-orm#1181](https://github.com/drizzle-team/drizzle-orm/issues/1181) | `pgSchema` push edge cases with custom schemas |
| [drizzle-orm#4205](https://github.com/drizzle-team/drizzle-orm/issues/4205) | `pushSchema` community usage and gotchas |
| [oven-sh/bun#5541](https://github.com/oven-sh/bun/issues/5541) | Bun test cannot resolve `$app/environment` |
| [oven-sh/bun#10712](https://github.com/oven-sh/bun/issues/10712) | Bun test cannot handle `$env/dynamic/*` |
| [oven-sh/bun#15032](https://github.com/oven-sh/bun/issues/15032) | Bun bundler + PGlite WASM errors |
| [testing-library/svelte#284](https://github.com/testing-library/svelte-testing-library/issues/284) | Svelte 5 support status and gotchas |
| [claude-code#10205](https://github.com/anthropics/claude-code/issues/10205) | Stop hook infinite loop issue |
| [claude-code#10412](https://github.com/anthropics/claude-code/issues/10412) | Stop hook exit code bug |

### Architecture and patterns

| Source | Relevance |
|--------|-----------|
| [AGENTS.md Standard](https://agents.md/) | AGENTS.md file format and purpose |
| [AGENTS.md: lessons from 2500+ repos](https://github.blog/ai-and-ml/github-copilot/how-to-write-a-great-agents-md-lessons-from-over-2500-repositories/) | What makes AGENTS.md files useful |
| [Self-Improving Coding Agents](https://addyosmani.com/blog/self-improving-agents/) | Agent testing loops, structured feedback |
| [Neon Testing library](https://neon.com/blog/neon-testing-a-vitest-library-for-your-integration-tests) | Branch-per-test with real Neon Postgres — future option |
