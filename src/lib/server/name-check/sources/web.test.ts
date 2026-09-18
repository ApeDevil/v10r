import { describe, expect, it } from 'vitest';
import { NO_CREDENTIALS } from '../name-source';
import { toWebDrafts, webSearchVendor } from './web';

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
