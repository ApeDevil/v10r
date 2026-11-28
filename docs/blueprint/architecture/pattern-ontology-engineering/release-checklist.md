# Release-blocking checklist: persisted and derived pattern identities

Slices 2 and 3 renamed, merged, split and retired 143 records and replaced `depends_on` with typed
relationships. The registry and everything generated from it in the tree are consistent and gated
(`preservation.gate.test.ts`, `pattern-graph.gate.test.ts`, `mcp:excerpts:check`, skills and pages
checks). What lives **outside the tree** — database rows, the RAG index, the graph database, caches,
connected clients — still carries the old identities. None of it may be changed during Slice 3
("Do not modify live infrastructure or delete stored records during this slice without separate
authorization"), so this checklist records each surface, the procedure, and what blocks the release.

**Release rule:** the ontology branch ships to `main` only after every row below is either *done* with
its evidence or *accepted as is* by ApeDevil in writing. The ship itself is the `ship` skill; this
checklist is what ApeDevil reviews before saying "ship it". Nothing here runs without that word.

## Inventory

| # | Surface | What carries an old identity | Effect if left | Blocks release? |
|---|---|---|---|---|
| 1 | `mcp.call_log.subject` (Postgres) | `get_pattern` / search rows store the **resolved pattern id** at call time; 143 previous ids appear in historic rows (`src/lib/server/db/schema/mcp/call-log.ts`, "no FK: the registry is a build-time artifact") | Usage analytics group old and new ids separately ("which patterns are fetched but never traced" splits) | **Yes — decide.** Historic telemetry is evidence of what was answered; rewriting it falsifies history. Recommended: keep rows, add a read-time mapping from `reconciliation/manifest.json` in the analytics query. Needs ApeDevil's choice |
| 2 | `retrieval.document` / `retrieval.chunk`, source `docs` | Pattern pages are ingested from `docs/pattern-library/<id>.md`; retired and renamed ids leave **stale documents** whose canonical path no longer exists, plus their chunks and embeddings | `search_project_docs` and Vely can cite a retired page; "Depends on" text from the old pages competes with the new relationships | **Yes.** `db:ingest-docs` tombstones docs whose file is gone (delete-not-seen reconcile) and re-derives changed ones by derivation key. Must run once against production after the ship |
| 3 | `retrieval.corpus_map` (`map_project_docs`) | The ingest-built corpus map lists pattern pages by path | The prompt anchor names pages that no longer exist | **Yes**, fixed by the same ingest run (rebuilt every run) |
| 4 | Retrieval doc ids in stored answers | Citations persisted in conversation history / turn traces point at old document ids or paths | Old citations open nothing | No (history). Accept as is: a citation records what was cited then |
| 5 | Neo4j catalog projection (`db:catalog-sync`, `Resource` nodes) | Showcases and sections only; pattern ids are **not** projected today (`src/lib/server/graph/catalog.ts`) | None | No. Verify once with a read-only `MATCH (r:Resource) WHERE r.id IN $old` before ship |
| 6 | Neo4j GraphRAG entities (tier 3) | Entity extraction for the docs corpus is deferred (`scripts/db/ingest-docs.ts` header); user corpora are unrelated | None today | No. Becomes a row if docs entity extraction is enabled |
| 7 | Generated surfaces in the tree | `docs/pattern-library/*.md`, `skills/`, `mcp/server.bundle.js`, MCP App bundle, `mcp/public-excerpts.snapshot.json` | — | Done in Slice 3: rebuilt and gated (see [slice-3.md](./slice-3.md#regenerated-surfaces)) |
| 8 | Hosted MCP clients (ChatGPT, Claude, Codex) holding ids | Agents and saved prompts that call `get_pattern {"id":"architecture-hosted-mcp"}` | `not_found` with recovery actions (the tool answers a registry gap, never an alias — D-10) | No. Accepted by D-10 (no aliases); note it in the release notes |
| 9 | MCP App explorer state (`ui://` view) | The view keeps no storage (`pattern-explorer.test.ts` forbids `localStorage`); state is per call | None | No |
| 10 | Vercel / CDN cache of `/docs/pattern-library/<old-id>` | Prerendered or cached pages of retired ids | A cached old page outlives the deploy | **Yes — verify.** The new deploy no longer builds those routes; confirm the old URLs answer 404 after the deploy (read-only `curl -I`) |
| 11 | Redis / KV caches holding tool answers | No tool answer is cached across deploys today (answers are computed per call from the bundled registry) | None | No. Re-check if a response cache is added |
| 12 | Dev evidence and infrastructure configuration | `pattern-library/bench/*` baselines, `reconciliation/*`, `.env.placeholder`, `vercel.json`, compose files | Losing them loses the before/after proof | Preserve: Slice 3 edits none of the baselines or infra config; the gate's HISTORY list keeps the baseline files exempt from the alias scan |

## Reconciliation procedure (after "ship it", in order)

1. **Read-only inventory** against production, recorded in the ship report:
   - `SELECT subject, count(*) FROM mcp.call_log WHERE subject = ANY($old_ids) GROUP BY 1;`
   - `SELECT source_uri FROM retrieval.document WHERE source = 'docs' AND deleted_at IS NULL AND source_uri LIKE '/docs/pattern-library/%';` (`source_uri` carries the canonical `/docs` path) compared with the pages the tree builds.
   - The Neo4j read in row 5.
2. **Ship** the squashed branch (`ship` skill). The deploy builds only the new pattern pages.
3. **Re-ingest the docs corpus** (`bun run db:ingest-docs`, locally against production per
   `docs/stack/ops/cloud-database-changes.md`). Expect: retired pages tombstoned with their chunks,
   changed pages re-derived, the corpus map rebuilt. The embed quota bounds one run; a cut-short run
   resumes on the next.
4. **Verify**: the query from step 1 returns no active document for an old id; `search_project_docs`
   for a renamed concept cites the new page; old pattern URLs answer 404.
5. **Telemetry (row 1)**: apply ApeDevil's choice. The recommended read-time mapping is a query change in
   the analytics read path, not a data migration, and needs no stored-record change.

Every step that writes (3, and 5 if a data migration is chosen instead) needs ApeDevil's explicit
authorization at that time; steps 1 and 4 are read-only.

## Not run in Slice 3

All of the above. The cloud session has no database, no Neo4j and no production access, so the
inventory counts are **unknown**, not zero.
