# Implementation ToDos

Post-audit priorities. Ordered by leverage — what connects the most unused infrastructure and proves the most patterns.

---

## 1. Graph Explorer Showcase ✅ DONE

Interactive knowledge graph visualization at `/showcases/ai/retrieval/explorer`. Exercises Neo4j queries and d3-force end-to-end.

- [x] KnowledgeGraph + NetworkGraph with d3-force layout
- [x] Search (via RAG tier 3) + "Load All Entities"
- [x] Click node → detail panel (properties, outgoing/incoming edges)
- [x] Expand-neighbors traversal via `/api/retrieval/graph/node/[elementId]`
- [x] Entity/relationship type filters
- [x] v2: incremental force layout — positions preserved on merge
- [x] v2: shortest-path highlighting via `/api/retrieval/graph/path`
- [x] v2: elementId plumbed through retrieval so search results expand too

## 2. Real Analytics Dashboard

Rollup job runs, `daily_page_stats` has real data, but dashboard uses mock data. Connect the actual query layer.

- `analytics.daily_page_stats` table populated (463+ rows)
- Showcase pages exist at `/showcases/analytics/`
- Chart.js already integrated
- Needs: replace mock data with real queries, date range filtering

## 3. MapLibre Showcase

`maplibre-gl` and `svelte-maplibre-gl` are installed with zero usage. Build a showcase or drop the deps.

- Options: store locator, event map, heatmap overlay
- Rounds out the viz capabilities alongside charts and graphs

## 4. Folder Nesting in Explorer

DB supports nested folders with cycle detection (`moveFolder`), but Explorer panel renders flat.

- `createFolder`, `moveFolder`, `deleteFolder` mutations work
- `countFolderContents` query exists
- Needs: tree rendering in ExplorerPanel, drag-to-move, breadcrumb navigation

## 5. Discord OAuth Callback

Telegram and email notifications work end-to-end. Discord is half-wired.

- Schema ready, token storage ready
- Settings UI partially built
- `/app/notifications/settings/discord/callback/+page.svelte` exists
- Needs: OAuth token exchange, webhook registration, test message

## 6. Admin Expansion

Blueprint documents 11 admin pages. Only users + audit export exist.

- **RAG management** — indexed documents, re-embed, delete
- **AI provider dashboard** — cooldown states, usage stats, per-user preferences
- **Cache inspector** — Upstash Redis visibility (deferred, low priority)

---

## Not Now

- **CI pipeline** — solo dev, `validate` covers it locally
- **Migrations** — no prod data, `db:push` is correct
- **More 3D scenes** — two showcases prove the pattern
- **Session inspector / impersonation** — admin luxury, not foundational
