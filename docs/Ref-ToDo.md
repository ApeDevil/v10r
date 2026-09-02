# Ref-ToDo — database work pending from the self-expressive refactor

**Status 2026-09-02: Neon quota is back. Steps 1 and 4b (the renames) are DONE. Step 4
(Neo4j) was done 2026-09-01. Step 2 (`db:push`) is the one thing left that needs a human
terminal — see its "What you will see" block. Steps 3 and 5 are recorded inline.**

The refactor renamed the `rag` Postgres namespace to `retrieval` and removed five dead
tables and five dead columns. Neon returned `HTTP 402 — "Your account or project has
exceeded the compute time quota"` for the whole session, so none of it was applied.

Until step 1 runs, **every query against the retrieval subsystem will fail** with
`relation "retrieval.chunk" does not exist` (and the same for `retrieval.document`,
`retrieval.llmwiki_page`, …). Tests still pass because they run against PGlite built from
the schema files, not against Neon.

Delete this file once every step is green.

---

## Order is load-bearing

Step 1 must precede step 2. `drizzle-kit push` cannot express a schema RENAME — it sees
`rag` gone and `retrieval` new, and offers to DROP and CREATE, which would destroy every
document, chunk and embedding. Run the rename first and push has nothing to say about the
namespace at all.

---

## 1. Rename the namespace  ·  Postgres  —  ✅ DONE 2026-09-02

```bash
podman exec v10r bun run db:rename-rag-schema
```

Runs `ALTER SCHEMA rag RENAME TO retrieval` — one catalog update that carries the tables,
indexes, constraints and enums across with their data intact.

The script is **guarded and idempotent**:

| It finds | It does |
|---|---|
| `rag` only | renames, prints the table count it moved |
| `retrieval` only | reports "already renamed", exits 0 |
| neither | refuses — run `db:push` on a fresh database instead |
| **both** | refuses — a previous run was interrupted, or a `db:push` created `retrieval` empty. Inspect both and merge by hand; the script will not choose. |

Source: [`scripts/db/rename-rag-schema.ts`](../scripts/db/rename-rag-schema.ts).

Ran green: `Renaming schema rag → retrieval (10 tables)… Done.` Verified afterwards in
`pg_namespace`: `retrieval` exists, `rag` does not; 745 documents / 10,893 chunks / 7
llmwiki pages travelled with it.

---

## 2. Drop the dead objects  ·  Postgres  —  ⏳ PENDING (needs your terminal)

```bash
podman exec -it v10r bun run db:push
```

Interactive — it must be run in a real terminal (raw-TTY prompts cannot be piped). An
automated PTY driver was blocked by the agent's permission classifier on 2026-09-02, so this
one step stays manual.

### What you will see (derived from the live catalog on 2026-09-02)

1. **Three "Do you want to truncate … table?" prompts** — for `blog.asset_folder` (1 row),
   `blog.post_folder` (1 row) and `desk.folder` (3 rows). All three are the phantom
   `nullsNotDistinct()` re-prompt described below. Answer **No** (the first option, Enter).
2. **One "Found data-loss statements … Do you want to continue?"** listing only the five
   column drops: `entity_kind`, `entity_id`, `proposal_id` on `ai.tool_call` (19 rows) and
   `entity_ref`, `group_key` on `notifications.notifications` (3 rows). The five dead tables
   are empty (0 rows each), so push drops them silently without listing them. Answer
   **Yes** (arrow down, Enter).
3. `[✓] Changes applied`.

Nothing else should appear. `retrieval`, `personalization` and `dbops` were verified to
match the schema files after the renames (`run_pkey` keeps its old name on
`dbops.operation` — a single-column primary key, whose name drizzle-kit does not diff).

### Say YES to dropping these

They have no writer in the codebase and none in the schema any more.

**Tables**

| Object | Why it goes |
|---|---|
| `ai.agent_audit_log` | never written. Its own doc-comment claimed "v10r writes one row per governor decision" — it did not. |
| `retrieval.collection_document` | never written. The only reader was an admin badge showing a count that was always 0. |
| `retrieval.llmwiki_page_link` | readers but no writer — the compile pipeline that would fill it was a placeholder exporting `true`. |
| `retrieval.llmwiki_page_redirect` | same |
| `retrieval.llmwiki_lint_issue` | same |

**Enums** (declared alongside `llmwiki_lint_issue`, dropped with it)

- `retrieval.llmwiki_lint_code`
- `retrieval.llmwiki_lint_severity`

**Columns** — never supplied by any caller; the two indexes are on permanently-NULL columns

| Table | Columns | Indexes |
|---|---|---|
| `ai.tool_call` | `entity_kind`, `entity_id`, `proposal_id` | `tool_call_entity_idx`, `tool_call_proposal_idx` |
| `notifications.notifications` | `entity_ref`, `group_key` | — |

### Say NO to this

If push asks **"Do you want to truncate `<table>`?"** for a UNIQUE constraint that already
exists, pick **"No, add without truncating"**. This is a known drizzle-kit 0.31.x bug — it
does not read `indnullsnotdistinct` when rebuilding its snapshot, so it re-prompts for
`nullsNotDistinct()` constraints on every push. Declining is a no-op. Choosing *yes* wipes
real data for a phantom diff.

### Say NO to anything touching `retrieval` structurally

After step 1 the namespace already matches the schema files. If push offers to **create or
drop anything inside `retrieval`**, stop and investigate — it means the rename did not take
and you are one keystroke from recreating the corpus empty.

---

## 3. Re-ingest the docs corpus  ·  Postgres  —  ◐ PARTIAL 2026-09-02, re-run needed

```bash
podman exec v10r bun run db:ingest-docs
```

Must run **after** step 1 — the script's SQL targets `retrieval.document` directly.

This pass renamed `docs/blueprint/ai/nrag-observability.md` → `retrieval-observability.md`
and rewrote roughly twenty other docs. `ingest-docs` handles both: changed files are
soft-deleted and re-inserted, and its delete-not-seen reconcile soft-deletes rows whose
file is gone, so the old path retires on its own.

**2026-09-02 run:** 251 public docs found, **59 changed docs re-embedded**, then the Gemini
free-tier embed cap (1000 requests/day) hit and the script exited 1. The script is
resume-safe (content-hash skip), so simply run it again on a later day; it will pick up the
remaining changed docs and then run the reconcile step, which did not execute this time.
One document is **temporarily missing** from the active corpus until that re-run:
`/docs/pattern-library/databases-cache` (its prior version was soft-deleted right before
the embed failed — the script soft-deletes before it inserts). Nothing is half-written: all
2,034 unembedded active chunks are section-level parents, which are never embedded by design.

---

## 4. Re-project the catalog to Neo4j  ·  Neo4j  —  ✅ DONE 2026-09-01

```bash
podman exec v10r bun run db:catalog-sync
```

Ran green: 298 resources, 275 `PART_OF` edges seeded, 5 stale nodes removed. Neo4j is a
separate service and was never affected by the Neon quota. It was needed because the
showcase catalog changed:

- section anchors `#nrag` → `#retrieval` on the chatbot and deskbot showcase pages
- the docs sublink `/docs/blueprint/ai/nrag-observability` → `…/retrieval-observability`,
  label "nRAG Observability" → "Retrieval Observability"

No Neo4j labels or properties were renamed, so `db:neo4j-setup` is **not** needed.

---

## 4b. Naming-integrity refactor  ·  Postgres  —  ✅ DONE 2026-09-02

A second, independent set of renames that `db:push` also cannot express. Same hazard as
step 1: drizzle-kit reads a rename as DROP + CREATE, which here would destroy user
preferences, custom palettes and the branch-operation ledger.

```bash
podman exec v10r bun run db:rename-naming-refactor
```

| Rename | Holds |
|---|---|
| schema `app` → `personalization` | `user_preferences`, `custom_palettes` |
| table `dbops.run` → `dbops.operation` | the Neon branch-operation ledger (+ its five indexes) |
| enums `dbops_run_{status,kind,trigger}` → `dbops_operation_{…}` | — |

Source: [`scripts/db/rename-naming-refactor.ts`](../scripts/db/rename-naming-refactor.ts).
Guarded the same four ways as step 1 (source only → rename; target only → no-op; neither →
refuse; both → refuse). Run it **before** the `db:push` in step 5.

Ran green: schema, table, all five indexes and all three enums renamed in one pass.

Why `app` moved: it held only per-user personalization, while "app" read as *the* application
schema and collided with the `app-shell` pattern category and the (now retired) `app_` i18n
prefix. See [`naming.md`](./naming.md).

Nothing else in this refactor touches the database. The `showcase.audit_log` ambiguity was
resolved in TypeScript instead (`auditLog` → `showcaseAuditLog`), since the two tables were
already separated by their Postgres namespaces.

---

## 5. Verify  —  ◐ everything that does not need `db:push` is green (2026-09-02)

```bash
# must report NO changes — the real check that steps 1 and 4b landed cleanly
podman exec v10r bun run db:push

# the DB half of the content drift check that `validate` skips offline
podman exec v10r bun run content:check:db

# whole gate, unchanged since the refactor: 184 files / 3404 tests
podman exec v10r bun run validate
```

Results 2026-09-02: `content:check:db` → no drift. `validate` → green, 185 files / 3431
tests, svelte-check 0 errors over 10,404 files. `/showcases/privacy/retention` renders
**17 rows** (curl against the dev server). Still open: the two no-diff `db:push` runs, and
the two checks below that need an admin login (`/admin/ai/retrieval`, a grounded chatbot
answer).

Then in a browser, against real data:

- `/admin/ai/retrieval` loads, its nav tab is active, and the LLM-Wiki Health card shows
  Pages / Overview-Content / Stale (the Links, Redirects and Lint panels were removed with
  the tables that never had a writer).
- `/showcases/privacy/retention` lists **17 rows** — the 15 governed by
  `server/retention/schedule.ts` plus `feedback.feedback` (manual deletion) and
  `auth.session` (self-expiring). It published 4 before this refactor.
- The chatbot answers a grounded question, which exercises `retrieval.chunk` and
  `retrieval.llmwiki_page` end to end.

---

## Not needed

- **`db:retrieval-pre` / `db:retrieval-post`** — the pgvector extension and the HNSW index already
  exist and moved with the schema in step 1.
- **`db:search-backfill`** — no search-vector column changed; `retrieval.chunk.search_vector`
  is a generated column that travelled with the rename.
- **`db:neo4j-setup`** — no Neo4j constraint or index was renamed.
- **`db:seed`** — no seed data changed.

---

## Also pending, from the naming refactor

Neither needs DDL; both are re-derivations blocked on the same quota.

```bash
podman exec v10r bun run db:ingest-docs    # re-embed the renamed docs — 59 done 2026-09-02, rest on re-run (embed cap)
```

The `db:catalog-sync` half of this is covered by step 4 and is done: `/showcases/ui/workbench`
→ `/showcases/ui/dock` is live in the Neo4j `:Resource` projection.
