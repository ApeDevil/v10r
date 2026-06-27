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

Budgets (warn/fail thresholds) live in `budgets.json`.

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
```

## Not yet automated

- **Core Web Vitals (LCP/INP/CLS)** — needs a browser on a prod build; drive via the
  Chrome extension injecting `web-vitals`, or add Lighthouse CI.
- **Embeddings-per-turn / SSE first-token** — read the Redis embed counter before/after a
  chatbot turn; costs Gemini free-tier quota (1000/day), so it's manual on purpose.
