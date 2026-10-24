# SvelteKit 3 migration — 2026-10

v10r moved from SvelteKit 2.49 to SvelteKit 3.1 on branch `claude/fervent-faraday-bqulj0`, starting
from `main` at `1bb9548`. It went in two staged commits so the bundler change could be measured
on its own:

1. **Stage 1:** the newest Kit 2 (2.70.3) on Vite 8 / Rolldown.
2. **Stage 2:** Kit 3.

**Sources.** `svelte.dev` and `vite.dev` are blocked by this environment's network policy, so the
web migration guide could not be read. Every decision rests on the published packages instead:

- the source and types of `@sveltejs/kit@3.1.0`, `@sveltejs/adapter-vercel@7.0.1`,
  `vite@8.3.5` / `rolldown@1.2.15` and `vitest@4.1.12`;
- the `sv migrate sveltekit-3` codemods and their `MIGRATION_TASKS.md` checklist (`sv@1.1.1`).

## Version matrix

| Package | Before | After | Why |
|---|---|---|---|
| @sveltejs/kit | 2.49.2 | 3.1.0 | the migration |
| @sveltejs/adapter-vercel | 6.3.4 | 7.0.1 | Kit 3 peer |
| vite | 7.3.0 | 8.3.5 (Rolldown) | Kit 3 peer `^8.0.12` |
| @sveltejs/vite-plugin-svelte | 6.2.1 | 7.3.1 | Vite 8 |
| svelte | 5.46.1 | 5.57.2 | Kit 3 peer `^5.57.1` |
| typescript | 5.9.3 | 6.0.3 | Kit 3 peer `^6` (not TS 7) |
| svelte-check | 4.7.6 | 4.7.7 | TS 6 |
| vitest | 4.0.18 | 4.1.12 | Vite 8 (stays on 4) |
| sveltekit-superforms | 2.30.0 | 3.0.0 | 2.x imports the removed `$app/stores`; 3.0's public types are unchanged |
| unocss, @unocss/transformer-directives | 66.6.8 | 66.11.0 | < 66.11 drops all utilities under Kit 3 (see below) |
| engines.node | >=22.0.0 | >=22.17.0 | Kit 3 `engines` |

**Left as they were:**

- **Paraglide 2.18, bits-ui, threlte, xyflow, ai-sdk:** compatible as installed.
- **better-auth 1.6.22:** pinned on purpose. Its peer range names Kit `^2`, but it imports no
  `$app/*`, so bun prints only a peer warning; 1.7 adds `^3`.
- **@vercel/analytics 2.0.1:** stays, but its `/sveltekit` entry is no longer used, because it
  subscribes to the removed `$app/stores` and no stable release fixes that.

## Breaking changes addressed

**Configuration**

- `svelte.config.js` is removed. Its options moved into `sveltekit({...})` in `vite.config.ts`:
  - adapter `nodejs22.x` in `fra1`;
  - version name and poll interval;
  - CSP, including the `app.html` sha256;
  - `vitePreprocess`.
- The `alias` option is deprecated, so `$patterns` became `#patterns/*` in `package.json`
  `imports`.
- tsconfig extends `$app/tsconfig`. `rewriteRelativeImportExtensions` was dropped: under `noEmit`
  it did nothing except reject every `#lib/*.ts` import.

**Imports.** `$lib` is removed, so about 3,960 specifiers in about 1,330 files became `#lib`
subpath imports with the real file extension (`.ts`, `/index.ts`, `.svelte.ts`). The codemod
writes `.js`. We use the real extension because Bun 1.3 does not map `.js` to `.ts` through
package `imports`, and bare-Bun scripts (`mcp:excerpts:build`, `patterns:build`, `content:*`,
`perf:*`) reach `src/lib`.

**Environment.** `$env/*` → `$app/env/private`, with one named import per variable.

- Kit 3 exports only the variables declared in `src/env.ts`. v10r declares all 68, each with a
  pass-through schema, so an unset variable stays `undefined` as before. A variable without a
  schema would abort the server at start-up instead.
- `$app/environment` → `$app/env`.
- Vitest reads the declared variables live through `src/lib/server/test/env-mock.ts`.

**Params.** `src/params/locale.ts` → `src/params.ts` (`defineParams`). The matcher now returns the
segment or `undefined`. Left boolean, it would always match, because `false` counts as a value,
and `[[locale=locale]]` would swallow `/blog`, `/admin`, `/api` and the rest. `src/params.test.ts`
pins this. `params.ts` imports the `#lib/i18n/runtime.ts` leaf, because Kit loads it through Node's
own resolver at build time.

**Service worker.** It is now `src/service-worker/index.ts` with its own tsconfig.

- `$service-worker` → `$app/manifest`, `$app/service-worker` and `$app/env`.
- Manifest entries are base-relative `{ path }` objects. `manifestPathname()` in `sw-policy.ts`
  maps them to the same pathnames as before, and has tests.
- Caching behaviour is unchanged: offline shell, cache-first immutable assets, no HTML caching,
  consent-only activation, flush on sign-out, push, kill switch.
- Kit now registers the worker as `type: 'module'`. That is a framework decision.
- The svelte-check gate checks the worker as a second project; an injected type error failed it.

**Errors.**

- `handleError` now receives every error with its `kind`, and the top-level `status`/`message`
  fields are gone. `src/lib/server/http/error-report.ts` keeps the old behaviour: only `unknown`
  errors, and framework errors other than an unmatched route's 404, get an errorId and one log
  line. `error()` 403s and 404s are not logged. Each kind has a test.
- The client hook stays quiet for `app` errors.

**Navigation.**

- `pushState`/`replaceState` → `goto(url, { shallow: true, ... })`.
- Kit 3 runs `before`/`on`/`afterNavigate` for shallow navigations, and for Back/Forward between
  shallow entries whichever API wrote them. So all 25 hooks return early on `shallow`:
  - chart teardown;
  - the update-prompt reload;
  - the unsaved-changes guard;
  - the drawer close;
  - analytics pageviews;
  - the admin focus moves.
- `invalidateAll` → `refreshAll` (33 calls).
- `goto` options `{ replaceState, keepFocus, noScroll }` → `{ replace, reset: false }`.
- `data-sveltekit-*="off"` → `"false"`.
- `preloadCode` now takes a route ID. `preloadNow` resolves the href with `match()`; passing a
  pathname would silently do nothing.
- `goto` rejects same-origin URLs that match no route. Components that follow hrefs someone else
  wrote use `followHref()` (`src/lib/nav/follow.ts`), which loads such URLs as documents, as Kit 2
  did: palette, menu, command and the 404 demos.
- `page.url` is read-only, so the URL-state helpers accept it as read-only.
- `event.request` is read-only, so the i18n hook no longer reassigns it. Nothing downstream read
  its de-localized path.

**Server.**

- External redirects name their origin: `discord.com`, or `external: true` for the R2 URLs the
  store signs.
- Kit's deprecated `json()` → `Response.json()`.
- Moved type imports (`@sveltejs/kit/hooks`, `$app/forms`, `@sveltejs/kit/params`).
- `fail(n)` on the enhanced path is now HTTP `n`; the smoke test checks that. Nothing in the
  request pipeline counts 4xx responses on action POSTs.
- CSRF stays on by default, with no `trustedOrigins`.

## Decisions worth knowing

- **Rolldown chunks by importer, not by surviving export.** Two consequences:
  - Paraglide's ~3,260 compiled messages, reached through one `export *` barrel, collapsed into
    a single 215 KB (gz) chunk that every route loaded; the median route measured 420 KB. Declared
    side-effect free next to the component tree, they split per route again.
  - `moduleSideEffects` became a rule list. A function returning `true` pins every module as
    side-effectful under Rolldown.
- **UnoCSS 66.6 silently emitted no utilities under Kit 3.** It looks up Vite's CSS plugin by
  `config.build.outDir`, and Kit 3 gives each environment its own `outDir`. The build passed and
  the perf ratchet even reported a smaller baseline, while every page lost its layout. 66.11
  fixes the lookup. `scripts/perf/snapshot.ts` (run by `validate:build`) now fails when the root
  stylesheet carries fewer than 200 class rules (healthy: ~490).
- **UnoCSS blocklist `/^\[\d/`.** Clock-time literals extracted as invalid arbitrary properties
  (`.\[08\:00\]{08:00;}`). esbuild's minifier warned and kept them; lightningcss fails the build.
- **@vercel/analytics** moved from the `/sveltekit` entry to the core `inject` + `pageview`.
  Consent gating, `beforeSend` and the dev no-op are unchanged. The landing page is reported at
  injection, then each non-shallow client navigation.
- **Perf tooling.** `snapshot.ts` reads Kit 3's `generated/build/` paths, counts the client runtime
  (now a dynamic import of `entry.js`) and `_app/manifest.js`, and throws on a missing baseline key
  instead of shrinking the baseline.
- **knip.** Its SvelteKit plugin (6.3) reads entry points only from `svelte.config.js`.
  `knip.config.ts` now declares the Kit 3 entries, and the result matches main (2 pre-existing
  unused devDependencies).

## Performance (production build, gzip, full route chain)

Builds compared:
- **A** = `main` 1bb9548 (Kit 2.49, Vite 7 / Rollup)
- **B** = Kit 2.70.3 on Vite 8
- **C** = Kit 3.1

All measured in this container with the same comparator.

| Metric | A | B | C | Ceiling |
|---|---|---|---|---|
| Heaviest route (KB) | 515.5 | 499.1 | **502.1** | 527 |
| Median route (KB) | 234.5 | 226.0 | **229.7** | 238 |
| Baseline, every route (KB) | 84.4 | 89.9 | **94.1** | 85 → **97** |
| Total client JS (KB) | 2275.2 | 2145.6 | **2140.7** | 2340 |
| Total client CSS (KB) | 199.5 | 200.3 | 201.7 | — |
| Largest prerendered doc (KB) | 2.8 | 3.5 | 3.6 | 5 |
| Client chunks | 543 | 520 | 525 | — |
| `validate:build` wall time | 6m54s | 2m48s | **2m52s** | — |
| `validate` wall time | 3m35s | — | 3m27s | — |

**Per route (C vs A):**

- 194 of 202 routes are lighter: median −4.9 KB, quartiles −5.9 / −4.4, best −18.1 KB
  (`/showcases/ai/chatbot`).
- The 8 heavier ones are near-empty routes whose payload is mostly the shared baseline. The
  worst is +9.7 KB, on `/api/consent`.
- The sum over all routes fell from 50,117 to 49,058 KB.

**Why the baseline rose by 9.7 KB.** It is framework output, measured module by module against A:

- Rolldown keeps the whole Svelte client runtime in one shared chunk, where Rollup spread `each`,
  bindings and transitions into route chunks: +19 KB raw.
- Kit 3 serializes history state on the client, so all of `devalue` ships: +14 KB raw.
- Kit 3's larger client runtime and its production error-code tables: about +16 KB raw.

`DEV` branches are folded out: the production bundles carry only short error-code URLs, and the
same Svelte codes as A. The ceiling moved 85 → 97 (94.1 + ~3%), with the reasoning in
`src/lib/server/perf/budgets.json`. Stas approved the raise on 2026-10-24, and with it banked the
gains on two ceilings, back to ~3% headroom over the measured values:

| Ceiling | Before | Approved | Measured |
|---|---:|---:|---:|
| `baseline_js_kb` | 85 | 97 | 94.1 |
| `route_js_kb` | 527 | 520 | 502.1 |
| `median_route_js_kb` | 238 | 238 | 229.7 |
| `total_client_js_kb` | 2340 | 2210 | 2140.8 |
| `doc_html_kb` | 5 | 5 | 3.6 |

**Server side.**

- Kit 3 now writes server sourcemaps by default (28 MB of `.map` under `.svelte-kit/output`).
  None are traced into the Vercel functions.
- A function bundle grew from 101 to 108 MB. Of that, `effect` (+1.5 MB, from the superforms 3
  adapter set) and `@swc/helpers` (+0.9 MB) are new; the rest is version drift.

**Not measured:** field Web Vitals. They need production traffic.

## Validation

**Gates on the final tree:**

- `bun run validate`: green.
  - svelte-check 0 errors: app 11,792 files, service worker 326.
  - Vitest 304 files / 3,425 tests (A: 301 / 3,411).
  - MCP 22 tests.
  - registry, pattern surfaces, excerpts, i18n, content and opacity: all OK.
  - Biome: the 2 warnings main already has.
- `bun run validate:build`: green, all five ratchets within ceilings.

**Release-preparation re-run (2026-10-24, approved ceilings applied).** On the tree with the
banked ceilings:

- `bun run validate`: green. 304 files and 3,425 tests, svelte-check 0 errors.
- `bun run validate:build`: green. The ratchets read route 502.1/520, baseline 94.1/97,
  median 229.7/238, total 2140.8/2210 and document 3.6/5. `snapshot.json` is unchanged.
- The runtime smoke: 22/22.
- Browser specs, the same as main:
  - external-service passes 2/2;
  - compose fails 2/2 here and on main; the dev server has no database
    (`consent:record … fetch failed`).
- `knip`: the same 2 unused devDependencies as main.
- `bun audit`: 54 advisories, against 64 on main.
- Every `.vc-config.json` says `nodejs22.x` and `fra1`.

**Runtime smoke (22/22).** Run on `vite preview` of the production build, with Playwright:

- `/` and `/de` render with the right `lang`;
- `/showcases` is not swallowed by the locale matcher;
- `/en/*` 308s to the unprefixed URL;
- unknown routes give 404 "Page not found";
- the CSP header carries the script hash;
- the prerendered `/offline`, `service-worker.js` and `third-party-licenses.txt` are served;
- the service worker registers and activates;
- UnoCSS utilities apply;
- client-side navigation keeps the page;
- an enhanced `fail(400)` returns HTTP 400 `failure`;
- a cross-origin form POST gets 403;
- there are no unexpected console errors.

**Deployment output.** Every function's `.vc-config.json` still says `nodejs22.x` in `fra1`. The
license file lists 143 packages (A: 141).

**Other checks:**

- `bun audit`: 54 advisories, against 64 on main. None is new; 10 are gone.
- `bun run knip`: matches main.
- Browser specs (`tests/browser`) match main: both external-service specs pass, and both compose
  specs fail as they do on main (a console 404 with no database). One external-service spec failed
  on the way, which surfaced a real Kit 3 change. `enhance` now hands a non-JSON error page over as
  an error carrying the response's status, where Kit 2 surfaced a `SyntaxError`. The lab now tells
  "answered" from "no answer" by SvelteKit's unexpected-error default, and reports the 504 it can
  now read. The spec asserts that status.
- The pinned Playwright 1.56 needs the container's Chromium through a scratch config.

**Not run, because the cloud has no database or credentials:**

- `db:push`, `db:seed`, the RAG ingest (`refresh`);
- live sign-in, sign-out and session refresh against Neon and Better Auth (the unit and PGlite
  suites cover the code paths);
- the Vercel deployment itself.

## Remaining warnings and limits

- **Kit 3 warns that UnoCSS uses `transformIndexHtml`.** SvelteKit has no `index.html` pipeline,
  so the hook never applied.
- **Two warnings both builds share:** UnoCSS cannot resolve the icons `lucide` and
  `lucide-broom`, and `@vercel/functions/websocket` cannot trace the optional `ws` package.
- **Module service workers.** Browsers without them run the site without its worker: no offline
  page and no push.
- **Paraglide's `paraglideMiddleware`** still builds a de-localized request clone. v10r no longer
  uses it, so it is only allocation.
- **Recorded AI fixtures** (`src/lib/showcases/ai/fixtures/chatbot-grounded.ts`) keep the
  `$lib/...` text they were recorded with.
- **Do not edit the docs while a dev server is running.** The app imports the docs through
  `import.meta.glob`, so an edit triggers an SSR program reload, and a request in flight then saw
  a null Svelte SSR context. This was seen once, while the docs were being rewritten concurrently;
  it did not reproduce without concurrent edits.

## Follow-ups

- **better-auth 1.6.22 → 1.7.x**, the first line whose peer range names Kit 3. It is an auth
  upgrade, so it gets its own branch.
- **@vercel/analytics:** return to the `/sveltekit` entry once a stable release supports Kit 3.
- **knip ≥ 6.43** reads `sveltekit()` from `vite.config.ts`. Once it clears the 24-hour cooldown,
  re-check which explicit entries are still needed.
- **Consider removing the superforms adapters the app does not use from the client graph.**
  `@vinejs/vine`, `arktype` and `effect` ship today, and did before the migration.
- **After the ship, run the RAG ingest locally** (`bun run refresh`). The docs changed, and the
  pattern pages and MCP excerpts were rebuilt here.

## Readiness

Ready for a user-authorized ship. Every gate that runs in the cloud is green, and the runtime
smoke passes on the production build. Every regression found along the way was investigated and
fixed at its cause. The budget ceilings are approved (see Performance). Four things stay open:

- the live auth flows;
- the database-backed checks;
- the RAG ingest;
- a post-ship look at production, the Vercel analytics lane included.
