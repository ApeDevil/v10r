import { describe, expect, it } from 'vitest';
import { normalizeCatalogPath, verifyCatalogCitations } from './catalog-citations';

describe('normalizeCatalogPath', () => {
	it('strips anchors, locale prefixes, and trailing slashes', () => {
		expect(normalizeCatalogPath('/de/showcases/forms#basics')).toBe('/showcases/forms');
		expect(normalizeCatalogPath('/ru/docs/stack/svelte/')).toBe('/docs/stack/svelte');
		expect(normalizeCatalogPath('/showcases/forms')).toBe('/showcases/forms');
	});

	it('does not strip a path that merely starts with the locale letters', () => {
		expect(normalizeCatalogPath('/design/tokens')).toBe('/design/tokens');
	});
});

describe('verifyCatalogCitations', () => {
	const surfaced = new Set(['/showcases/forms', '/docs/stack/svelte']);
	const known = new Set(['/showcases/forms', '/docs/stack/svelte', '/showcases/auth']);

	it('marks a tool-surfaced path as exists', () => {
		const { verdicts } = verifyCatalogCitations('See /showcases/forms for the demo.', surfaced, known);
		expect(verdicts).toContainEqual({ path: '/showcases/forms', status: 'exists' });
	});

	it('marks a real-but-unsurfaced path as drifted', () => {
		const { verdicts } = verifyCatalogCitations('Try /showcases/auth instead.', surfaced, known);
		expect(verdicts).toContainEqual({ path: '/showcases/auth', status: 'drifted' });
	});

	it('marks an invented path as none', () => {
		const { verdicts, summary } = verifyCatalogCitations('Go to /showcases/teleporter.', surfaced, known);
		expect(verdicts).toContainEqual({ path: '/showcases/teleporter', status: 'none' });
		expect(summary.none).toBe(1);
	});

	it('normalizes locale prefix + anchor before comparing', () => {
		const { verdicts } = verifyCatalogCitations('Open /de/showcases/forms#basics', surfaced, known);
		expect(verdicts[0]).toEqual({ path: '/showcases/forms', status: 'exists' });
	});

	it('dedupes repeated paths', () => {
		const { summary } = verifyCatalogCitations('/showcases/forms and /showcases/forms again', surfaced, known);
		expect(summary.total).toBe(1);
		expect(summary.exists).toBe(1);
	});

	it('returns an empty result when the answer has no routes', () => {
		const { verdicts, summary } = verifyCatalogCitations('No links here, just prose.', surfaced, known);
		expect(verdicts).toEqual([]);
		expect(summary.total).toBe(0);
	});
});
