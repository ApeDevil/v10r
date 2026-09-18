import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NameMatchKind, NameSourceId } from '$lib/name-check/report';
import { clearLocalCache } from '$lib/server/cache';
import { startDeadline } from '$lib/server/http/deadline';
import { resetBreakers } from '$lib/server/resilience';
import { checkName } from './check';
import { NameSourceError } from './errors';
import type { NameMatchDraft, NameSource, NameSourceContext } from './name-source';
import type { NameCheckQuery } from './query';
import { resetLocalQuota } from './quota';

vi.mock('$lib/server/cache/client', () => ({ redis: null }));
vi.mock('$lib/server/platform/after-response', () => ({ deferAfterResponse: vi.fn() }));

afterEach(() => {
	clearLocalCache();
	resetBreakers();
	resetLocalQuota();
	vi.restoreAllMocks();
});

type Search = (query: NameCheckQuery, ctx: NameSourceContext) => Promise<NameMatchDraft[]>;

function source(id: NameSourceId, kind: NameMatchKind, search?: Search, extra: Partial<NameSource> = {}): NameSource {
	return {
		id,
		kind,
		territories: ['de', 'eu', 'worldwide'],
		manualUrl: () => `https://registry.example/${id}`,
		...(search ? { search } : {}),
		...extra,
	};
}

function trademarkDraft(label: string, niceClasses: number[] = [9]): NameMatchDraft {
	return {
		sourceId: 'euipo',
		kind: 'trademark',
		label,
		aliases: [],
		jurisdiction: 'EM',
		externalId: label,
		url: null,
		status: 'REGISTERED',
		active: true,
		owner: null,
		niceClasses,
	};
}

function domainDraft(domain: string, registration: 'registered' | 'not_registered'): NameMatchDraft {
	return {
		sourceId: 'rdap',
		kind: 'domain',
		label: domain,
		aliases: [domain.split('.')[0] ?? domain],
		jurisdiction: null,
		externalId: domain,
		url: null,
		domain,
		registration,
		registrar: null,
		registeredAt: null,
	};
}

const query = { query: 'Velora', territory: 'de' as const, category: 'software' as const };
const fakeFetch: typeof fetch = () => Promise.reject(new Error('no network in tests'));
const options = () => ({ deadline: startDeadline(2_000), fetch: fakeFetch, resolveNs: async () => [] });

describe('checkName', () => {
	it('runs every source in scope and reports each one, manual ones included', async () => {
		const report = await checkName(query, {
			...options(),
			sources: [
				source('euipo', 'trademark', async () => [trademarkDraft('VELORA')]),
				source('dpma', 'trademark'),
				source('rdap', 'domain', async () => [domainDraft('velora.com', 'registered')]),
			],
		});

		expect(report.coverage.map((c) => [c.sourceId, c.status, c.matchCount])).toEqual([
			['euipo', 'complete', 1],
			['dpma', 'manual_only', 0],
			['rdap', 'complete', 1],
		]);
		expect(report.coverage.every((c) => c.manualUrl.startsWith('https://registry.example/'))).toBe(true);
		expect(report.query).toEqual({ raw: 'Velora', normalized: 'velora', territory: 'de', category: 'software' });
		expect(report.signal.level).toBe('strong');
	});

	it('turns a failing source into a coverage row instead of failing the check', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const report = await checkName(query, {
			...options(),
			sources: [
				source('gleif', 'company', async () => {
					throw new Error('boom');
				}),
				source('euipo', 'trademark', async () => [trademarkDraft('VELORA')]),
			],
		});
		expect(report.coverage.map((c) => c.status)).toEqual(['unavailable', 'complete']);
		expect(report.matches).toHaveLength(1);
	});

	it('maps each source error kind to its own coverage status', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const report = await checkName(query, {
			...options(),
			sources: [
				source('web', 'web', async () => {
					throw new NameSourceError('quota_exhausted', 'spent');
				}),
				source('gleif', 'company', async () => {
					throw new NameSourceError('rate_limited', 'slow down', 60);
				}),
				source('euipo', 'trademark', async () => [], { configured: () => false }),
			],
		});
		expect(report.coverage.map((c) => c.status)).toEqual(['quota_exhausted', 'unavailable', 'credentials_missing']);
	});

	it('times a slow source out inside the fan-out budget', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const report = await checkName(query, {
			deadline: startDeadline(150),
			fetch: fakeFetch,
			resolveNs: async () => [],
			sources: [
				source(
					'gleif',
					'company',
					(_query, ctx) =>
						new Promise((_, reject) => {
							ctx.signal.addEventListener('abort', () => reject(ctx.signal.reason));
						}),
				),
				source('euipo', 'trademark', async () => [trademarkDraft('VELORA')]),
			],
		});
		expect(report.coverage.map((c) => c.status)).toEqual(['timed_out', 'complete']);
	});

	it('serves the second identical check from cache, keeping the upstream retrievedAt', async () => {
		const search = vi.fn(async () => [trademarkDraft('VELORA')]);
		const clock = { now: new Date('2026-09-16T10:00:00Z') };
		const run = () =>
			checkName(query, { ...options(), now: () => clock.now, sources: [source('euipo', 'trademark', search)] });

		const first = await run();
		clock.now = new Date('2026-09-16T11:00:00Z');
		const second = await run();

		expect(search).toHaveBeenCalledTimes(1);
		expect(first.coverage[0]?.cached).toBe(false);
		expect(second.coverage[0]?.cached).toBe(true);
		expect(second.coverage[0]?.retrievedAt).toBe('2026-09-16T10:00:00.000Z');
		expect(second.matches[0]?.retrievedAt).toBe('2026-09-16T10:00:00.000Z');
		expect(second.generatedAt).toBe('2026-09-16T11:00:00.000Z');
	});

	it('does not cache a failure', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let calls = 0;
		const search = async () => {
			calls++;
			if (calls === 1) throw new Error('first attempt fails');
			return [trademarkDraft('VELORA')];
		};
		const sources = [source('euipo', 'trademark', search)];
		expect((await checkName(query, { ...options(), sources })).coverage[0]?.status).toBe('unavailable');
		expect((await checkName(query, { ...options(), sources })).coverage[0]?.status).toBe('complete');
	});

	it('keeps only matches above the floor, but every domain row', async () => {
		const report = await checkName(query, {
			...options(),
			sources: [
				source('euipo', 'trademark', async () => [trademarkDraft('VELORA'), trademarkDraft('ZANZIBAR')]),
				source('rdap', 'domain', async () => [domainDraft('velora.com', 'not_registered')]),
			],
		});
		expect(report.matches.map((m) => m.label)).toEqual(['VELORA', 'velora.com']);
		expect(report.matches[0]?.similarity).toEqual({ score: 100, basis: 'exact' });
		expect(report.coverage[0]?.matchCount).toBe(1);
	});

	it('consults only the sources that cover the territory', async () => {
		const search = vi.fn(async () => []);
		const report = await checkName(
			{ ...query, territory: 'eu' },
			{ ...options(), sources: [source('dpma', 'trademark', search, { territories: ['de'] })] },
		);
		expect(search).not.toHaveBeenCalled();
		expect(report.coverage).toEqual([]);
		expect(report.signal).toEqual({ level: 'none', reasons: [], manualReviewRecommended: false });
	});

	it('fires onSourceSettled once per source in scope', async () => {
		const settled: string[] = [];
		await checkName(query, {
			...options(),
			sources: [source('euipo', 'trademark', async () => []), source('dpma', 'trademark')],
			onSourceSettled: (outcome) => settled.push(outcome.coverage.sourceId),
		});
		expect(settled.sort()).toEqual(['dpma', 'euipo']);
	});

	it('never writes the submitted name to the log', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		await checkName(query, {
			...options(),
			sources: [
				source('gleif', 'company', async () => {
					throw new Error('GET https://api.example/search?q=Velora failed');
				}),
			],
		});
		expect(error).toHaveBeenCalled();
		const logged = error.mock.calls.map((call) => call.join(' ')).join('\n');
		expect(logged).not.toContain('Velora');
		expect(logged).toContain('gleif');
	});
});
