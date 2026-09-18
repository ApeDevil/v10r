/**
 * The name check: every source in scope, concurrently, each inside its own budget,
 * breaker, bulkhead, daily quota and cache — and none of them able to fail the check.
 *
 * A source that cannot answer becomes a coverage row (`timed_out`, `quota_exhausted`,
 * `credentials_missing`, `unavailable`) beside its manual link; the sources that did
 * answer are scored, deduplicated and summarised as usual. The report says exactly which
 * databases were searched, which is what makes "no obvious conflicts found" an honest
 * sentence rather than a hopeful one.
 *
 * Only successes are cached: a cached failure would replay an outage for a day. The
 * cache key hashes the normalised name so Redis never holds a prospective brand in
 * plaintext, and the envelope keeps the upstream `retrievedAt` so a cached row can say
 * how old it is.
 *
 * `onSourceSettled` fires as each source finishes so a streaming route can forward
 * partial results; this module does not stream itself.
 */
import { createHash } from 'node:crypto';
import type {
	LiveNameSourceId,
	NameCheckCoverage,
	NameCheckReport,
	NameCoverageStatus,
	NameMatch,
} from '$lib/name-check/report';
import type { NameCheckQueryOutput } from '$lib/schemas/name-check';
import { definePolicy, readThrough } from '$lib/server/cache';
import { type Deadline, DeadlineExceededError } from '$lib/server/http/deadline';
import { type Bulkhead, defineBreaker, defineBulkhead, ResilienceError } from '$lib/server/resilience';
import {
	BREAKER,
	BULKHEAD,
	DAILY_QUOTA,
	DOMAIN_TTL_SECONDS,
	MAX_MATCHES_PER_SOURCE,
	RDAP_BULKHEAD,
	RESULT_TTL_SECONDS,
	SIMILARITY_FLOOR,
	SOURCE_CEILING_MS,
} from './config';
import { dedupeMatches } from './dedupe';
import { NameSourceError } from './errors';
import {
	type NameMatchDraft,
	type NameSource,
	type NameSourceContext,
	type NameSourceCredentials,
	NO_CREDENTIALS,
} from './name-source';
import { categoryRelevance } from './nice-classes';
import { type NameCheckQuery, toNameCheckQuery } from './query';
import { takeDailyQuota } from './quota';
import { territoryRelevance } from './relevance';
import { conflictSignal } from './signal';
import { bestSimilarity } from './similarity';
import { NAME_SOURCES } from './sources';
import { resolveNsViaSystem } from './sources/rdap';

const RESULT_POLICY = definePolicy({ namespace: 'name-check', ttl: RESULT_TTL_SECONDS, scope: 'shared' });
const DOMAIN_POLICY = definePolicy({ namespace: 'name-check-domains', ttl: DOMAIN_TTL_SECONDS, scope: 'shared' });

const breaker = defineBreaker({ name: 'name-check', ...BREAKER });
const bulkheads = new Map<string, Bulkhead>();

function bulkheadFor(source: NameSource): Bulkhead {
	let bulkhead = bulkheads.get(source.id);
	if (!bulkhead) {
		bulkhead = defineBulkhead({
			name: `name-check:${source.id}`,
			...(source.kind === 'domain' ? RDAP_BULKHEAD : BULKHEAD),
		});
		bulkheads.set(source.id, bulkhead);
	}
	return bulkhead;
}

/** What one source fetched, as the cache stores it. */
interface SourceEnvelope {
	retrievedAt: string;
	matches: NameMatchDraft[];
}

export interface NameSourceOutcome {
	coverage: NameCheckCoverage;
	matches: NameMatch[];
}

export interface CheckNameOptions {
	/** The fan-out's budget; each source gets a child of it. */
	deadline: Deadline;
	credentials?: NameSourceCredentials;
	/** Test seam. Defaults to every registered source. */
	sources?: readonly NameSource[];
	fetch?: typeof fetch;
	now?: () => Date;
	resolveNs?: (host: string) => Promise<string[]>;
	/** Called once per source in scope, in completion order. */
	onSourceSettled?: (outcome: NameSourceOutcome) => void;
}

function coverageStatusFor(err: unknown): NameCoverageStatus {
	if (err instanceof NameSourceError) {
		switch (err.kind) {
			case 'quota_exhausted':
				return 'quota_exhausted';
			case 'credentials_missing':
				return 'credentials_missing';
			default:
				return 'unavailable';
		}
	}
	if (err instanceof DeadlineExceededError) return 'timed_out';
	if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) return 'timed_out';
	return 'unavailable';
}

function enrich(draft: NameMatchDraft, query: NameCheckQuery, retrievedAt: string): NameMatch {
	const similarity = bestSimilarity(query.normalized, [draft.label, ...draft.aliases]);
	const relevance = territoryRelevance(draft.jurisdiction, query.territory);
	switch (draft.kind) {
		case 'trademark':
			return {
				...draft,
				similarity,
				territoryRelevance: relevance,
				retrievedAt,
				categoryRelevance: categoryRelevance(draft.niceClasses, query.category),
			};
		case 'company':
			return { ...draft, similarity, territoryRelevance: relevance, retrievedAt };
		case 'domain':
			return { ...draft, similarity, territoryRelevance: relevance, retrievedAt };
		case 'web':
			return { ...draft, similarity, territoryRelevance: relevance, retrievedAt };
	}
}

/** Domain rows are a table of variants and stay whatever their status; the rest must clear the floor. */
function shown(match: NameMatch): boolean {
	return match.kind === 'domain' || match.similarity.score >= SIMILARITY_FLOOR;
}

function byScore(a: NameMatch, b: NameMatch): number {
	return b.similarity.score - a.similarity.score || a.label.localeCompare(b.label);
}

function finish(envelope: SourceEnvelope, query: NameCheckQuery): NameMatch[] {
	const enriched = envelope.matches.map((draft) => enrich(draft, query, envelope.retrievedAt)).filter(shown);
	return dedupeMatches(enriched).sort(byScore).slice(0, MAX_MATCHES_PER_SOURCE);
}

function cacheId(source: NameSource, query: NameCheckQuery): string {
	const digest = createHash('sha256').update(query.normalized.compact).digest('hex');
	return `${source.id}:${query.territory}:${digest}`;
}

async function runSource(
	source: NameSource,
	query: NameCheckQuery,
	deadline: Deadline,
	base: Omit<NameSourceContext, 'deadline' | 'signal'>,
): Promise<NameSourceOutcome> {
	const row = (status: NameCoverageStatus, extra: Partial<NameCheckCoverage> = {}): NameCheckCoverage => ({
		sourceId: source.id,
		kind: source.kind,
		status,
		manualUrl: source.manualUrl(query),
		retrievedAt: null,
		cached: false,
		matchCount: 0,
		...extra,
	});

	const search = source.search;
	if (!search) return { coverage: row('manual_only'), matches: [] };
	if (source.configured && !source.configured(base.credentials)) {
		return { coverage: row('credentials_missing'), matches: [] };
	}

	try {
		const policy = source.kind === 'domain' ? DOMAIN_POLICY : RESULT_POLICY;
		const read = await readThrough<SourceEnvelope>(policy, { id: cacheId(source, query) }, async () => {
			if (await breaker.isOpen(source.id)) {
				throw new ResilienceError('breaker_open', `${source.id} is cooling down`);
			}
			const limit = DAILY_QUOTA[source.id as LiveNameSourceId];
			if (limit !== undefined && !(await takeDailyQuota(source.id, limit, base.now()))) {
				throw new NameSourceError('quota_exhausted', `${source.id} spent its daily quota`);
			}
			return bulkheadFor(source).run(() => {
				const child = deadline.child(SOURCE_CEILING_MS);
				return child.run(async (signal) => ({
					retrievedAt: base.now().toISOString(),
					matches: await search(query, { ...base, deadline: child, signal }),
				}));
			});
		});

		await breaker.recordSuccess(source.id);
		const matches = finish(read.value, query);
		return {
			coverage: row('complete', {
				retrievedAt: read.value.retrievedAt,
				cached: read.tier !== 'origin',
				matchCount: matches.length,
			}),
			matches,
		};
	} catch (err) {
		const status = coverageStatusFor(err);
		if (err instanceof NameSourceError && err.kind === 'rate_limited') {
			await breaker.trip(source.id, err.retryAfterSeconds);
		} else if (!(err instanceof ResilienceError) && (status === 'unavailable' || status === 'timed_out')) {
			await breaker.recordFailure(source.id);
		}
		// The error's name, never its message: messages can carry the URL, and the URL
		// carries the name.
		console.error(`[name-check] ${source.id} → ${status} (${err instanceof Error ? err.name : typeof err})`);
		return { coverage: row(status), matches: [] };
	}
}

export async function checkName(input: NameCheckQueryOutput, options: CheckNameOptions): Promise<NameCheckReport> {
	const query = toNameCheckQuery(input);
	const now = options.now ?? (() => new Date());
	const base: Omit<NameSourceContext, 'deadline' | 'signal'> = {
		credentials: options.credentials ?? NO_CREDENTIALS,
		fetch: options.fetch ?? fetch,
		now,
		resolveNs: options.resolveNs ?? resolveNsViaSystem,
	};
	const inScope = (options.sources ?? NAME_SOURCES).filter((source) => source.territories.includes(query.territory));

	const outcomes = await Promise.all(
		inScope.map(async (source) => {
			const outcome = await runSource(source, query, options.deadline, base);
			options.onSourceSettled?.(outcome);
			return outcome;
		}),
	);

	const matches = dedupeMatches(outcomes.flatMap((outcome) => outcome.matches)).sort(byScore);
	const coverage = outcomes.map((outcome) => outcome.coverage);

	return {
		query: {
			raw: query.raw,
			normalized: query.normalized.compact,
			territory: query.territory,
			category: query.category,
		},
		signal: conflictSignal(matches, coverage),
		matches,
		coverage,
		generatedAt: now().toISOString(),
	};
}
