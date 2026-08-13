# Performance measurement

Two measurement contexts, deliberately never merged. Surfaced at `/admin/perf`, explained at `/showcases/observability`.

| Context | Source | Answers | Enforced by |
|---------|--------|---------|-------------|
| **Field** | real-user telemetry (`analytics.events`, `event_type = 'timing'`) | how fast is it for real visitors, right now | nothing — reported only |
| **Lab** | a production build, committed as `src/lib/server/perf/snapshot.json` | what did this commit do to the bundle | `snapshot.gate.test.ts` |

Field data cannot catch a bundle regression: weight does not appear in RUM until it has already shipped. Lab data cannot tell you the site is slow for users in Australia. Scoring one against the other's budget is the mistake `budgets.json` splits `kind: "lab"` from `kind: "field"` to prevent — a warm local preview and a real user across the internet are not the same measurement, so `ttfb_ms` (600 ms) and `field_ttfb_ms` (1800 ms) are separate budgets.

## Telemetry lanes

The dev server writes into the production analytics database. This is fixed at the source (`telemetry.ts` and `journey-beacon.ts` are `dev`-gated), but the read side filters anyway, for two reasons: rows already written stay in the retention window, and a filter that **reports what it excluded** is the only thing that notices if the source-side gate regresses.

The skew is not symmetric noise. Dev samples come from localhost — no network, no TLS, no cold start — so they pull every latency percentile **down**. Measured over 30 days: 72% of samples were dev rows, and TTFB p75 read 1051 ms against an honest 1431 ms. Contamination made the site look *faster*, so nothing about the number invited suspicion.

**The discriminator** (`db/analytics/lanes.ts`): `web-vitals/attribution` records the CSS selector it blamed, and Svelte's scope-class format differs between builds.

```
dev   nav.flex-1.overflow-y-auto.p-2.s-Xv7_7mcdkQaC.scrollbar-nav
prod  nav.flex-1.overflow-y-auto.p-2.scrollbar-nav.svelte-1e55qdy
```

No extra column, no backfill. `DEV_SCOPE_PATTERN` is written to be valid in **both** POSIX (Postgres `~`) and JavaScript regex, because the SQL filter and the TS classifier must not diverge. It is anchored so it cannot match `svelte-`: the character after `s` must be `-`, and in `svelte-` it is `v`. A pattern matching both would filter out every real sample and show an empty production lane on a healthy deployment.

Targets carrying no scope class at all are `unknown` — excluded, never assumed prod. Within a session, dev wins over prod: one dev marker proves a developer's browser was involved, while a prod marker only proves one component came from a prod build.

## Targets vs ratchets

`budgets.json` holds both, and they do different jobs.

- **Targets** (`budgets`) — where we want to be. Scored on `/admin/perf`, never build-failing. Several are red today; saying so is the point.
- **Ratchets** (`ceilings`) — the measured value at the moment it was accepted. Asserted by the gate, and only ever moved **down**.

The heaviest route is ~609 KB gzipped against a 250 KB target. A gate wired to the target would fail on the commit that introduced it and be muted the same afternoon; ratchets stop the number growing while the target stays visible as the thing still to fix. Lowering a ceiling is how an improvement gets banked.

Bundle weight suits a gate unusually well: invisible in review (a one-line import can add 100 KB), deterministic (same source, same number), and only catchable before shipping.

## Regenerating the lab snapshot

**Must** be a production build. A dev-mode build compiles both halves differently and inflates client JS ~9%; the snapshot records its `NODE_ENV` and the gate refuses to score anything that does not say `production`.

```bash
podman exec -e NODE_ENV=production v10r bun run build
podman exec -e NODE_ENV=production -e GIT_SHA=$(git rev-parse --short HEAD) v10r bun run scripts/perf/snapshot.ts
```

Note `compose.yaml` sets `NODE_ENV=development`, so the `-e` override is required — without it every local build number is inflated. Vercel sets production itself, so deploys are unaffected.

## Reading the idle-gap panel

TTFB grouped by how long the platform sat idle before a visit, counting crawler hits (~50× human traffic here — they are what actually keeps a container warm).

It is a **proxy, not an instrument**. It cannot see which container served a request, so a short gap does not prove a warm start: under a crawler burst, requests fan out across many fresh containers, producing short gaps and slow responses together. Two ways to get this wrong, both of which produced a confidently wrong answer before the panel existed:

- Anchoring on the timing event and using `lag()` over all events measures the gap to the **sibling** event of the same page load, milliseconds earlier — every sample lands in `<1m` and the chart shows one bar.
- Excluding crawler hits from the stream massively overstates idle time, because crawlers are what fill the gaps.

The panel refuses to be read as a trend below `MIN_SAMPLES_FOR_P75` per bucket. A curve drawn from n=2 is how an audit reaches a conclusion it has to retract.

## Manual probes

`scripts/perf/` — measure a **prod build** or the live deployment; dev-server numbers are meaningless.

| Script | Measures |
|--------|----------|
| `snapshot.ts` | writes the committed lab snapshot (bundle + prerendered HTML) |
| `db-explain.ts` | corpus size, HNSW plan, GUCs, hot-query `EXPLAIN ANALYZE` |
| `ttfb.sh` | first-byte across representative routes |
| `bundle.sh` | client JS chunks + prerendered HTML weight |
| `cold-start.sh` | container vite-ready + first TTFB |

## Related

- [../ops/caching.md](../ops/caching.md) - Edge and Redis caching
- [../../blueprint/analytics/two-lane-model.md](../../blueprint/analytics/two-lane-model.md) - Anonymous vs authenticated analytics lanes
- [./biome.md](./biome.md) - The other gate in `bun run validate`
