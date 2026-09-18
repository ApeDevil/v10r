/**
 * Name-check policy: what one anonymous check may cost, and how long an answer is
 * the truth. Every number that bounds spend or freshness lives here, not at a call site.
 */
import type { LiveNameSourceId } from '$lib/name-check/report';

export const RATE_LIMIT_PREFIX = 'rl:name-check';
/** Checks per IP per window. One check fans out to every live source, so this is the upstream budget too. */
export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW = '60 s' as const;

/** Whole fan-out, carved from the request's 10 s hook budget with room left to render. */
export const FAN_OUT_BUDGET_MS = 8_000;
/** One source may not hold the fan-out longer than this; a slow one becomes `timed_out`, not a slow page. */
export const SOURCE_CEILING_MS = 6_000;
/** Held back for scoring, grouping and the response itself. */
export const RESPONSE_RESERVE_MS = 700;
/** One RDAP or DNS lookup inside the domain source's own fan-out. */
export const RDAP_LOOKUP_MS = 4_000;

/** Registry answers change slowly; a day is fresh enough for pre-screening. */
export const RESULT_TTL_SECONDS = 24 * 60 * 60;
/** Domain registration flips faster than trademarks do. */
export const DOMAIN_TTL_SECONDS = 60 * 60;
export const RDAP_BOOTSTRAP_TTL_SECONDS = 24 * 60 * 60;

/** Domain variants generated from the compact name. `.ch` sits with `.de` and `.eu`: the German-speaking market. */
export const DOMAIN_TLDS = ['com', 'de', 'eu', 'ch', 'net', 'org', 'io', 'app', 'dev', 'ai'] as const;

/**
 * Sent on every upstream call. Keyless registries tier or refuse anonymous clients
 * (crates.io 403s, Wikimedia throttles, IANA and GLEIF ask); the string names this page
 * so an operator on the other side can find us — and never carries the name being checked.
 */
export const SOURCE_USER_AGENT = 'v10r-name-check/1 (+https://www.v10r.dev/showcases/name-check)';

/**
 * Upstream calls per source per UTC day, across the whole deployment.
 *
 * Sized to the free tiers the sources are used on: Tavily's 1,000 credits a month is
 * the tight one, and GLEIF asks for 60 requests a minute. When a counter is spent the
 * source reports `quota_exhausted` with its manual link — the page stays honest and the
 * vendor bill stays at zero.
 */
export const DAILY_QUOTA: Record<LiveNameSourceId, number> = {
	euipo: 300,
	gleif: 1_000,
	rdap: 2_000,
	web: 30,
};

/** Matches below this name-similarity score are discovery noise and are not shown. */
export const SIMILARITY_FLOOR = 60;
/** Cap per source after scoring, so one broad registry cannot bury the others. */
export const MAX_MATCHES_PER_SOURCE = 25;
/** The JSON body of a check: a name, a territory and a category. */
export const MAX_BODY_BYTES = 8 * 1024;

/** Three failures in two minutes opens a source for five — the fan-out keeps its budget for the others. */
export const BREAKER = { failureThreshold: 3, failureWindowSeconds: 120, openForSeconds: 300 } as const;
export const BULKHEAD = { maxConcurrent: 4, maxQueued: 4 } as const;
/** The domain source runs ten lookups of its own. */
export const RDAP_BULKHEAD = { maxConcurrent: 8, maxQueued: 8 } as const;

/**
 * The admin's connection test: one real search against the vendor with the credentials
 * on the form. Its own budget (nothing else is running) and its own per-admin window, so
 * a test button cannot spend Tavily's monthly credits on retries.
 */
export const SOURCE_TEST_BUDGET_MS = 8_000;
export const SOURCE_TEST_RATE_LIMIT_PREFIX = 'rl:name-check:source-test';
export const SOURCE_TEST_RATE_LIMIT_MAX = 6;
export const SOURCE_TEST_RATE_LIMIT_WINDOW = '60 s' as const;
