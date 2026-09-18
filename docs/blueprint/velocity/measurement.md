# Velocity Measurement

A performance claim is worth exactly as much as the measurement behind it. This is the part
of Velocity that makes the rest arguable with evidence rather than intuition.

Live surfaces: `/showcases/observability`, `/admin/perf`

## Latency tracing

**Problem.** A slow response is a single number. Nobody can act on it until it decomposes.

A response should be explainable:

```text
request                   620ms

middleware                 14ms
authentication             11ms
domain                      8ms
Redis                       6ms
PostgreSQL                163ms
Neo4j                     121ms
external API               92ms
SSR                        31ms
unattributed              174ms
```

**Architecture.** A v10r-owned API with an adapter beneath it, so domain code never couples
to a telemetry vendor:

```text
$lib/server/http/request-timing.ts    ← what domain code records into
        ↓
Server-Timing header  (today)   |   an OpenTelemetry exporter  (if ever needed)
```

`event.locals.timing` is stamped by the `requestTiming` handler, which sits **first** in
`sequence()` — a handler can only measure what it wraps, and the chain itself is worth
measuring: the gap between `total` and the spans downstream layers recorded *is* the
middleware cost. `securityHeaders` stays second and still stamps `locals.clientIp` before any
limiter or auth handler reads it, so the invariant its position exists to hold is untouched.
`handle-chain.gate.test.ts` asserts both facts.

**Two properties are load-bearing.**

*Cheap.* A span is one `performance.now()` pair and one array push. `MAX_SPANS` (64) caps the
array so instrumenting inside a loop degrades to silence rather than to unbounded memory.
Instrumentation that costs what it measures is a lie.

*Truthful about what it does not know.* `unattributed` is the wall-clock time no span claimed.
It is a **floor, not a figure**: concurrent spans overlap, so their durations can sum past the
wall clock, and the value clamps at zero rather than going negative. A zero means "spans
covered it", never "nothing was missed".

**Disclosure.** `Server-Timing` is readable by any client, so the span breakdown maps internal
architecture and hands out a timing oracle. Full detail goes only to admins and
debug-paired devices; everyone else gets `total`, which they could measure anyway. Durations
round to 0.1 ms — finer resolution is noise at this scale and a sharper clock is a sharper
side channel.

**Coverage, stated rather than implied.** Prerendered routes never reach the handler on
Vercel: they are served as static files by the CDN. Tracing covers dynamic responses.

**Invariants.**

- Instrumentation does not materially damage performance.
- Traces preserve application boundaries — a span is named for the layer, not the call.
- Sensitive data never enters telemetry; span names are sanitized to `Server-Timing` tokens,
  which also stops a raw name injecting a delimiter and corrupting the header.
- Performance data distinguishes real-user, lab and development contexts (below).

**Implementation.** `src/lib/server/http/request-timing.ts`, `src/hooks.server.ts`,
tests in `request-timing.test.ts` and `handle-chain.gate.test.ts`.

## Field, lab and development — never merged

Two measurement contexts, and scoring one against the other's budget is the specific mistake
`budgets.json` splits `kind: "lab"` from `kind: "field"` to prevent.

| Context | Source | Answers |
|---|---|---|
| **Field** | real-user telemetry (`analytics.events`, `event_type = 'timing'`) | how fast is it for real visitors, right now |
| **Lab** | a production build, committed as `src/lib/server/perf/snapshot.json` | what did this commit do to the bundle |

Field data cannot catch a bundle regression: weight does not appear in RUM until it has
already shipped. Lab data cannot tell you the site is slow for users in Australia. `ttfb_ms`
(600 ms, warm local preview) and `field_ttfb_ms` (1800 ms, p75 across the public internet
plus a cold start plus TLS) are separate budgets for the same reason.

The third context is development, and it is the one that lies quietly. Dev samples come from
localhost — no network, no TLS, no cold start — so they pull every percentile **down**. Over
30 days, 72% of samples were dev rows and TTFB p75 read 1051 ms against an honest 1431 ms.
Contamination made the site look *faster*, so nothing about the number invited suspicion.
`TelemetryOrigin` (`db/analytics/telemetry-origin.ts`) is the discriminator and Velocity
introduces no second one.

Full detail: [`../../stack/quality/performance.md`](../../stack/quality/performance.md).

## Performance budget and ratchet

**Problem.** Performance erodes a kilobyte at a time, and a gate wired to an aspiration gets
muted the afternoon it is added.

Two thresholds, two jobs, and keeping them distinct is the whole pattern.

**Targets** (`budgets` in `budgets.json`) are where we want to be. Scored on `/admin/perf`,
never build-failing. Several are red today and saying so is the point — the heaviest route is
~609 KB gzipped against a 250 KB target.

**Ratchets** (`ceilings`) are the measured value at the moment it was accepted. Asserted by
`snapshot.gate.test.ts`. Moved **down** to bank an improvement; **up** only as an explicit,
reviewed decision once feature work has used the headroom — never to absorb a dependency.

A gate wired to the target would have failed on the commit that introduced the number and
been disabled the same day. Ratchets stop the number growing while the target stays visible
as the thing still to fix.

Ceilings carry ~3% headroom over the measurement on purpose: set exactly at the measured
value, adding one showcase page tripped the gate, and a gate that fails on ordinary work is a
gate that gets muted. The headroom absorbs a feature; it does not absorb a heavy dependency,
which is what it is for.

**Bundle weight suits a gate unusually well** — invisible in review (a one-line import can add
100 KB), deterministic (same source, same number), and only catchable before shipping.

**Regenerating the snapshot must use a production build.** A dev-mode build compiles both
halves differently and inflates client JS ~9%; the snapshot records its `NODE_ENV` and the
gate refuses to score anything that does not say `production`. `compose.yaml` sets
`NODE_ENV=development`, so the `-e` override is required locally.

```bash
podman exec -e NODE_ENV=production -e GIT_SHA=$(git rev-parse --short HEAD) v10r bun run perf:snapshot
```

`GIT_SHA` is required, not decorative: the container has no git, and the script refuses to
write a snapshot it cannot attribute to a revision. `vr` passes it on every container run
(`-dirty` when the tree differs from HEAD).

**Invariants.**

- Targets and regression gates stay distinct.
- Ratchets move down, not up, except through explicit architectural review.
- Development measurements are never mixed with production or lab measurements.
- A ratchet is set only on a metric stable enough to be deterministic — which is why cold-start
  time is reported and not gated.

**Implementation.** `src/lib/server/perf/budgets.json`, `budgets.ts`, `snapshot.ts`,
`snapshot.gate.test.ts`; probes in `scripts/perf/`.

## Performance scenario harness

**Problem.** A system is not proven fast because localhost is fast. Every number the
observatory reports was taken with a warm cache, an answering dependency and nothing else
running — which is exactly the condition under which the interesting questions cannot be
asked.

**Design.** One scenario makes one condition adverse, drives the **real** mechanism against a
simulated dependency, and reports two kinds of column:

- **Deterministic** — origin calls and an outcome string. Same input, same value, every run,
  on any machine. `scenarios.gate.test.ts` asserts these against the committed results, so a
  behaviour change arrives as a reviewed diff.
- **Reported** — latency. It moves with the host, so gating it would gate the machine's mood.
  It is committed anyway because the *shape* is the finding.

The committed run:

```text
scenario                        origin  outcome
cold-cache                           1  origin-miss
warm-cache                           0  local-hit
expiry-burst                         1  coalesced-50-to-1
slow-dependency                      1  deadline-exceeded          400ms dependency, 60ms wait
failing-dependency                   3  open-after-3-of-12
concurrent-load                      8  admitted-8-refused-12
retry-after-transient-failure        3  succeeded-on-attempt-3
refusal-not-retried                  1  attempted-1-of-5
shed-under-pressure                  0  critical:admitted deferred:budget background:load
```

Three of those rows are the only proof their pattern has. `refusal-not-retried` is the retry
policy's most consequential decision — a refusal does not become a success by being asked
again, and retrying one is how a busy system becomes an overloaded one. `shed-under-pressure`
is load shedding's only measurement anywhere: it has no showcase panel because its two arms
do not produce a comparison a stopwatch can make honestly, and a scenario row is what an
honest measurement of it actually looks like.

**The harness runs with no Redis, on purpose.** A lab measurement that depends on whether the
developer happens to have Upstash credentials in their shell is two different measurements
sharing a name — and the in-process path is worth exercising anyway, since it is what a
preview deployment runs.

**Why it runs inside vitest.** The scenarios drive the real cache and resilience modules, and
those reach `$env/dynamic/private`, a specifier that only exists inside Vite. Bare Bun cannot
resolve it, so `scripts/perf/scenarios.ts` spawns the gate in write mode rather than importing
the harness the way `scripts/perf/snapshot.ts` can. The alternative — a harness restricted to
the modules that happen to avoid `$env` — would measure a convenient subset of the system and
present it as the system.

```bash
podman exec v10r bun run perf:scenarios     # re-record src/lib/server/perf/scenarios.json
```

**What is not covered, stated rather than implied.** Cold compute needs a real deployment,
slow network needs a real network, large dataset needs a real corpus, and optimistic-mutation
failure needs a browser. Those rows of the design's grid are empty and this file does not
colour them in.

**Invariants.**

- Scenario results distinguish lab from field, exactly as `budgets.json` already does.
- A scenario that cannot be measured reproducibly is reported, not gated — the same stance
  that keeps cold-start time off the ratchet list.
- The recorded numbers and the asserted numbers come from one code path, not two.

**Implementation.** `src/lib/server/perf/scenarios.ts`, `scenarios.json`,
`scenarios.gate.test.ts`, `scripts/perf/scenarios.ts`.

## Reading the showcase's numbers honestly

`/showcases/velocity` executes both arms of each comparison on the request that asked for it.
What is simulated is the *dependency*: `simulatedOrigin` sleeps instead of querying Postgres,
because a public page must not be able to load the database (Neon's free tier is 100 CU-h for
the whole project, and a showcase has taken it down before), a fixed cost makes the arms
comparable, and a real query's variance would drown the effect.

`originCalls` is usually the more honest of the two figures. Concurrency can make a hundred
rebuilds finish in about the wall-clock time of one while still costing a hundred round trips
upstream; the count is what the dependency actually felt.

**Implementation.** `src/lib/server/showcases/velocity/measurements.ts`.
