# Performance audit — 2026-10-10

Resume point for the 2026-10 performance pass. Living reference stays where it was:
`docs/blueprint/velocity/` (patterns), `docs/stack/quality/performance.md` (measurement),
`src/lib/server/perf/budgets.json` (targets and ratchets). This file records what was measured,
what changed, and what is still open. All work is uncommitted on `dev` @ 149f43a7.

## 1. Method

| Context | How | Used for |
|---|---|---|
| **Lab — bundle** | `NODE_ENV=production` build, Vite manifest closure per route, gzip -9 (`scripts/perf/snapshot.ts`) | every KB figure below |
| **Lab — rendering** | headless Chrome over CDP, fresh profile per run (cold cache), interleaved before/after, medians of n=5 | LCP/FCP/CLS/TBT |
| **Field** | not read this session — production DB reads were blocked by session policy | open item O1 |

Rendering lab specifics: two `vite preview` servers of production builds — **before** = `git archive HEAD`
(149f43a7), **after** = working tree — each in a throwaway container with the database pointed at a
closed port and no Redis credentials, so no lab request reached production. Mobile profile:
412×823 @1.75, 4× CPU, Lighthouse "Slow 4G" (150 ms RTT, 1.6 Mbps). **Caveat:** `vite preview` is
HTTP/1.1; production is HTTP/2+. Request count costs far more here than on Vercel, so the lab
over-penalizes the finer chunking described in §3.

## 2. Baseline and root causes

| Finding | Evidence | Root cause |
|---|---|---|
| `route_js_kb` / `median_route_js_kb` under-reported every route | median 215.2 KB (node only) vs **296.7 KB** actually loaded; heaviest 492.4 vs **562.8** (`/desk`) | snapshot scored page nodes, skipping every intermediate layout; the `(public)` shell alone is ~160 KB |
| One 59.5 KB gz chunk on 198/199 routes (bits-ui select/menu, floating-ui, **culori**, Carousel, VirtualList, …) | sourcemap attribution | compiled Svelte components have module-scope side effects, so Rollup keeps every component a barrel re-exports; one `import { Button } from '$lib/components'` shipped the whole layer |
| Home LCP on mobile ≈ load event (4.3–4.4 s) | lab, LCP element `div.logo-hero` | the LCP element was a CSS-mask image: discovered after CSS + layout, then downloaded alongside ~250 KB of module preloads |
| Home hero invisible until hydration | `+page.svelte` gated entrance on a hydration `$effect` | `opacity:0` until JS ran; no JS → no hero |
| Service worker precached the full build for every visitor | 710 entries / 8,662 KB raw on first visit | `PRECACHE = [...build]`; SvelteKit registers the worker for everyone |
| Signed-in requests read the session from Postgres every time | better-auth 1.6.22 `session.mjs` | `auth.api.getSession` without `returnHeaders` dropped the cookie-cache refresh (`set-cookie`) |
| Crawler endpoints never CDN-cached | `loadStyle` set a cookie on robots/sitemap/llms/feed | Vercel does not cache responses with `Set-Cookie` |
| Client-side navigations recorded as bot hits | `collector.hook.ts` | `__data.json` carries `sec-fetch-mode: cors` |

## 3. Changes, with evidence

Bundle (lab, gzip, full route chain — the corrected definition):

| Step | Median route | Heaviest | Baseline |
|---|---|---|---|
| start (HEAD + Stas's uncommitted credits work) | 296.7 | 562.8 | 79.6 |
| leaf imports in the shell only | 299.4 | 562.6 | 80.0 — **no effect**: pages import the barrel too |
| `treeshake.moduleSideEffects` for `src/lib/components/` | 241.9 | 521.5 | 82.7 |
| lazy command palette, lazy auth client, timer fix | **231.1** (−22%) | **511.1** (−9%) | **82.7** (+3.1) |

Baseline grew because finer chunks lengthen the per-node preload lists in the generated `app.js` —
accepted explicitly (ceiling 82 → 85, reason recorded in `budgets.json`). Request count for the home
page rose 102 → 134 (chunks 484 → 534): see the HTTP/1.1 caveat.

Rendering (lab, medians n=5):

| Route / profile | Before | After | Note |
|---|---|---|---|
| `/` mobile LCP | 4,276 ms | **1,624 ms (−62%)** | reproduced: 4,344 → 1,632 in an independent run; LCP element now `p.tagline` |
| `/` mobile FCP / TBT / CLS | 916 / 122 / 0 | 940 / 124 / 0 | unchanged |
| `/` desktop LCP | 356 ms | 376 ms | parity, within noise |
| `/` transfer JS / CSS / images | 284 / 50 / 233 KB | 248 / 41 / 142 KB | |
| `/` document | 8 KB | **50 KB** | the price of the inline LCP image (§5 C4) |
| `/showcases`, `/docs` mobile LCP | 820 / 764 ms | 904 / 696 ms | text LCP at FCP; n=3, within noise; load event later (HTTP/1.1) |
| service-worker first-visit precache | 710 entries, 8,662 KB raw | **37 entries, 599 KB raw (−93%)** | |

Static assets: `logo-footer.svg` 38.8 → 24.3 KB gz, `logo-hero.svg` 64.7 → 41.1 KB gz (metadata stripped,
3-decimal coordinates; pixel-diffed at up to 1024 px: 0 pixels differ by more than 32/255).

Server and client fixes (verified in code + unit tests; live effect not yet measured — O1):

| Change | Where | Expected effect |
|---|---|---|
| Forward better-auth `set-cookie` from `getSession` | `auth/session.adapter.ts`, `hooks.server.ts` | signed-in requests stop paying 1–2 session queries; `session_token` Max-Age refresh finally reaches the browser (cookies previously died 7 days after sign-in) |
| Grants loaded only on `/api/blog/*` | `http/guards.ts` `readsGrants` | one query fewer per signed-in `/blog`, `/desk`, `/api/desk` request |
| Style cookie only on HTML/data responses | `style/cookie-scope.ts` | robots, sitemap, llms.txt become CDN-cacheable (they carry `s-maxage`); sitemap stops querying Neon per crawl. **Correction (§8):** the feed sends `max-age` only, so it is still not CDN-cached |
| Bot lane excludes `isDataRequest`; one user-lane page view per navigation | `collector.hook.ts`, `collect-policy.ts` | one Upstash call fewer per client navigation; honest bot/human split |
| Blog image redirect gets `s-maxage`; presign in 15-min windows | `api/blog/*/+server.ts`, `public-image-url` | repeat views skip function + Redis + DB + presign |
| Blog post read 3 → 2 round trips, gated | `blog/queries.ts`, `query-budget.ts` | one Neon round trip per blog post view |
| `CP_` palette ids validated before the DB; LRU cache | `style/palettes.ts` | forged cookies can no longer drive Neon queries |
| Hero entrance CSS-only from first paint | home `+page.svelte`, `fadeIn.ts` | hero visible without JS; no hide-then-show of painted cards |
| Hero logo server-inlined, hashed mask fallback | `primitives/logo/LogoHero.svelte` | the mobile LCP above |
| 3D index on-demand rendering, paused offscreen/hidden/behind viewer | `3d/SceneCard.svelte`, `SceneContent.svelte` | zero GPU frames for invisible cards (reduced-motion now shows still cards) |
| Chat markdown rendered at most once per frame while streaming | `chatbot/StreamedMarkdown.svelte` | INP while Vely streams |
| Desk split resize coalesced per frame; snapshot inside debounce | `desk/DockResizeHandle.svelte`, `DockLayout.svelte` | resize jank |
| Editor publishes through its own debounce | `EditorPanel.svelte` | no bus publish per keystroke |
| Telemetry: rAF-coalesced scroll, no click work when nothing records, vitals only once they can be sent | `analytics/telemetry.ts` | less main-thread work for unconsented visitors |
| Session timer destroyed with its shell | `AppShell.svelte` | one leaked 1 Hz interval per layout-group switch, gone |
| Service worker precaches the offline shell only | `service-worker.ts`, `sw-policy.ts` | the −93% above |

## 4. Regression coverage added

- `snapshot.ts` measures each route's full chain (`baseline + layouts + page`) and names the heaviest
  route by id; ceilings re-baselined: `route_js_kb` 630 → **527**, `median_route_js_kb` 372 → **238**
  (both banked), `baseline_js_kb` 82 → **85** (reviewed raise). Losing the side-effect declaration
  would push the median past 238 and fail `validate:build`.
- `architecture.gate.test.ts`: nothing may import a component module for its side effects alone
  (such an import is now dropped silently).
- `sw-policy.test.ts`: `offlineShellAssets` — only referenced, known build files are precached.
- Agents' tests: `session.adapter.test.ts`, `cookie-scope.test.ts`, `palettes.test.ts`,
  `public-image-url.test.ts`, `animation-frame-coalescer.test.ts`, extended `guards.test.ts`,
  `analytics.pglite.test.ts`, `query-budget.gate.pglite.test.ts` (blog post read budget = 2).
- Gate: `bun run validate` green — 266 files / 3,050 tests, svelte-check 0 errors.
  `validate:build` ratchets OK. Snapshot regenerated (`149f43a7-dirty`).

## 5. Reusable contracts (for downstream instances)

| Contract | Use when | Do not use when | Cost | Proof |
|---|---|---|---|---|
| **C1 Side-effect-free component tree** (`vite.config.ts` `moduleSideEffects`) | a component library is consumed through barrels | modules in the tree register things at module scope | silent drop of side-effect-only imports (gated) | median route −55 KB |
| **C2 Route = full chain** for bundle budgets | any per-route JS budget | — | none | under-report of 81 KB at median found |
| **C3 Offline-shell precache** (precache what `/offline` loads; fill the rest on use) | SSR app whose HTML is never cached | true offline CRUD of unvisited routes | old tabs hitting a removed chunk reload natively (Kit does this) | −93% first-visit SW bytes |
| **C4 Server-inlined LCP graphic** (`{@html}` server value, non-empty client placeholder, hashed CSS-mask fallback) | the LCP element is an image discovered late, ≲ 50 KB gz | the asset is large, or most traffic is repeat visits on a fast link | +42 KB gz on every document of that page (HTML is not cached) | mobile LCP −62% |
| **C5 Lazy shell surfaces** (dialogs/palettes imported on first intent, warmed at idle) | a closed-by-default surface in a layout every route shares | the surface is open on load | first open waits on the network if idle never came | −10.8 KB median |

Registry mapping (§8): C1 → `side-effect-free-components` (new, deep, proven); C2 → an invariant on
`performance-budget-ratchet`; C3 → `pwa-service-worker` (summary corrected, test linked); C4 →
`critical-rendering-path` (new, deep, **implemented** — lab evidence only, no machine-checkable proof);
C5 → `heavy-dependency-quarantine` + `velocity-idle-work`.

## 6. Open — needs Stas

- **O1 Field data.** Read `/admin/perf` (prod lane p75 LCP/INP/CLS, sample sizes) now and ~7 days after
  deploying, to confirm or refute the lab claims. Not readable from this session.
- **O2 CDN-cacheable anonymous HTML** — the largest remaining TTFB lever. Every anonymous page carries a
  per-visitor random style (cookie + stamped palette) and a per-document analytics confirm token, so
  nothing public can be `s-maxage`'d or prerendered. Product decision.
- **O3 Favicon** — `static/favicon.svg` is 121 KB gz (559 paths); precision reduction saves only 17% and
  leaves visible stray pixels at 96 px. Simplified mark or PNG set is a design call.
- **O4 Fonts — DONE, see §7.** Preload rejected by measurement; fallback faces shipped for the sans and
  mono families.
- **O5 Request count** rose 102 → 134 on home. Measure on Vercel (HTTP/2) before reacting; if it matters,
  try Rollup `output.experimentalMinChunkSize`.
- **O6 Docs re-ingest** — `bun run db:ingest-docs` (docs changed; Gemini embed quota).
- **O7** `/showcases/ui/*` has `ssr = false` with no recorded reason; its prerendered primitives page
  bakes a signed-out root layout into page data (stale shell after in-app navigation).
- **O8** smaller items found and not done: 255 Lucide icons in render-blocking root CSS (~13 KB gz);
  observability showcase scans 30 days of raw events per anonymous view (fit for `readThrough`);
  theme script could move above `%sveltekit.head%` byte-for-byte; desk explorer rollback restores a
  captured parent (wrong after interleaved moves); hardcoded `#3b82f6` fallbacks in 9 viz files (token rule; `grep -rl "#3b82f6" src`);
  sign-out `Clear-Site-Data` wipes unsaved spreadsheet drafts.

## 7. Fonts (2026-10-10, second pass)

Lab as §1, mobile profile, typography pinned via the style cookie, n=5 interleaved, against a build
of the tree just before this pass. Three variants were built so the two levers could be separated.

| Variant | FCP vs before | LCP vs before | Home TBT |
|---|---|---|---|
| fallback faces only | +4 to +68 ms (noise) | +8 to +16 ms (noise) | ≈ |
| fallback faces + preload of heading/body woff2 | **+60 to +120 ms, every page** | −208, −108, −168, +36 ms — did not reproduce | **+~110 ms**, reproduced |

**Preload rejected**, reason recorded in `hooks.server.ts`. **Fallback faces**: lab CLS was ≈ 0 with and
without them (the reflow lands mostly below the first viewport), so their effect was measured directly —
mean shift of text blocks between fallback and web-font rendering on two long docs pages:

| Set | none | serif + sans fallbacks | shipped (sans + mono only) |
|---|---|---|---|
| T1 Inter | 30.3 px | 17.6 | **17.6** |
| T2 Playfair / Space Grotesk | 50.4 | 33.4 | **19.0** |
| T3 Space Grotesk / Inter | 30.3 | 17.6 | **17.6** |
| T4 Fraunces / Inter | 19.1 | 17.6 | **12.7** |
| T5 Nunito | 135.8 | 85.1 | **85.1** |

Per-slot isolation showed the serif display fallbacks (Playfair, Fraunces) raise the shift; they are
excluded and the gate knows it. Shipped config re-measured as a build: FCP/LCP/TBT unchanged within
noise; root CSS +0.2 KB. Generator: `scripts/fonts/build-fallback-faces.ts` (woff2 parsed with Node's
zlib, no dependency; reference metrics from Liberation Sans/Mono = Arial/Courier New clones);
cross-check: Inter 107.48% / 90.14% / 22.44% vs `next/font`'s published 107.12% / 90.44% / 22.52%.
Gate: `src/lib/styles/font-fallbacks.gate.test.ts`. `validate` green — 267 files / 3,053 tests
(run in a throwaway container: the dev container was down; one environment-only failure without
`ALTCHA_HMAC_KEY` reproduces identically on HEAD).

## 8. Coverage matrix and registry (2026-10-10, third pass)

**Coverage matrix:** [`docs/blueprint/velocity/coverage.md`](docs/blueprint/velocity/coverage.md) — every
concern of the ten families A–J, marked implemented / incomplete / missing / unnecessary / not audited,
with the record and the evidence or gap. `links.gate.test.ts` fails when the matrix names an unknown
record or omits a Velocity record. Docs routing: velocity and blueprint hub rows; new
`runtime.md` sections *Critical rendering path* and *Side-effect-free component tree*; a CDN-tier
paragraph in `data.md`; `docs/naming.md` separates "critical rendering path" from the critical-path
work class.

**Registry** (172 → 174 records, deep 38 → 41):

| Record | Change | Maturity |
|---|---|---|
| `critical-rendering-path` | new deep card (C4 + hero without hydration gate) | implemented |
| `side-effect-free-components` | new deep card (C1) | proven — `snapshot.gate.test.ts` |
| `velocity-asset-delivery` | light → deep: fallback faces, preload rejection, CDN-cacheable image redirect; stale "document-weight ceiling catches inline-SVG bloat" claim removed | implemented → proven |
| `pwa-service-worker` | summary said "precaches the hashed build" — no longer true; now the offline shell; `sw-policy.test.ts` linked | proven, re-attested |
| `performance-budget-ratchet` | full-chain route invariant (C2) | re-attested |
| `heavy-dependency-quarantine` | barrel note points at the new card; closed-surface note (C5) | re-attested |
| `hierarchical-cache` | CDN admission rules (`s-maxage`, no `Set-Cookie`); `cookie-scope` linked | re-attested |
| `velocity-idle-work` | AppShell palette warming linked | implemented |

`DAG_SHORT_LABELS` got the three new deep ids. The MCP excerpt snapshot grew 1,877 → 1,945 KB
(the Vercel MCP function imports it); `architecture.gate.test.ts` (27 KB) was deliberately left
out of the refs and named in the invariant text instead.

**Correction found while writing the matrix:** the blog feed (`blog/feed.xml`) sends
`public, max-age=3600` without `s-maxage`, so Vercel does not cache it — §3 had claimed otherwise.
Listed as open in the matrix (E, CDN tier); not fixed in this pass.

**Matrix items not previously in §6** (all open, none fixed here): name-check cache keys omit the raw
spelling and credentials (24 h cross-spelling results); tiered cache has no `invalidate()` and a stale
local hit ignores a fresher Redis value; rdap background refresh inherits the finished request's
deadline; the locale cookie is written on every `/api/*` response, including the public search;
`/desk` runs the hook chain twice; blog tag page 4 serial waves; spreadsheet selection re-runs ~2,600
deriveds; knowledge-graph search restarts the simulation per keystroke; no CSS/font budget; the
rendering lab harness is not in the repo.

## 9. Five known bugs (2026-10-10, fourth pass)

| Bug | Fix | Proof |
|---|---|---|
| Name-check cache keys omitted inputs (one spelling got another's results for 24 h; sandbox data outlived a switch to production) | each live source declares `searchInputs` — what its search reads plus the endpoint/vendor, never a secret; the key hashes that | `check.test.ts` "result cache key" + per-source tests |
| Hover preload consumed the desk grant toast | the desk load only reads; `POST /api/grant-notifications/acknowledge` marks seen after the toast shows | grants pglite tests + endpoint test |
| Explorer rollback restored a captured parent (lost a later successful move) | `explorer-intents.ts`: confirmed map + pending intents folded in issue order; duplicate submits send once; the AI pin toggle had the same bug and got the same fix. Also: `expanded` is now a `SvelteSet` (`.add()` on a `$state` Set never re-rendered) | 28 explorer tests |
| Sign-out wiped unsaved spreadsheet drafts | `src/lib/state/unsaved-work.ts`: drain saves (≤3 s), confirm before discarding, remove the user's draft keys only after sign-out succeeds; revoked/expired sessions keep drafts for recovery | 14 tests |
| Hardcoded `#3b82f6` (and siblings) in viz | `theme-bridge.ts` `vizColor` / `colorChannels` / `toRgba` / `readableTextOn`; gate `theme-bridge.gate.test.ts` | lab: see below |

The hex fallbacks hid real rendering bugs, visible in a production build (headless Chrome, before = HEAD build):
- `${oklch}33` alpha fills were invalid colours. Area and radar fills now render translucent: the area chart went from 43,648 opaque pixels to 41,588 semi-transparent ones.
- HeatMap's default range ran oklch tokens through a hex parser and drew a black-and-white checkerboard; it now draws a gradient (49 → 260 distinct colours).
- MapLibre rejected both layers: `color expected, "oklch(.52 .18 260)" found`. Gone after the fix.

Gate: `validate` green — 273 files / 3,115 tests (throwaway container; dev container still down).

Found, not fixed (filed as task chips):
- `/account` layout consumes its welcome marker on hover; admin feedback detail marks items read on hover.
- The session-warning banner's "Sign out" only navigates and never signs out.
- The maps showcase choropleth is blocked by CSP: GeoJSON from maplibre.org, MapLibre CSS injected from unpkg. Pre-existing.
