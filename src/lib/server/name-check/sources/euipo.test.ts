import { describe, expect, it } from 'vitest';
import { startDeadline } from '$lib/server/http/deadline';
import { type NameSourceContext, NO_CREDENTIALS } from '../name-source';
import { toNameCheckQuery } from '../query';
import { euipoQueries, euipoSource, resetEuipoTokens, toEuipoDrafts } from './euipo';

describe('euipoQueries', () => {
	it('sends a contained-term query and a prefix query', () => {
		expect(euipoQueries('velora', 'velora')).toEqual([
			'wordMarkSpecification.verbalElement==*velora*',
			'wordMarkSpecification.verbalElement==velor*',
		]);
	});

	it('keeps a short name to one query and strips RSQL syntax from the term', () => {
		expect(euipoQueries('nix', 'nix')).toEqual(['wordMarkSpecification.verbalElement==*nix*']);
		expect(euipoQueries('a==b;c', 'abc')).toEqual(['wordMarkSpecification.verbalElement==*abc*']);
	});

	it('quotes a multi-word term, which RSQL otherwise rejects', () => {
		expect(euipoQueries('zalando lounge', 'zalandolounge')).toEqual([
			'wordMarkSpecification.verbalElement=="*zalando lounge*"',
			'wordMarkSpecification.verbalElement==zalandoloung*',
		]);
		expect(euipoQueries('a "b" c', 'abc')).toEqual(['wordMarkSpecification.verbalElement=="*a b c*"']);
	});
});

describe('toEuipoDrafts', () => {
	it('maps the documented fields and treats unknown statuses as live', () => {
		const drafts = toEuipoDrafts({
			trademarks: [
				{
					applicationNumber: '018000001',
					wordMarkSpecification: { verbalElement: 'VELORA' },
					status: 'REGISTERED',
					applicants: [{ name: 'Velora AG' }],
					niceClasses: [9, '42', 99],
				},
				{ applicationNumber: '2', markName: 'VELORA HOME', status: 'EXPIRED' },
				{ applicationNumber: '3', name: 'VELORA SYSTEMS', status: 'SOMETHING_NEW' },
				{ applicationNumber: '4' },
			],
		});

		expect(drafts.map((d) => [d.label, d.status, d.active, d.niceClasses, d.owner])).toEqual([
			['VELORA', 'REGISTERED', true, [9, 42], 'Velora AG'],
			['VELORA HOME', 'EXPIRED', false, [], null],
			['VELORA SYSTEMS', 'SOMETHING_NEW', true, [], null],
		]);
		expect(drafts[0]?.url).toContain('018000001');
		expect(drafts.every((d) => d.jurisdiction === 'EM')).toBe(true);
	});

	it('accepts the other wrapper keys the gateway may use, and a bare array', () => {
		expect(toEuipoDrafts({ content: [{ verbalElement: 'A' }] })).toHaveLength(1);
		expect(toEuipoDrafts([{ verbalElement: 'B' }])).toHaveLength(1);
		expect(toEuipoDrafts(null)).toEqual([]);
	});
});

describe('euipoSource.search', () => {
	const credentials = {
		...NO_CREDENTIALS,
		euipo: {
			clientId: 'client',
			clientSecret: 'secret',
			apiBase: 'https://api.example.test/trademark-search',
			tokenUrl: 'https://auth.example.test/token',
		},
	};
	const query = toNameCheckQuery({ query: 'velociraptor', territory: 'eu', category: null });

	function context(fetch: typeof globalThis.fetch): NameSourceContext {
		const deadline = startDeadline(2_000);
		return {
			deadline,
			signal: deadline.signal(),
			credentials,
			fetch,
			now: () => new Date(),
			resolveNs: async () => [],
		};
	}

	function answering(byUrl: (url: string) => Response): typeof globalThis.fetch {
		return async (input) => byUrl(String(input));
	}

	it('names the token endpoint when it refuses the client', async () => {
		resetEuipoTokens();
		const fetch = answering(() => new Response('{}', { status: 401 }));
		await expect(euipoSource.search?.(query, context(fetch))).rejects.toMatchObject({
			kind: 'unavailable',
			message: 'token endpoint: HTTP 401',
		});
	});

	it('names the trademark search when the gateway refuses an issued token', async () => {
		resetEuipoTokens();
		const fetch = answering((url) =>
			url.startsWith('https://auth.example.test')
				? Response.json({ access_token: 't', expires_in: 3600 })
				: new Response('{}', { status: 403 }),
		);
		await expect(euipoSource.search?.(query, context(fetch))).rejects.toMatchObject({
			message: 'trademark search: HTTP 403',
		});
	});
});
