/**
 * Compute and data locality — where each system actually runs, derived rather than typed.
 *
 * "Edge" does not mean fast. A function near the user but far from the database is slower
 * than regional compute sitting next to it, because the request pays the distance once per
 * ROUND TRIP rather than once per request — and the hops below show that a single page
 * render makes several.
 *
 * v10r's regions were recorded nowhere, which is the gap this closes. They are read from
 * the environment instead of written into a table on purpose: a hand-typed region list is
 * a claim that was true once, and the failure mode is silent — nothing breaks when the
 * database moves, it just gets slower, which is the one class of change no test catches.
 *
 * NOTHING HERE PRINTS A CREDENTIAL. Only the region token is extracted from a connection
 * string; the string itself never leaves this module. That constraint is why the parsers
 * are narrow regexes rather than a URL parse that keeps the whole object around.
 *
 * `region: null` is the honest answer, not a failure. Several providers do not put the
 * region in anything the application can see (Neo4j Aura's host is opaque, R2 has no
 * region at all, Vercel's function region is a project setting outside the repo). Saying
 * so is more useful than a guess, because "we don't know where this runs" is exactly the
 * finding worth acting on.
 */

export interface LocalityRow {
	/** The system, as the architecture names it. */
	system: string;
	provider: string;
	/** The provider's region token, or null when nothing observable carries it. */
	region: string | null;
	/** Where the value came from, so a reader can go and check it. */
	source: string;
}

/** Neon puts the region between the endpoint id and the cloud: `ep-x-123.eu-central-1.aws.neon.tech`. */
export function neonRegion(connectionString: string | undefined): string | null {
	if (!connectionString) return null;
	return /\.([a-z]{2,4}-[a-z]+-\d)\.(?:aws|azure|gcp)\.neon\.tech/.exec(connectionString)?.[1] ?? null;
}

/**
 * Upstash encoded the region as a host prefix (`eu2-`, `us1-`) on older databases and
 * stopped on newer ones, so a missing prefix means "not derivable", never "no region".
 */
export function upstashRegion(restUrl: string | undefined): string | null {
	if (!restUrl) return null;
	return /^https:\/\/((?:[a-z]{2,3})\d)-/.exec(restUrl)?.[1] ?? null;
}

/**
 * The locality map for one environment.
 *
 * Takes the env rather than reading `process.env` so it is testable without a deployment
 * and cannot pick up a credential from somewhere the caller did not intend.
 */
export function describeLocality(env: Record<string, string | undefined>): LocalityRow[] {
	return [
		{
			system: 'compute (functions)',
			provider: 'Vercel',
			region: env.VERCEL_REGION ?? null,
			// Absent locally by design: this only exists inside a running function, and the
			// configured default lives in the Vercel project, not in this repo.
			source: env.VERCEL_REGION ? 'env:VERCEL_REGION' : 'runtime only — project setting, not in the repo',
		},
		{
			system: 'relational database',
			provider: 'Neon',
			region: neonRegion(env.NEON_DATABASE_URL_PROD),
			source: 'env:NEON_DATABASE_URL_PROD (host only)',
		},
		{
			system: 'cache and rate limiter',
			provider: 'Upstash Redis',
			region: upstashRegion(env.UPSTASH_REDIS_REST_URL),
			source: 'env:UPSTASH_REDIS_REST_URL (host prefix; newer databases omit it)',
		},
		{
			system: 'graph database',
			provider: 'Neo4j Aura',
			region: null,
			source: env.NEO4J_URI ? 'configured, region not derivable — Aura hostnames are opaque' : 'not configured',
		},
		{
			system: 'object storage',
			provider: 'Cloudflare R2',
			region: null,
			source: env.R2_ACCOUNT_ID
				? 'configured, R2 has no region — a location hint, set at bucket creation'
				: 'not configured',
		},
	];
}

export interface CriticalHop {
	/** What triggers the hop. */
	from: string;
	to: string;
	/** Whether the user is waiting for it. */
	blocking: boolean;
	note: string;
}

/**
 * The cross-region calls a request actually makes, read off the architecture.
 *
 * This half IS hand-maintained, because nothing in the environment can derive it — and it
 * is the half that decides whether a region is worth moving. Two blocking hops per page
 * render is the number that matters, not the region names.
 */
export const CRITICAL_PATH_HOPS: CriticalHop[] = [
	{
		from: 'function',
		to: 'Neon',
		blocking: true,
		note: 'Session lookup on every authenticated request, plus whatever the route loads.',
	},
	{
		from: 'function',
		to: 'Upstash',
		blocking: true,
		note: 'Rate limit check before auth, and every shared cache read.',
	},
	{
		from: 'function',
		to: 'Google / OpenAI / Anthropic',
		blocking: true,
		note: 'One embedding and one generation per chatbot turn — the longest hop, and the one a deadline bounds.',
	},
	{
		from: 'function',
		to: 'Neo4j Aura',
		blocking: true,
		note: 'Graph tier only, and only when a graph-sourced chunk survived fusion.',
	},
	{
		from: 'browser',
		to: 'R2',
		blocking: false,
		note: 'Blog and desk assets, fetched directly by the browser — never through a function.',
	},
];
