# Runtime Velocity

What the platform, the bundle and the dependencies do to latency — and what bounds them.

## Critical path / deferred tail

**Problem.** Secondary effects of an operation are awaited before the response, so the user
waits for work they did not ask for.

Saving a document:

| Class | Work |
|---|---|
| Critical | authentication, authorization, validation, the canonical write |
| Deferred | analytics, graph sync, search indexing, activity events, notifications |
| Background | embeddings, media processing, AI enrichment, large projections |

```text
request → critical work → RESPONSE → deferred work → background work
```

**Two platform facts** make `deferAfterResponse` a function rather than a convention:

Vercel **freezes the execution environment** the moment a response returns. A bare un-awaited
promise there is not merely unordered, it is not guaranteed to run at all — documented
behaviour, not a race. `waitUntil` keeps it alive; off Vercel (container, tests) it degrades
to plain fire-and-forget, which is correct there.

An unhandled rejection can take the serverless process down (SvelteKit #9785), so the
`.catch` must be attached **before** the promise is handed over — not inside the work, not
afterwards. Six call sites each restated that rule in a comment; one of them getting it wrong
is invisible until a provider has an outage.

**Where it is used:** the analytics collector hook, notification live-notify and external
routing, the job-execution log, consent audit rows, MCP call-log telemetry, and the SWR
background refresh.

**This is not `http/defer.ts`.** `safeDeferPromise` keeps a *streaming* promise alive inside a
response body; `deferAfterResponse` runs work after the response is finished. Two lifetimes,
two files.

**Invariants.**

- Deferred work is never necessary for the correctness of the returned result.
- Deferred failures are logged, never rethrown — the response is gone and there is nobody to
  tell.
- Deferred work is idempotent: delivery is at-least-once and the platform may retry the
  request that spawned it.
- A durable write that must be acknowledged is critical, not deferred.

**Implementation.** `src/lib/server/platform/after-response.ts`, tests in `after-response.test.ts`.

## Critical rendering path

**Problem.** The server answers on time and the page still paints late. The element the
visitor waits for — the LCP element — is hidden until hydration, or it is an image the browser
discovers only after the stylesheet and layout, and then downloads alongside every module
preload.

**The rule.** What the first viewport needs paints from the document and its render-blocking
CSS. JavaScript enhances it; it never reveals it.

**No hydration gate on visible content.** Chrome does not count an `opacity: 0` element as
LCP, so a `$effect` that adds a class to reveal the hero makes LCP equal to hydration — on
v10r's home page, ~245 KB gz of JavaScript — and with failed JavaScript the hero never
appears. The home entrance now runs as CSS from first paint, and `fadeIn` hides only cards
that are below the fold when it runs, so painted content never blinks out.

**The LCP graphic arrives with the document.** The home hero's raptor was a CSS mask: found
after CSS and layout, then sharing a Slow 4G link with ~250 KB of module preloads. Lab LCP
(Slow 4G, 4× CPU, n=5) was 4.3 s and landed with the load event. A preload started the fetch
450 ms sooner and the file still finished with everything else. Inlined in the server HTML,
LCP fell to 1.6 s (4,276 → 1,624 ms; an independent rerun gave 4,344 → 1,632). Desktop was at
parity. Not yet confirmed in field data.

**Inline it once.** `LogoHero.svelte` gives `{@html}` the SVG on the server and a one-element
placeholder on the client, so the ~40 KB string is tree-shaken out of the bundle. Hydration
keeps the server's nodes because, for a non-empty value that differs, Svelte adopts what is
there by design (`hydration_html_changed`, suppressed in place). The client value must not be
`''`: an empty value skips adoption and discards the inline SVG. After a client-side
navigation the placeholder draws the same picture as a CSS mask from a hashed, immutably
cached file.

**The price.** +42 KB gz on every document of that page, because HTML is not cached.
`doc_html_kb` measures prerendered documents only, so no gate sees it.

**Use when** the LCP element is a graphic discovered late (a CSS background or mask, or
inserted by JavaScript) and small enough — roughly 50 KB gz or less — to ride every document
of its page.

**Do not use when** the asset is large, or most traffic is repeat visits on fast links, where
a cached file beats re-sending bytes in uncached HTML. A photo belongs in an `<img>` with
`fetchpriority="high"` and declared dimensions, not inline.

**Invariants.**

- Content in the first viewport is visible without JavaScript.
- A preload is a measurement, not a default. Two were measured here and both rejected: the
  hero logo (no gain) and the fonts (slower first paint; see Asset delivery).
- An inlined asset ships once: a server-only value, never also in the client bundle.

**Known gaps.** The consent banner renders client-only, and on a first visit its text block
may become the LCP element (unmeasured; field data decides). The theme script sits after
`%sveltekit.head%`, where it waits for every stylesheet before the parser continues.

**Implementation.** `src/lib/components/primitives/logo/LogoHero.svelte`,
`src/routes/[[locale=locale]]/(public)/+page.svelte`,
`src/routes/[[locale=locale]]/(public)/_components/fadeIn.ts`.

## Heavy dependency quarantine

**Problem.** An optional heavyweight capability lands in the shared client bundle and makes
every other route heavier.

**Applies to** Three.js/Threlte, MapLibre, D3, Chart.js, CodeMirror, spreadsheets, graph
visualization, complex AI UI.

```text
small application shell
        │
   feature boundary
        ↓
   dynamic import
        ↓
   heavy capability
```

**Use when** a dependency is large, feature-specific, rarely used, browser-only, or expensive
to initialize.

**The metric that matters** is not the route's own size:

> Did this capability make every other route heavier?

`baseline_js_kb` in `budgets.json` answers exactly that — the client JS every route loads
regardless of page. Its ratchet is 85 KB against a measured 82.7 KB, so under 3 KB of
headroom stands between an ordinary import and a gate failure. That is deliberate: the
ceiling carries ~3% headroom to absorb a feature, and explicitly not enough to absorb a heavy
dependency, which is what it exists for. `median_route_js_kb` asks the same question one
level up — a layout every public page shares is a baseline too, just not the root one.

**Closed surfaces load on intent.** A dialog or palette that is closed on every page load is
a heavy capability of its own, just a small one, and it sits in the layout every route
shares. The command palette is imported the first time it opens and warmed when the browser
goes idle (see [Idle and speculative work](./interaction.md#idle-and-speculative-work)).
The better-auth client is imported inside the two functions that call it. Together with the
session-timer fix, that took the median route from 241.9 to 231.1 KB gz. The cost: if idle
never came, the first open waits on the network.

### Side-effect-free component tree

**A barrel of Svelte components is not tree-shakeable by default.** A compiled component
runs code at module scope (`$.delegate(...)`, template factories), so Rollup must keep every
component a barrel re-exports — one `import { Button } from '#lib/components'` shipped the
whole primitives layer, culori and bits-ui's select and menu included, to 197 of 199 routes.
Rewriting the shell's imports as leaf imports changed nothing (299.4 KB), because pages import
the barrel too.

`vite.config.ts` therefore declares `src/lib/components/` side-effect free
(`treeshake.moduleSideEffects`): a component is bundled when an export of it is used and
dropped when it is not. That one declaration took the median route from 296.7 to 241.9 KB gz.
Its price is stated in `architecture.gate.test.ts`: nothing may import a component module for
its side effects alone, because such an import is now silently dropped.

**Use when** a component layer is consumed through barrels. **Do not use when** a module in
the declared tree registers something at module scope that other code relies on — a custom
element definition, a global listener, a plugin registration. Those imports would vanish
without an error.

**Where v10r already does this.** The 3D model registry code-splits per model; Threlte never
enters the baseline. The wasm kernel is loaded via `?url` with explicit init and no Vite
plugin. `CodeBlock` is imported directly rather than through the composites barrel, because
the barrel would pull the markdown sanitizer into everything.

**Invariants.**

- An optional heavy capability does not enter the shared baseline without explicit
  justification.
- Browser-only capabilities stay off SSR paths unless needed.
- Heavy feature loading sits behind a clear code-splitting boundary.

**Proof.** `bun run validate:build` regenerates the lab snapshot and `snapshot.gate.test.ts`
asserts `baseline_js_kb`, `route_js_kb`, `median_route_js_kb`, `total_client_js_kb` and
`doc_html_kb` against their ceilings. Note that `bun run validate` contains no build step —
bundle regressions are only caught by `validate:build`.

**Implementation.** `src/lib/server/perf/snapshot.ts`, `scripts/perf/snapshot.ts`,
`src/lib/server/perf/budgets.json`.

## Main-thread budget / compute isolation

**Problem.** Expensive synchronous browser work blocks input and rendering.

**The hierarchy** — and each step needs measurement to justify the next:

```text
cheap operation                        → main thread
noticeable CPU work                    → Web Worker
sustained compute with proven benefit  → WASM + Worker
```

**Use when** parsing large payloads, transforming or processing images, laying out graphs,
crunching data, or running expensive editor operations.

**Where v10r already does this.** `src/lib/workers/image-analysis.worker.ts` moves palette
extraction off the main thread (`/showcases/workers`). `src/lib/wasm/kernel/` is a Rust crate
compiled in an ephemeral container, vendored as artifacts, and benchmarked at
`/showcases/wasm` against a line-for-line JavaScript implementation — including the
serialization and transfer cost, without which a WASM benchmark is a comparison of two
different problems.

`vite.config.ts` pins `worker.format: 'es'`; the dev/prod IIFE difference is a real trap and
is commented there.

**Invariants.**

- Heavy compute does not unnecessarily block user input.
- Worker and WASM boundaries are justified by measurement, not by expectation.
- Serialization and transfer costs are included in every benchmark.

**Implementation.** `src/lib/workers/`, `src/lib/wasm/`, `crates/kernel/`,
`docs/blueprint/architecture/workers.md`.

## Asset delivery

**Problem.** Images and fonts dominate page load while the JavaScript budget gets all the
attention.

**Images.** Responsive sizes, AVIF/WebP, intrinsic dimensions, thumbnails, placeholders, CDN
delivery, lazy loading, and above-the-fold priority for the few that earn it.

**Fonts.** Subsetting, the minimum set of weights, self-hosted delivery, and a fallback that
occupies the web font's box — so the swap changes glyph shapes, not layout.

*Preloading is not a default; it is a measurement.* Preloading the visitor's heading and body
faces (one or two files) delayed FCP 60–120 ms on every page tested and added ~110 ms TBT on
the home page, while its LCP effect did not reproduce between runs (lab, Slow 4G + 4× CPU,
n=5, 2026-10-10): a high-priority font competes with the stylesheet that gates first paint.
v10r does not preload fonts, and records why in `hooks.server.ts`.

*Metric-matched fallbacks are per family, also by measurement.* `font-fallbacks.css` is
generated from the installed font files (`scripts/fonts/build-fallback-faces.ts`): a local
Arial or Courier New with `size-adjust` and ascent/descent/line-gap overrides. On two long
docs pages they cut the text shift at swap 34–62% for every typography set. The two serif
display faces got none: as bold headings — Fraunces at a large optical size — their
fallbacks made the shift worse, because metrics from the regular default instance do not
describe the face as rendered. `font-fallbacks.gate.test.ts` holds both the generated
values and the exclusion.

**Where v10r stands.** PWA icons are generated with sharp (`bun run pwa:icons`). Blog images
are served by a 302 to a presigned R2 URL; the redirect of a published asset is
`public, max-age=300, s-maxage=1800, stale-while-revalidate=600`, so Vercel's CDN (which
ignores `max-age` alone) answers repeat views without invoking the function, and refusals stay
`no-store, private`. The presigned URL is signed against a 15-minute window, so it is
byte-identical across requests in that window and the image stays browser-cached, and it is
valid for longer than the sum of those three cache lifetimes. The image toolkit handles resize
and format conversion. `@sveltejs/enhanced-img` is not in use. `doc_html_kb` (ceiling 5 KB)
measures prerendered documents only — SSR documents are invisible to it, including the home
page, which inlines its LCP graphic on purpose (see
[Critical rendering path](#critical-rendering-path)).

**Invariants.**

- Pages do not ship oversized media.
- Images declare dimensions, so layout does not shift. *Not yet true of blog body images:*
  the rehype step rewrites `src` only, with no dimensions and no lazy loading.
- Only genuinely critical assets get high loading priority — marking everything priority is
  the same as marking nothing.
- A web font gets a fallback face only where measurement shows it reduces the shift at swap.

**Known gaps.** `/logo/*`, `/favicon.svg` (121 KB gz), `/models/*.glb` and `/images/parts/*`
are unhashed and get Vercel's default `max-age=0, must-revalidate`, so every visit
revalidates them. 255 Lucide icons ride the render-blocking root CSS (~13 KB gz).

**Implementation.** `scripts/fonts/build-fallback-faces.ts`, `src/lib/styles/font-fallbacks.css`,
`scripts/pwa/generate-icons.ts`, `src/routes/api/blog/assets/[id]/image/+server.ts`,
`src/lib/server/store/blog/queries.ts` (`PUBLIC_BLOG_IMAGE_CACHE_CONTROL`, `generatePublicBlogImageUrl`),
`src/lib/server/imagemeta/`.

## Resilience policy

**Problem.** A slow or unhealthy dependency makes the fast path slow, and retries make it
worse.

Four questions, four modules, and the value is in keeping them apart:

| Question | Mechanism |
|---|---|
| Should we call this at all right now? | `breaker.ts` |
| How much of the pool may this dependency hold? | `bulkhead.ts` |
| Is this work worth doing under the current pressure? | `shedding.ts` |
| Is this failure worth repeating, and out of whose budget? | `retry.ts` |

None of them substitutes for another. A breaker without a bulkhead still lets a merely
*slow* dependency exhaust the instance — it never fails, so the breaker never opens. A
bulkhead without a breaker keeps calling something that is already down, just fewer at a
time. A retry without a deadline is the thing that turns a dependency's bad minute into an
outage.

The recurring temptation is to merge them into one `resilientCall()` wrapper. Resist it: its
defaults are wrong for most call sites, and at the one call site where the behaviour matters
nobody can predict what it will do.

### Circuit breaker

The cost of a failing dependency is rarely the failures. It is that every request still pays
the full timeout to discover the same answer, so one unhealthy provider makes every request
slow rather than some requests fail.

Two ways to open, and the difference matters. `trip()` is for a dependency that **told** us
to back off — a 429 with `Retry-After` is an instruction, not a signal to be inferred by
counting to five first. `recordFailure()` is for the inferred case: failures counted inside a
window, opening at the threshold. The window is what stops a slow drip of unrelated errors
over an hour from ever adding up to an outage.

State lives in Redis with an in-process mirror, because on serverless there is no single
process to hold it: every cold instance would independently rediscover that a provider is
down, which is exactly the hammering the breaker exists to prevent. The mirror is written
**first** — a Redis write that fails after the dependency refused us would otherwise leave
the breaker closed and the retry storm intact.

There is deliberately **no half-open state**. The first caller after the window is the probe;
the breaker simply closes, and one more failure reopens it. A true half-open — admit exactly
one request, hold the rest — needs a second lock and another round trip, and a handful of
simultaneous probes is cheaper than that coordination. Same trade
[`singleflight`](./data.md#singleflight--stampede-protection) makes when it refuses to let a
cold caller wait on a lock.

### Bulkhead

Named for the compartments in a ship's hull: a breach floods one section rather than the
vessel. The failure it prevents is the indirect one — a dependency slows from 50ms to 5
seconds, requests waiting on it pile up, and they exhaust the connections and concurrency
every *other* capability also needs. The incident report then names the wrong system.

Past the cap, callers are **refused rather than queued**. A queue is latency the caller
cannot see and the operator cannot measure, and an unbounded one is a slower way to run out
of memory; `maxQueued` absorbs a burst, it does not store a backlog.

This bounds **one instance**, and saying so is part of the pattern. Ten Vercel instances each
holding four slots is forty calls at the dependency, and no local bookkeeping can see that —
the fleet-wide bound is the platform's concurrency setting and the dependency's connection
limit, which is where it belongs.

A bulkhead makes the noisy capability *slower*: half the slots means twice the rounds. That
is the trade, and it is worth taking exactly when one capability's throughput is worth less
than another's latency.

### Load shedding

Every system has a load at which it cannot serve everything. The only choice is whether the
thing dropped is chosen or arbitrary — without shedding, the queue decides, and an analytics
write and a sign-in wait in the same line.

So the three classes above become an admission decision, against two independent signals.
**Load** is how full the compartment is; thresholds sit *below* the bulkhead's own limit
deliberately, because dropping optional work at half capacity is how the pool avoids being
full for the work that is not optional. **Budget** is how much of the deadline is left: work
that cannot finish in the time remaining should not start, having spent a slot to be
abandoned. An idle server with 20ms on the clock is still the wrong place to begin a 200ms
enrichment.

`critical` is never shed for load. When there is genuinely no room the bulkhead refuses it,
and that refusal is a visible 503 rather than a silent drop. The decision is a pure function
of two numbers and returns its reason, because a shed nobody can see is indistinguishable
from a bug.

### Bounded retry

The easiest mechanism to add and the easiest to get wrong, and both mistakes multiply. Three
attempts at a "reasonable" 30-second timeout is a 90-second request; three clients each
retrying three times is nine calls at the moment the dependency can least take them.

Two rules stop both. A retry spends the **same** budget as the attempt it replaces — which is
why `retryWithin` takes a `Deadline` as its first argument rather than a timeout as its third.
And backoff carries **full jitter**, `random() × capped`, not the cap and not the cap ± a
bit: clients that failed together retry together unless something spreads them, and a fixed
backoff reproduces the synchronised burst one delay later.

A per-attempt expiry **is** retryable — that is what `attemptMaxMs` is for. A refusal from
the breaker or the bulkhead is not: those say the system already decided not to try, and
asking again inside the same request spends budget to receive the same answer.

Retry only idempotent work. The module cannot check it, and a network timeout is precisely
the case where the first attempt may have succeeded unseen.

### Where v10r uses this

| Mechanism | Where |
|---|---|
| Circuit breaker | `ai/providers.ts` — provider cooldown, the domain's policy and vocabulary over `resilience/breaker.ts` |
| Timeout vs failure policy | `http/rate-limit.ts` — `onTimeout` (Upstash slow) and `onError` (Upstash down) are separate decisions, because fail-closed protects a limiter guarding unbounded work and merely deletes a feature guarding best-effort work |
| Graceful degradation | `sessionPopulate` degrades an authenticated request to anonymous on a Neon outage — privileges only ever drop, never widen |
| Stale fallback | `stale-if-error` in [`data.md`](./data.md#stale-while-revalidate) |
| Load shedding | the analytics pageview limiter, deliberately `onError: 'open'` and *inside* the deferred block, so a Redis outage degrades collection and cannot touch rendering |

**Invariants.**

- Retry storms are impossible.
- Failure of one optional capability does not block unrelated capabilities.
- Resilience mechanisms are observable: every refusal names its kind, every shed decision
  returns its reason, every opened breaker logs the count and window that opened it.
- Fallback behaviour preserves domain safety — a fallback that widens a permission is not a
  fallback.
- A refusal is distinct from a failure. `ResilienceError` means the work never ran, so the
  caller knows a retry is pointless and a fallback is the only useful response.

**Implementation.** `src/lib/server/resilience/`, tests alongside each module. Measured at
[`/showcases/velocity/runtime`](/showcases/velocity/runtime).

## Deadline propagation

**Problem.** Nested operations each consume their own full timeout window, so total latency
is the sum of independently-chosen numbers and nobody can state a bound for the request.

This is arithmetic, not a slow dependency. Every layer picks a timeout that looks reasonable
on its own, and no single number in the code is wrong — which is why the ninety-second worst
case is impossible to find by reading it.

```text
request budget ──▶ remaining ──▶ operation ──▶ remaining ──▶ next operation
```

**The clamp is the whole pattern.** `child(maxMs)` grants the *smaller* of what was asked and
what the parent has left, so a child can never outlive its parent no matter what it requests.
That one line is also what makes retry-plus-timeout composable instead of multiplicative: a
retry drawing from the same budget cannot extend the request.

`reserveMs` holds time back for work that happens *after* the child — writing the response, a
compensating delete — so a leaf is never left with a completed dependency call and no budget
to use the result.

**It is not cancellation.** `run()` stops *waiting* at the deadline; an operation that ignores
its `AbortSignal` runs to completion behind the rejection. Its promise gets a `.catch`
**before** the race, because once the race rejects nothing is listening, and an unhandled
rejection can take the serverless process down (SvelteKit #9785) — the same rule
`after-response.ts` follows.

**Every leaf needs a minimum useful budget.** Without one, "the budget ran out" is a boundary
condition rather than a decision: the last call starts with a fraction of a millisecond and is
abandoned before it can return.

**Where v10r uses this.** `event.locals.deadline` is stamped by the `requestDeadline` handler,
second in the chain — a budget that starts partway down bounds a subset of the request.
`jobs/bot-ranges-refresh.ts` is the first real leaf: ten feeds at 10–30s each had no bound on
their sum, so a slow morning did not produce a timeout but a **kill** — the platform ended the
function at `maxDuration`, the sources fetched so far were already committed, and the rest
appeared nowhere. One 50s budget turns that into the outcome the job already knew how to
report. The External Service Lab's actions are the second: each call to the separately deployed
service runs under `locals.deadline.child(8 s, reserve 0.5 s)`, with retries inside the same
budget (`docs/blueprint/architecture/external-service.md`).

**Not yet adopted:** the AI chat orchestrator, where three providers × `AbortSignal.timeout(30_000)`
per attempt is the largest unbounded sum in the codebase. Stamping the budget is cheap;
nothing is bounded until a leaf takes a child and honours it, and this file names the leaves
that have rather than implying coverage.

**Invariants.**

- Every timeout value is bounded.
- A child operation may not exceed its parent's deadline.
- A retry consumes the same budget as the attempt it replaces.
- Fallback behaviour is defined per leaf, not inherited.
- A deadline bounds the wait, not the work.

**Implementation.** `src/lib/server/http/deadline.ts`, tests in `deadline.test.ts`. Measured at
[`/showcases/velocity/runtime`](/showcases/velocity/runtime).

## Compute and data locality

**Problem.** Latency-sensitive compute sits far from the system it talks to most, and nobody
wrote down where anything actually runs.

> Put latency-sensitive compute close to the system it communicates with most.

**"Edge" does not mean fast.** A function near the user but far from the database is slower
than regional compute sitting next to it, because the request pays the distance once per
**round trip** rather than once per request — and a single page render makes several.

**Design.** A locality map that is *derived*, not typed. `perf/locality.ts` reads the regions
out of the environment; `bun run perf:locality` prints them. A hand-written region table is a
claim that was true once, and its failure mode is silent: nothing breaks when a database moves,
it just gets slower, which is the one class of change no test catches.

```text
compute (functions)     —              Vercel          runtime only — declared in svelte.config.js, confirmed in situ
relational database     eu-central-1   Neon            env:NEON_DATABASE_URL_PROD (host only)
cache and rate limiter  —              Upstash Redis   env:UPSTASH_REDIS_REST_URL (newer databases omit the prefix)
graph database          —              Neo4j Aura      configured, region not derivable
object storage          —              Cloudflare R2   configured, R2 has no region
```

**`region: null` is an answer, not a failure.** Several providers put the region in nothing the
application can see. Saying so beats guessing, because "we do not know where this runs" is
precisely the finding worth acting on.

**Nothing here prints a credential.** Only the region token is extracted from a connection
string; the string itself never leaves the module, and `locality.test.ts` asserts that the
rendered map contains neither the password nor the host it was derived from.

### The cross-region calls a request makes

This half is hand-maintained, because nothing in the environment can derive it — and it is the
half that decides whether a region is worth moving.

| | Hop | Note |
|---|---|---|
| blocking | function → Neon | Session lookup on every authenticated request, plus whatever the route loads |
| blocking | function → Upstash | Rate limit check before auth, and every shared cache read |
| blocking | function → Google / OpenAI / Anthropic | One embedding and one generation per chatbot turn — the longest hop, and the one a deadline bounds |
| blocking | function → Neo4j Aura | Graph tier only, and only when a graph-sourced chunk survived fusion |
| blocking | function → Render Frankfurt (`runtime-lab`) | `/showcases/external-service` actions only, under a sub-deadline of the request's budget; same metro as `fra1`, tens of ms per call, ~1 min when the free host is asleep (`external-service.md`) |
| async | browser → R2 | Assets fetched directly by the browser, never through a function |

**The question this map raised, answered.** The database is in `eu-central-1`; until
2026-09-13 the function region was a Vercel project setting that appeared nowhere in this
repository, and measured (`x-vercel-id: fra1::iad1::…`) it was the default `iad1` — every
blocking hop above crossed an ocean, twice per page. The region is now declared in
`svelte.config.js` (adapter `regions: ['fra1']`; route-level `config` exports merge over it), so
the repository says where the code runs and only the deployment can contradict it. The probe
still reads `VERCEL_REGION` in situ rather than asserting the declaration. A deployment's API
object can still read `regions: ["iad1"]` — that field is the project's default region, while
each built function carries its own `regions: ["fra1"]` in `.vc-config.json` (checked
2026-10-23); the function's region, not the deployment's field, is where code runs. Setting the
project's Function Region to `fra1` in the dashboard makes the two agree.

**Invariants.**

- Deployment locality is explicit rather than accidental.
- Critical paths avoid unnecessary cross-region hops.
- Region configuration is inspectable and testable — derived from the environment, never from a
  table someone remembered to update.
- A locality probe reports regions and never credentials.

**Implementation.** `src/lib/server/perf/locality.ts`, `locality.test.ts`,
`scripts/perf/locality.ts` (`bun run perf:locality`).
