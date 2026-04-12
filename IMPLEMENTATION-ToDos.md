# Implementation ToDos

Post-audit priorities. Ordered by leverage — what connects the most unused infrastructure and proves the most patterns.

---

## 1. Graph Explorer Showcase

Interactive knowledge graph visualization. Exercises Neo4j queries, XYFlow, D3-force — all installed but unused. Proves tier-2 graph traversal works end-to-end.

- Neo4j constraints and RAG nodes already exist
- `@xyflow/svelte`, `d3-force`, `d3-dag`, `d3-hierarchy` installed
- Route: `/showcases/ai/retrieval/graph/+page.svelte` (placeholder exists)
- Needs: node/edge rendering, force layout, click-to-expand traversal, search

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
