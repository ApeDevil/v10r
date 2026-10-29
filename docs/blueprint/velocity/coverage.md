# Velocity Coverage

Which performance concerns v10r covers, with which pattern record, and what is still open.
Audited 2026-10-10 against the ten pattern families of the 2026-10 performance pass. All
evidence is from code reading or the lab (production builds, headless Chrome, Slow 4G + 4×
CPU for mobile). No row is confirmed by field data yet: `/admin/perf` has the last word.

| Status | Meaning |
|---|---|
| **Implemented** | the mechanism exists and is applied where v10r needs it |
| **Incomplete** | the mechanism exists, but adoption, proof or a known case is missing |
| **Missing** | a real cost for v10r with no mechanism yet |
| **Unnecessary** | does not pay for itself here today; the reason is stated |
| **Not audited** | outside what this pass inspected; no claim either way |

The Record column names `pattern-library/registry.json` ids, and every Velocity record
appears at least once. `src/lib/server/patterns/links.gate.test.ts` fails if either stops
being true. Maturity (`proven`/`implemented`) lives in the registry, not here.

## A. Critical rendering path

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| LCP element discovered early | Implemented | `critical-rendering-path` | home hero logo inlined in the server HTML; mobile lab LCP 4,276 → 1,624 ms |
| First viewport visible without JavaScript | Implemented | `critical-rendering-path` | CSS-only hero entrance; `fadeIn` hides only below-the-fold cards |
| Fonts and text rendering | Implemented | `velocity-asset-delivery` | metric-matched fallbacks for the sans and mono families cut swap shift 34–62%; preloading rejected (FCP +60–120 ms) |
| Render-blocking CSS | Incomplete | `velocity-asset-delivery` | 255 Lucide icons in the root CSS (~13 KB gz); the theme script waits for every stylesheet |
| Rendering mode per route | Incomplete | — | SSR everywhere; `ssr = false` justified on `/3d` and `/showcases/desk`, unexplained on `/showcases/ui`, whose prerendered primitives page bakes a signed-out shell |
| Anonymous HTML at the edge | Missing | — | a per-visitor random style and analytics confirm token make every public page unique, so none can be CDN-cached or prerendered; product decision |
| Redirects and server work before first byte | Implemented | — | no landing redirect; an anonymous request makes no network call before `load` |
| Streaming non-critical server data | Incomplete | `critical-path-deferred-tail` | the signed-in root layout awaits announcements; a streamed promise would take it off the path |

## B. JavaScript and dependency isolation

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Shared baseline guarded | Implemented | `heavy-dependency-quarantine` | `baseline_js_kb` 82.9 against an 85 KB ceiling |
| Route budget measures what a visitor downloads | Implemented | `performance-budget-ratchet` | baseline + every layout + page; the old metric under-reported the median by 81 KB |
| Barrels tree-shake | Implemented | `side-effect-free-components` | median route 296.7 → 241.9 KB gz from one declaration |
| Heavy libraries behind dynamic imports | Implemented | `heavy-dependency-quarantine` | Threlte, MapLibre, Chart.js, xyflow, the chatbot and the AI SDK are lazy; Shiki is server-only |
| Closed shell surfaces | Implemented | `heavy-dependency-quarantine`, `velocity-idle-work` | command palette and better-auth client load on intent; median 241.9 → 231.1 KB gz |
| Navigation data in every page's JavaScript | Missing | — | the showcase catalog and admin nav (13.2 KB gz) ship to anonymous visitors |
| Chunk count | Incomplete | — | home went from 102 to 134 requests; the lab is HTTP/1.1, so measure on Vercel before acting |
| Duplicate libraries | Not audited | — | |

## C. Svelte rendering efficiency

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Effect and timer lifecycle | Implemented | — | the 1 Hz session timer leaked per layout-group switch; now destroyed with its shell |
| Expensive re-renders while streaming | Implemented | — | chat markdown renders at most once per frame instead of per chunk |
| Large lists | Unnecessary | `virtualized-rendering` | no app list passes ~200 rows (admin pages paginate, the IO log caps at 200); the desk explorer is the first candidate |
| Fine-grained selection state | Missing | — | one spreadsheet selection change re-runs ~2,600 deriveds (50×26 grid); measurable on low-end Android |
| `$effect` copying props | Missing | — | several prop-to-local copies should be writable `$derived`; navigation progress animates `width` |

## D. Server and data loading

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Independent reads in parallel | Incomplete | `no-waterfall-loading` | blog post 3 → 2 round trips; blog tag page still 4 serial waves, admin AI and two showcases serial |
| Session lookup | Implemented | — | the cookie-cache refresh is forwarded, so signed-in requests stop reading the session from Postgres |
| Work only where it is read | Implemented | — | grants load on `/api/blog/*` only |
| Round trips per operation | Incomplete | `query-budget` | blog post read registered (budget 2); the session lookup and the desk layout (7 queries + 1 UPDATE) are not |
| Screen read models | Incomplete | `velocity-screen-read-model` | analytics aggregates use them; the observability showcase scans 30 days of raw events per anonymous view |
| Compute next to data | Implemented | `velocity-compute-locality` | Vercel `fra1` next to Neon; Upstash region unknown |
| `ssr = false` routes | Incomplete | — | `/showcases/desk` runs the whole hook chain twice (document, then `__data.json`) |
| Neo4j on critical paths, cold start | Not audited | — | the single server function bundles three.js; measure its size before splitting |

## E. Caching and freshness

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Key identity and scope | Implemented | `hierarchical-cache` | `cacheKey` refuses both scope mistakes |
| Explicit invalidation | Incomplete | `hierarchical-cache` | no `invalidate()`; a stale local hit is served without checking Redis for a fresher value |
| Stale serving and stampede protection | Implemented | `stale-while-revalidate`, `singleflight` | production use is name-check only |
| CDN tier | Incomplete | `hierarchical-cache` | crawler endpoints and blog image redirects fixed; the feed sends `max-age` only; `/api/search` is public while the locale cookie is written on `/api/*` |
| Process-local caches | Incomplete | — | palette cache is LRU and validates ids before the DB; announcements are per-instance and unbounded |
| Service worker | Implemented | `pwa-service-worker` | precaches the offline shell only (710 → 37 entries); HTML and data never cached |
| Cache keys cover every input | Implemented | — | name-check sources declare `searchInputs` — exactly what each search reads, plus the endpoint it calls; code constants (e.g. the TLD list) are not in the key |

## F. Interaction responsiveness

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Optimistic mutation with exact rollback | Implemented | `optimistic-mutation` | the velocity showcase, and the desk explorer's moves and AI pins (a tree variant of the fold; the old capture-and-restore rollback lost a later successful move) |
| Navigation | Incomplete | `intent-preloading` | hover preload app-wide; the desk layout load no longer writes, but the `/account` layout still consumes its one-time welcome marker on hover, and the admin feedback detail marks an item read |
| Idle preparation | Implemented | `velocity-idle-work` | command palette warmed at idle; `preloadOnIdle` used by the showcase only |
| Dragging and resizing | Implemented | — | desk split resize coalesced to one update per frame; snapshot inside the debounce |
| Search and filtering | Incomplete | — | palette search debounced; knowledge-graph search restarts the force simulation per keystroke |
| Editor input | Implemented | — | the editor publishes through its own debounce, not per keystroke |

## G. Media and asset delivery

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| R2 delivery | Implemented | `velocity-asset-delivery` | redirect carries `s-maxage`; presigned in 15-minute windows so the URL is stable |
| SVG weight | Incomplete | `velocity-asset-delivery` | logos −37%; the favicon is 121 KB gz and needs a simpler mark |
| Dimensions and lazy loading | Missing | `velocity-asset-delivery` | blog body images have neither |
| Responsive formats (`srcset`, AVIF/WebP) | Missing | — | no `enhanced-img`; blog images ship as uploaded |
| Static asset cache headers | Missing | — | unhashed `/logo`, `/favicon.svg`, `/models/*.glb` (7.2 MB) and `/images/parts` revalidate every visit |
| Video | Not audited | — | |

## H. Heavy computation and visualization

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Workers and WASM | Implemented | `main-thread-budget` | image analysis in a worker; WASM kernel benchmarked including transfer cost |
| Visibility-aware 3D | Implemented | — | the 3D index renders on demand and pauses offscreen, hidden and behind the viewer |
| Resource cleanup | Implemented | — | charts, d3-force and 3D layers dispose on destroy |
| Texture and geometry budgets | Missing | — | no budget; GLB files are unhashed (see G) |

## I. Deferred work and resilience

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Critical / deferred / background | Implemented | `critical-path-deferred-tail` | one wrapper owns the platform rules |
| Durable background work | Implemented | — | the jobs scheduler and durable step execution |
| Breakers, bulkheads, shedding, retry | Implemented | `resilience-policy` | |
| Deadlines | Incomplete | `deadline-propagation` | a background refresh inherits the finished request's deadline and can abort at once |
| Deferred cost | Incomplete | `critical-path-deferred-tail` | anonymous page views write to Postgres after the response; the bot lane already buffers in Redis |

## J. Observability and contracts

| Concern | Status | Record | Evidence / gap |
|---|---|---|---|
| Field, lab and development kept apart | Implemented | `performance-budget-ratchet` | |
| Server timing | Implemented | `latency-tracing` | admin-only span detail on a public-cached response is unconfirmed |
| Adverse-condition scenarios | Implemented | `scenario-harness` | the grid's empty rows are listed in [measurement.md](./measurement.md#performance-scenario-harness) |
| HTML, CSS and font budgets | Incomplete | `performance-budget-ratchet` | `doc_html_kb` sees prerendered documents only; no CSS or font budget |
| Rendering lab in the repo | Missing | — | the LCP/CLS/TBT harness of this pass lived outside the repository |
| Contract fields per pattern | Incomplete | — | purpose, preconditions, use / avoid, invariants and proof are record fields; bundle impact, server cost, caching semantics and failure behaviour are prose in these docs |
