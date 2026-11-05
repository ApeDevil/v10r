---
name: cloud-db-change
description: Apply a shipped Drizzle schema change to the production Neon database from a cloud session (no DATABASE_URL, no db:push). Use ONLY when Stas, in this conversation, says to push or apply the database change; never on your own initiative or because a ship touched the schema.
---

# Cloud database change

Stas's word in this conversation is the authorization. The why and the details:
`docs/blueprint/data/drizzle-workflow.md` → *Schema changes from a cloud session*.

Constants: Neon project `broad-night-71900850` (`v10r`), database `neondb`; the default branch
is production.

1. **SQL.** `bun run db:schema-diff <main-before-ship> <ship-sha>`. Additions only proceed;
   anything that drops, retypes or tightens an existing column goes back to Stas first.
2. **Starting point.** `run_sql` on production: what the diff creates is absent, what it alters is
   present. Rewrite statements idempotently (`IF NOT EXISTS`) where Postgres allows.
3. **Rehearse.** `prepare_database_migration` → `run_sql` on the temporary branch (insert a row of
   the new shape, read constraints and indexes).
4. **Apply.** `complete_database_migration` with every value from the prepare result; then one
   `run_sql` on production to verify. Abandon with `apply_changes: false`.
5. **Report** the statements and the verification in a few lines.

Never run `DROP`/`TRUNCATE`/`DELETE` on production through this skill; never write secrets into
the repo or memory.
