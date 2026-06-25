/**
 * Unit tests for loadOverview — truncation at the token budget.
 * OVERVIEW_MAX_TOKENS=500; CHARS_PER_TOKEN=4 → 2000-char ceiling.
 */
import { describe, expect, it, vi } from 'vitest';
import { buildOverviewBody, type OverviewDocFile } from '../docs/overview-body';
import { OVERVIEW_MAX_TOKENS } from './config';

const getOverview = vi.fn();
vi.mock('./queries', () => ({
	getOverview: (...args: unknown[]) => getOverview(...args),
}));

const { loadOverview } = await import('./overview');

const MAX_CHARS = OVERVIEW_MAX_TOKENS * 4;

function fakePage(body: string) {
	return {
		slug: 'overview',
		title: 'Overview',
		tldr: 'tldr',
		body,
		tags: [],
		coverage: { sourceCount: 0, stale: false },
		pointers: [],
		compiledAt: new Date().toISOString(),
		compiledByModel: 'seed',
	};
}

describe('loadOverview', () => {
	it('returns null when no overview exists', async () => {
		getOverview.mockResolvedValueOnce(null);
		const result = await loadOverview(['u1'], null);
		expect(result).toBeNull();
	});

	it('returns the body unchanged when under budget', async () => {
		const body = 'short body';
		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview(['u1'], null);
		expect(result?.body).toBe(body);
	});

	it('truncates at MAX_CHARS with an ellipsis when over budget', async () => {
		const body = 'a'.repeat(MAX_CHARS + 500);
		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview(['u1'], null);
		expect(result?.body.length).toBe(MAX_CHARS + 1); // sliced chars + ellipsis
		expect(result?.body.endsWith('…')).toBe(true);
	});

	it('does not truncate at exactly the budget boundary', async () => {
		const body = 'a'.repeat(MAX_CHARS);
		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview(['u1'], null);
		expect(result?.body.endsWith('…')).toBe(false);
		expect(result?.body.length).toBe(MAX_CHARS);
	});

	// End-to-end with the real overview body: an over-budget map (huge blueprint TOC) must
	// still expose the stack summary after truncation — this is the grounding fix for
	// "which stack does v10r use?".
	it('preserves the Stack line through truncation of a production-sized overview body', async () => {
		const files: OverviewDocFile[] = [
			...Array.from({ length: 60 }, (_, i) => ({
				sourcePath: `docs/blueprint/area/topic-${i}.md`,
				docsPath: `/docs/blueprint/area/topic-${i}`,
				title: `Blueprint topic number ${i} with a deliberately long padding title to fill space`,
			})),
			{ sourcePath: 'docs/stack/core/bun.md', docsPath: '/docs/stack/bun', title: 'Bun' },
			{ sourcePath: 'docs/stack/core/sveltekit.md', docsPath: '/docs/stack/sveltekit', title: 'SvelteKit' },
			{ sourcePath: 'docs/stack/data/drizzle.md', docsPath: '/docs/stack/drizzle', title: 'Drizzle' },
		];
		const body = buildOverviewBody(files);
		expect(body.length).toBeGreaterThan(MAX_CHARS); // genuinely over budget → truncation engages

		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview(['u1'], null);

		expect(result?.body.endsWith('…')).toBe(true); // confirm it WAS truncated
		expect(result?.body).toContain('**Stack:** Bun · Drizzle · SvelteKit');
	});
});
