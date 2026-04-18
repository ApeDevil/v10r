/**
 * Unit tests for loadOverview — truncation at the token budget.
 * OVERVIEW_MAX_TOKENS=500; CHARS_PER_TOKEN=4 → 2000-char ceiling.
 */
import { describe, expect, it, vi } from 'vitest';
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
		const result = await loadOverview('u1', null);
		expect(result).toBeNull();
	});

	it('returns the body unchanged when under budget', async () => {
		const body = 'short body';
		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview('u1', null);
		expect(result?.body).toBe(body);
	});

	it('truncates at MAX_CHARS with an ellipsis when over budget', async () => {
		const body = 'a'.repeat(MAX_CHARS + 500);
		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview('u1', null);
		expect(result?.body.length).toBe(MAX_CHARS + 1); // sliced chars + ellipsis
		expect(result?.body.endsWith('…')).toBe(true);
	});

	it('does not truncate at exactly the budget boundary', async () => {
		const body = 'a'.repeat(MAX_CHARS);
		getOverview.mockResolvedValueOnce(fakePage(body));
		const result = await loadOverview('u1', null);
		expect(result?.body.endsWith('…')).toBe(false);
		expect(result?.body.length).toBe(MAX_CHARS);
	});
});
