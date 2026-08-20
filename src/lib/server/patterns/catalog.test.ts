import { describe, expect, it } from 'vitest';
import type { Registry } from '../mcp/patterns/data';
import { buildCatalog } from './catalog';

const pattern = (id: string, category: string, tier: 'deep' | 'light' = 'light') => ({
	id,
	tier,
	title: `Title of ${id}`,
	category,
	summary: `What ${id} does.`,
	when_to_use: '',
	capabilities: [],
	keywords: [],
	depends_on: [],
	docs: [],
	code: [],
	tests: [],
	showcases: [],
	invariants: tier === 'deep' ? ['x'] : [],
	emulation_notes: tier === 'deep' ? ['y'] : [],
	risk: 'low',
	maturity: 'implemented',
});

const fixture = {
	version: '0.0.0',
	groups: [
		{ id: 'g-one', title: 'Group One' },
		{ id: 'g-two', title: 'Group Two' },
		{ id: 'g-idle', title: 'Idle Group' },
	],
	categories: [
		{ id: 'alpha', title: 'Alpha', group: 'g-one' },
		{ id: 'beta', title: 'Beta', group: 'g-two' },
		{ id: 'empty-cat', title: 'Empty', group: 'g-two' },
	],
	patterns: [pattern('alpha-deep', 'alpha', 'deep'), pattern('alpha-light', 'alpha'), pattern('beta-solo', 'beta')],
} as unknown as Registry;

describe('buildCatalog', () => {
	const catalog = buildCatalog(fixture);

	it('preserves registry order: groups, categories within a group, patterns within a category', () => {
		expect(catalog.groups.map((g) => g.title)).toEqual(['Group One', 'Group Two']);
		expect(catalog.groups[0]?.categories[0]?.patterns.map((p) => p.id)).toEqual(['alpha-deep', 'alpha-light']);
	});

	it('omits empty categories and groups with no populated category', () => {
		expect(catalog.groups[1]?.categories.map((c) => c.title)).toEqual(['Beta']);
		expect(catalog.groups.some((g) => g.title === 'Idle Group')).toBe(false);
	});

	it('links every pattern to its section page and carries tier + maturity + purpose', () => {
		const row = catalog.groups[0]?.categories[0]?.patterns[0];
		expect(row).toEqual({
			id: 'alpha-deep',
			title: 'Title of alpha-deep',
			tier: 'deep',
			maturity: 'implemented',
			summary: 'What alpha-deep does.',
			href: '/docs/pattern-library/alpha-deep',
		});
	});

	it('counts totals, deep records, and populated categories', () => {
		expect(catalog.counts).toEqual({ total: 3, deep: 1, categories: 2 });
	});
});

describe('buildCatalog over the live registry', () => {
	it('covers every registry pattern exactly once', () => {
		const live = buildCatalog();
		const ids = live.groups.flatMap((g) => g.categories.flatMap((c) => c.patterns.map((p) => p.id)));
		expect(ids.length).toBe(live.counts.total);
		expect(new Set(ids).size).toBe(ids.length);
		expect(live.counts.total).toBeGreaterThan(100);
	});
});
