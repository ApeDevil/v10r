# Drizzle Workflow: Dev → Production

How to manage database schema changes across development and production environments using Drizzle ORM.

## Development: `db:push`

`bunx drizzle-kit push` — diffs TypeScript schema against live DB and applies changes directly.

- Officially recommended for prototyping and solo development
- No files produced, no history tracked
- Destructive: may drop+recreate columns instead of renaming — fine when data is disposable
- Use `--strict` flag if you want approval before SQL executes

This is the right tool when there's no production data to protect.

## Production: `generate` + `migrate`

`drizzle-kit generate` produces versioned SQL files. `migrate()` applies them in order.

- SQL files are version-controlled, reviewable in PRs
- Ordered history enables reproducing any DB state from scratch
- Required when real user data exists and schema changes must be non-destructive

Workflow: edit schema → `drizzle-kit generate` → review SQL → apply via `migrate()`

## Transitioning from push to migrations

When a production DB is first created (fresh, no prior data):

1. `drizzle-kit generate --name=init` — produces a single baseline SQL from current schema
2. Apply to fresh prod DB via programmatic `migrate()`
3. All subsequent changes: edit schema → `generate` → review SQL → `migrate`

No hacks needed for fresh DBs. The "baseline problem" (syncing push history with migration journal) only affects teams that already pushed data into prod — avoid this by switching before prod goes live.

If transitioning with an existing prod DB that was managed via push: generate the baseline SQL, then manually insert its hash into `__drizzle_migrations` to mark it as already applied ([Discussion #1604](https://github.com/drizzle-team/drizzle-orm/discussions/1604)). There is no official `drizzle-kit baseline` command.

## Production migration gotchas

| Issue | Impact | Mitigation |
|-------|--------|------------|
| No migration locking ([#874](https://github.com/drizzle-team/drizzle-orm/issues/874)) | Concurrent deploys run migrations twice | Wrap `migrate()` with `pg_advisory_lock` |
| CLI unreliable with Bun ([bun#23740](https://github.com/oven-sh/bun/issues/23740)) | `drizzle-kit migrate` hangs or crashes | Use programmatic `migrate()` from `drizzle-orm/.../migrator` |
| `migrate()` keeps process alive | Bun hangs on open handles | Explicit `process.exit(0)` after completion |
| No rollback support ([#1339](https://github.com/drizzle-team/drizzle-orm/discussions/1339)) | No down migrations | Write manual rollback SQL if needed |
| Editing generated SQL | Corrupts snapshot state, wrong diffs forever | Never manually edit generated migration files |
| Enum rename | Generates drop+recreate, fails with existing data | Manual `ALTER TYPE ... RENAME VALUE` |
| `pgEnum` not exported | `CREATE TYPE` silently omitted from output | Always export enum objects |

## Related

- [../../stack/data/drizzle.md](../../stack/data/drizzle.md) - Drizzle technology reference
- [../../stack/data/postgres.md](../../stack/data/postgres.md) - Database
