# Performance harness

Repeatable probes that answer **"is v10r actually fast?"** with numbers, not vibes.
Pairs with the `perf-*` skills (which say *what* to keep fast) — these measure *whether it is*.

**Golden rule:** measure a **prod build** (`vite build` + `vite preview`) or the live
deployment. The dev server's numbers are meaningless (unminified, HMR overhead).

## Probes

| Script | Measures | Needs | Confirms |
|--------|----------|-------|----------|
| `cold-start.sh` | container vite-ready + first TTFB | podman | SSR module-graph regressions |
| `db-explain.ts` | corpus size, HNSW plan, GUCs, hot-query `EXPLAIN ANALYZE` | DB env | pgvector seqscan, index usage, brand-row gate |
| `ttfb.sh` | first-byte across representative routes | running app | load/render cost per route |
| `bundle.sh` | client JS chunks + prerendered HTML weight | a `vite build` | bundle bloat, inline-asset bloat, ISR coverage |
| `snapshot.ts` | writes the **committed** lab snapshot | a prod `vite build` | bundle regressions, via the gate test |
| `vely-turn-tap.js` | AI turn milestones for BOTH surfaces — headers, `start`, first text, first paint, `finish`, composer ready, metadata bytes, the server's per-lane pipeline; on `/desk`, also the approval record: click → server verdict (status, steps run) → the panel's confirmed reload, with the human review gap kept apart | paste into the browser console on `/showcases/ai/chatbot` or `/desk`; **manual, costs Gemini quota** | where a chatbot turn's seconds go, and how long an approved desk change takes to become visible, before/after a change — see "Paired runs" below |

Budgets live in **`src/lib/server/perf/budgets.json`** — one source of truth, read by
the app (`/admin/perf`), the gate test, and these scripts (via `jq`).

`snapshot.ts` is the one that persists. The others print and the numbers vanish, which
is how a 610 KB route sat unnoticed: nothing compared today's build to last week's.
Its output is asserted by `src/lib/server/perf/snapshot.gate.test.ts` inside
`bun run validate`.

## Run

```bash
# DB plans + corpus (read-only; safe against prod). Highest signal.
podman compose run --rm --entrypoint bun app run scripts/perf/db-explain.ts

# Bundle (after a prod build)
podman compose run --rm --entrypoint bun app run build
bash scripts/perf/bundle.sh

# TTFB against a local prod preview
podman compose run --rm --service-ports --entrypoint sh app \
  -c "bun run build && bun run preview --host --port 4173" &
BASE=http://localhost:4173 bash scripts/perf/ttfb.sh

# Cold start
bash scripts/perf/cold-start.sh

# Lab snapshot — MUST be a production build. compose.yaml sets NODE_ENV=development,
# so without the -e override every number is ~9% inflated and the gate rejects it.
podman exec -e NODE_ENV=production v10r bun run build
podman exec -e NODE_ENV=production -e GIT_SHA="$(git rev-parse --short HEAD)" v10r \
  bun run scripts/perf/snapshot.ts
```

## Not yet automated

- **Core Web Vitals in the lab** — real-user CWV is collected continuously and shown at
  `/admin/perf` (prod lane only; see `docs/stack/quality/performance.md`). What is missing
  is a *synthetic* run on a prod build — drive via the Chrome extension injecting
  `web-vitals`, or add Lighthouse CI.
- **Embeddings-per-turn** — read the Redis embed counter before/after a chatbot turn; costs
  Gemini free-tier quota (1000/day), so it's manual on purpose. SSE first-token is covered by
  `vely-turn-tap.js` above (also manual, same reason).

## Paired runs (the turn tap)

Chatbot fixtures, one conversation each, in this order on `/showcases/ai/chatbot`: `Thanks` ·
`What is Velociraptor?` · `How does this work?` · `Where is the auth showcase? Give me the link.`
Desk fixtures on `/desk` with synthetic `QA *` files, never real ones: read ("What is in C3?"),
create ("Create a sheet Budget with A1=100"), gated edit ("Set B2 to 42" → approve), plan
("Rename X to Y and set A1" → approve), conflict (edit the cell between review and approve),
failure (second step targets a deleted file). Discard the first request after a dev-server start
(Vite SSR compile, ~12 s).

Baseline and candidate interleaved (B, C, B, C, …), ≥ 5 runs each per fixture, same model, same
corpus; report medians and ranges, p95 only with n stated. Gemini's free tier allows 20 generation
requests per day and every tool step is one — pace at ≤ 15 requests/min and budget a full
comparison at ~120 requests; a 3-run smoke set is fine for an intermediate check, never for the
acceptance claim. Groq's free tier (8 k TPM) cannot finish a grounded or multi-step turn — record
those runs, do not compare them. Open the I/O Log panel before approving on `/desk`: the tap reads
`tRefreshed` from its entries.
