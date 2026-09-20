/**
 * Telemetry origin discrimination — which build produced a real-user sample.
 *
 * The dev server writes into this same production analytics database. That was
 * fixed at the source (`$lib/analytics/telemetry.ts` and `journey-beacon.ts` are
 * both `dev`-gated now), but two things make a read-side filter permanent rather
 * than temporary:
 *
 *   1. Rows already written stay in the retention window and keep skewing every
 *      aggregate over them.
 *   2. A read-side filter that reports how many rows it excluded is the only
 *      thing that notices if the source-side gate ever regresses. A silent fix
 *      is a fix you find out about the second time.
 *
 * The skew is not symmetric noise, which is what makes it dangerous. Dev samples
 * come from localhost with no network, no TLS and no cold start, so they pull
 * every latency percentile DOWN — the contaminated dataset reported TTFB p75 at
 * 1051 ms against an honest prod-origin 1431 ms. Contamination made the site look
 * FASTER than it is, so nothing about the numbers invited suspicion.
 *
 * ## The discriminator
 *
 * `web-vitals/attribution` records the CSS selector of the element it blamed, and
 * Svelte's scope-class format differs between builds:
 *
 *   dev   `nav.flex-1.overflow-y-auto.p-2.s-Xv7_7mcdkQaC.scrollbar-nav`
 *   prod  `nav.flex-1.overflow-y-auto.p-2.scrollbar-nav.svelte-1e55qdy`
 *
 * So the build leaves a fingerprint in ordinary telemetry, with no extra column
 * and no backfill. Verified against 30 days of live rows: 216 dev samples across
 * 15 sessions, 76 prod samples across 12.
 *
 * Some targets carry no scope class at all (`html.dark>body`, or an element
 * styled purely with utility classes). Those are genuinely unclassifiable, which
 * is why `unknown` is a real origin and not an error — and why it is excluded from
 * prod-origin aggregates rather than assumed to be prod.
 */

/**
 * Dev-build scope class. Written to be valid in BOTH POSIX (for Postgres `~`) and
 * JavaScript regex: the SQL filter in `perf-queries.ts` is the one consumer, and the
 * test suite proves the pattern's boundary semantics by compiling it as a JS regex.
 *
 * The leading `(^|[.# >])` is load-bearing: without a boundary this also matches
 * the `s-` inside no prefix at all, and more importantly it must NOT match the
 * production `svelte-` prefix. It cannot, because the character after `s` is
 * required to be `-`, and in `svelte-` it is `v`.
 *
 * Dev hashes are 12 characters and may contain `-` and `_` (`s-H2r2CV7e-etH`,
 * `s-Xv7_7mcdkQaC`), hence the permissive class and the `{10,}` floor.
 */
export const DEV_SCOPE_PATTERN = '(^|[.# >])s-[A-Za-z0-9_-]{10,}';

/** Production-build scope prefix. Plain substring — no regex needed. */
export const PROD_SCOPE_MARKER = 'svelte-';

export type TelemetryOrigin = 'prod' | 'dev' | 'unknown';
