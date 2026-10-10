import { describe, expect, it } from 'vitest';
import { startDeadline } from '$lib/server/http/deadline';
import { type NameSourceContext, type NameSourceCredentials, NO_CREDENTIALS } from '../name-source';
import { toNameCheckQuery } from '../query';
import { toWebDrafts, webSearchVendor, webSource } from './web';

/** A fetch that records the JSON body it was given and answers with no hits. */
function capturing(): { fetch: typeof fetch; bodies: Record<string, unknown>[] } {
	const bodies: Record<string, unknown>[] = [];
	const fetchImpl: typeof fetch = async (_url, init) => {
		bodies.push(JSON.parse(String(init?.body)));
		return new Response(JSON.stringify({ results: [] }), { headers: { 'content-type': 'application/json' } });
	};
	return { fetch: fetchImpl, bodies };
}

function context(fetchImpl: typeof fetch): NameSourceContext {
	const deadline = startDeadline(2_000);
	return {
		deadline,
		signal: deadline.signal(),
		credentials: { ...NO_CREDENTIALS, tavilyApiKey: 't' },
		fetch: fetchImpl,
		now: () => new Date(),
		resolveNs: async () => [],
	};
}

describe('webSearchVendor', () => {
	it('prefers Tavily, falls back to Brave, and is null without either', () => {
		expect(webSearchVendor(NO_CREDENTIALS)).toBeNull();
		expect(webSearchVendor({ ...NO_CREDENTIALS, braveApiKey: 'b' })).toBe('brave');
		expect(webSearchVendor({ ...NO_CREDENTIALS, braveApiKey: 'b', tavilyApiKey: 't' })).toBe('tavily');
	});
});

describe('toWebDrafts', () => {
	it('keys a hit by its host and offers the registrable label as an alias', () => {
		const drafts = toWebDrafts([
			{ title: 'Velora — Home', url: 'https://www.velora.io/', snippet: 'Velora builds…' },
			{ title: 'Docs', url: 'https://docs.velora.io/start', snippet: null },
			{ title: '', url: 'https://empty.example', snippet: null },
			{ title: 'Broken', url: 'not a url', snippet: null },
		]);
		expect(drafts.map((d) => [d.host, d.aliases, d.label])).toEqual([
			['velora.io', ['velora'], 'Velora — Home'],
			['docs.velora.io', ['velora'], 'Docs'],
		]);
		expect(drafts[0]?.externalId).toBe('velora.io');
	});
});

describe('searchTavily', () => {
	it('asks for the exact phrase and boosts Germany only for the German territory', async () => {
		const de = capturing();
		await webSource.search?.(toNameCheckQuery({ query: 'Velora', territory: 'de', category: null }), context(de.fetch));
		expect(de.bodies[0]).toMatchObject({ query: '"Velora"', exact_match: true, country: 'germany' });

		const eu = capturing();
		await webSource.search?.(toNameCheckQuery({ query: 'Velora', territory: 'eu', category: null }), context(eu.fetch));
		expect(eu.bodies[0]).toMatchObject({ query: '"Velora"', exact_match: true });
		expect(eu.bodies[0]).not.toHaveProperty('country');
	});
});

describe('webSource.searchInputs', () => {
	const TAVILY = { ...NO_CREDENTIALS, tavilyApiKey: 'tvly-secret' };
	const BRAVE = { ...NO_CREDENTIALS, braveApiKey: 'brave-secret' };
	const inputs = (name: string, territory: 'de' | 'eu', credentials: NameSourceCredentials = TAVILY) =>
		webSource.searchInputs(toNameCheckQuery({ query: name, territory, category: null }), credentials);

	it('follows the exact phrase, not the compact form', () => {
		expect(inputs('Velo Raptor', 'eu')).not.toEqual(inputs('VeloRaptor', 'eu'));
	});

	it('follows the vendor, and the territory only where the vendor is told it', () => {
		expect(inputs('Velora', 'eu', TAVILY)).not.toEqual(inputs('Velora', 'eu', BRAVE));
		expect(inputs('Velora', 'de', TAVILY)).not.toEqual(inputs('Velora', 'eu', TAVILY));
		expect(inputs('Velora', 'de', BRAVE)).toEqual(inputs('Velora', 'eu', BRAVE));
	});

	it('never carries an API key', () => {
		expect(inputs('Velora', 'de', TAVILY).join(' ')).not.toContain('tvly-secret');
		expect(inputs('Velora', 'de', BRAVE).join(' ')).not.toContain('brave-secret');
	});
});
