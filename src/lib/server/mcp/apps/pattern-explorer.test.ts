import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { publicPatternRegistry } from '../patterns/tools';
import { PATTERN_EXPLORER_VIEW, patternRegistryWithExplorer } from './pattern-explorer';

/**
 * Read from disk as well as through the import: under Vitest an `?raw` import is the real file,
 * but reading it directly keeps this test about the committed artifact a host would receive.
 */
const documentOnDisk = readFileSync(join(process.cwd(), 'src/lib/server/mcp/apps/pattern-explorer.view.html'), 'utf8');

/**
 * URL-shaped strings the official bridge carries as inert data: JSON Schema dialect identifiers
 * (`$schema` values the SDK's validator compares against), the bare scheme prefixes and the IPv6
 * host template its URL handling builds, a placeholder inside a schema description, and an
 * attribution string. None is fetched — there is no fetch in the document, and the CSP refuses
 * every origin — but each one is listed so a new URL in the bundle is a decision.
 */
const INERT_URL_LITERALS = new Set([
	'http://',
	'https://',
	// The bridge's literal template source (the IPv6 host form), escaped so it stays text here.
	`http://[\${e}]`,
	'https://*.example.com',
	'http://json-schema.org/draft-04/schema#',
	'http://json-schema.org/draft-07/schema#',
	'http://json-schema.org/draft-04/schema',
	'http://json-schema.org/draft-06/schema',
	'http://json-schema.org/draft-07/schema',
	'http://json-schema.org/draft/2019-09/schema',
	'http://json-schema.org/draft/2020-12/schema',
	'https://json-schema.org/draft-06/schema',
	'https://json-schema.org/draft-07/schema',
	'https://json-schema.org/draft/2019-09/schema',
	'https://json-schema.org/draft/2020-12/schema',
	'https://github.com/cfworker',
]);

describe('the pattern explorer View document', () => {
	it('is the committed artifact the server serves', () => {
		expect(PATTERN_EXPLORER_VIEW.html === documentOnDisk).toBe(true);
	});

	it('is one self-contained document: no external script, style, image, frame or base', () => {
		// Assertions on the matches, never on the 300 KB document: a failure prints what it found.
		const found = (pattern: RegExp) => documentOnDisk.match(pattern) ?? [];
		expect(found(/<script\b/g)).toHaveLength(1);
		expect(found(/<script[^>]*\bsrc=/gi)).toEqual([]);
		expect(found(/<link\b/gi)).toEqual([]);
		expect(found(/<(img|iframe|frame|object|embed|base|form)\b/gi)).toEqual([]);
		expect(found(/@import|url\(\s*['"]?(https?:)?\/\//g)).toEqual([]);
	});

	it('holds no network or storage API call', () => {
		for (const api of [
			// Calls and constructors, not words: the SDK's schema descriptions mention "fetch/XHR/WebSocket".
			/\bfetch\(/,
			/new XMLHttpRequest/,
			/new WebSocket/,
			/new EventSource/,
			/sendBeacon/,
			/\blocalStorage\b/,
			/\bsessionStorage\b/,
			/\bindexedDB\b/,
			/\bimport\(/,
		]) {
			expect(documentOnDisk.match(api)?.[0] ?? null, String(api)).toBeNull();
		}
	});

	it('names no URL beyond the listed inert literals', () => {
		const urls = new Set(documentOnDisk.match(/(?:https?|wss?):\/\/[^\s"'`)<>\\]*/g) ?? []);
		expect([...urls].filter((url) => !INERT_URL_LITERALS.has(url))).toEqual([]);
	});

	it('refuses every origin in its own CSP, independent of the host', () => {
		const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(documentOnDisk)?.[1] ?? '';
		expect(csp).toContain("default-src 'none'");
		expect(csp).toContain("connect-src 'none'");
		expect(csp).toContain("frame-src 'none'");
		expect(csp).toContain("base-uri 'none'");
		expect(csp).not.toMatch(/https?:|\*/);
	});

	it('inlines the v10r tokens it uses, light and dark', () => {
		expect(/:root\{[^}]*--color-primary:oklch/.test(documentOnDisk)).toBe(true);
		expect(/:root\[data-theme="dark"\]\{[^}]*--color-primary:oklch/.test(documentOnDisk)).toBe(true);
	});
});

describe('the View resource metadata', () => {
	it('declares no domain and no device permission', () => {
		expect(PATTERN_EXPLORER_VIEW.uri).toMatch(/^ui:\/\//);
		expect(PATTERN_EXPLORER_VIEW.ui.csp).toEqual({
			connectDomains: [],
			resourceDomains: [],
			frameDomains: [],
			baseUriDomains: [],
		});
		expect(PATTERN_EXPLORER_VIEW.ui.permissions).toEqual({});
		expect(PATTERN_EXPLORER_VIEW.ui).not.toHaveProperty('domain');
	});
});

describe('patternRegistryWithExplorer', () => {
	const registry = patternRegistryWithExplorer('https://v10r.example');

	it('adds exactly one tool and its View to the untouched Pattern tools', () => {
		expect(registry.tools.slice(0, -1)).toEqual(publicPatternRegistry.tools);
		expect(registry.tools.at(-1)?.name).toBe('explore_patterns');
		expect(registry.views?.map((view) => view.tool)).toEqual(['explore_patterns']);
	});

	it('dispatches the Pattern tools unchanged', async () => {
		expect(await registry.dispatch('get_pattern', { id: 'multi-client-core' })).toEqual(
			await publicPatternRegistry.dispatch('get_pattern', { id: 'multi-client-core' }),
		);
	});

	it('carries a diag on an explorer failure, never structured content', async () => {
		const result = await registry.dispatch('explore_patterns', { id: 'no-such-pattern' });
		expect(result).toMatchObject({ isError: true, diag: 'not_found' });
		expect(result).not.toHaveProperty('structuredContent');
	});
});
