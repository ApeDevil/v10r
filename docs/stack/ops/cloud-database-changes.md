# Database changes from a cloud session

How a schema change reaches the production database when the work happens in a Claude Code
cloud session — where `db:push` cannot run. **Stas says to apply it in the conversation; Claude
computes the SQL offline, rehearses it on a throwaway Neon branch, then applies it through the
Neon connector.**

```
schema change shipped to main (shipping.md)
        │
        └─ Stas: "apply the database change"
                 ▼
  bun run db:schema-diff <old-main> <new-main>      ← SQL from the two Drizzle schemas, offline
                 ▼
  run_sql (production)                             ← is the starting point what the diff expects?
                 ▼
  prepare_database_migration → run_sql (temp branch) ← rehearsal on a copy of production
                 ▼
  complete_database_migration → run_sql (production) ← apply, delete the copy, verify
```

## Why it needs its own path

| | Local session | Cloud session |
|---|---|---|
| Database credential | `DATABASE_URL` in `.env` | none — the container has a fake `.env` |
| How the schema reaches Neon | `bun run db:push` (drizzle-kit diffs the live database) | the **Neon connector** (MCP), authorised in Claude's connector settings, never a credential in the repo |
| Who confirms | the developer at the terminal | Stas in the conversation; the Neon tools also prompt per call |

`db:push` needs a live connection to diff against; the cloud has none and must not be given one.
The connector reaches Neon through Stas's own authorisation, so no secret enters the container,
the repo or a commit.

## Prerequisites

- The **Neon** connector is connected for the session (Claude → Settings → Connectors) with
  access to the `v10r` project. `list_projects` must show `broad-night-71900850`.
- The schema change is **shipped** (on `main`), or at least pushed on the feature branch, so its
  SHA names exactly the schema being applied. Production follows `main`; applying a branch's
  schema before it ships leaves production ahead of the deployed code.
- Stas has said to apply it, in the current conversation. A finished ship is not that word.

Constants: Neon project `broad-night-71900850` (`v10r`), database `neondb`. The project's
default branch is production; `dev` is refreshed from it (`docs/blueprint/data/neon-branch-refresh.md`).

## The steps

### 1. Compute the SQL — offline

```bash
bun run db:schema-diff <old-main-sha> <new-main-sha>
```

`scripts/db/schema-diff.sh` checks out the first commit in a scratch worktree, runs
`drizzle-kit generate` there to write a baseline snapshot, then runs `generate` at the second
commit (or the working tree, if it is omitted). The second migration file is the change; the
script prints it and removes everything it made. No database is contacted and nothing in the
repo is written.

**Read the SQL before going on.** Additions — `CREATE TABLE`, `ADD COLUMN` (nullable or with a
default), `ADD VALUE` to an enum, `CREATE INDEX` — are mechanical. Anything else is a data
decision that goes back to Stas: `DROP`, a column type change, `SET NOT NULL` on a column with
rows, a renamed column (drizzle-kit may emit it as drop + add, which loses the data).

### 2. Check production's starting point

One read-only `run_sql` against production: what the diff creates must be absent, what it
alters must be present. A production that already drifted from `main` shows up here, not
halfway through the apply. Rewrite statements idempotently where Postgres allows
(`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`,
`CREATE INDEX IF NOT EXISTS`) so a retry cannot fail on its own first half.

### 3. Rehearse on a temporary branch

`prepare_database_migration` (project, `neondb`, the SQL) branches production and runs the SQL
on the copy. Then exercise it there with `run_sql` on the temporary branch id: insert a row of
the new shape, read the constraints and indexes back. The copy holds production's data, so a
failure here is the failure production would have had.

### 4. Apply and verify

`complete_database_migration` with **every** value the prepare step returned (`migration_id`,
`migration_sql`, `database_name`, `project_id`, `temporary_branch_id`, `parent_branch_id`). It runs
the same SQL on production and deletes the temporary branch. Then one more `run_sql` on
production confirms the result. Rows written during the rehearsal stay on the deleted branch.

To abandon instead, call `complete_database_migration` with `apply_changes: false`: the
temporary branch is deleted and production is untouched.

### 5. Report

The statements applied and the verification query's result, in a few lines.

## Example: the Dynamic Attributes ship (2026-11-05)

Ship `c55b104` added record files to the desk. `db:schema-diff b7a98ce c55b104` printed:

```sql
ALTER TYPE "desk"."file_type" ADD VALUE 'record';
CREATE TABLE "desk"."record" ( "id" text PRIMARY KEY NOT NULL, "file_id" text NOT NULL,
  "user_id" text NOT NULL, "document" jsonb NOT NULL, "version" integer DEFAULT 0 NOT NULL,
  "deleted_at" timestamptz, "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL );
ALTER TABLE "desk"."file_revision" ADD COLUMN "document" jsonb;
-- two foreign keys (file, user; ON DELETE cascade) and two indexes
```

Production had neither the table, the column nor the enum value. The rehearsal inserted a
record file and its row on the copy and read back three indexes and both constraints; the apply
and the verification query matched. All additions — no existing row was touched.

## Rollback

A schema change is rolled back by another change, rehearsed the same way — never by
restoring the database, which would also discard user data written since. For additions the
reverse is a `DROP` and therefore Stas's decision. Neon's point-in-time restore
(`history_retention_seconds`, 6 h on this project) is the last resort for a destructive mistake,
not a routine step.

## Where it is encoded

| What | Where |
|---|---|
| The SQL diff | `scripts/db/schema-diff.sh` (`bun run db:schema-diff`) |
| The steps for Claude | `.claude/skills/cloud-db-change/SKILL.md` |
| The ship's reminder | `.claude/skills/ship/SKILL.md` step 5: a ship that touched `src/lib/server/db/schema/` says production needs the change |
| Push vs migrations in general | `docs/blueprint/data/drizzle-workflow.md` |
