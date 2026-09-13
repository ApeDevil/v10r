/**
 * loadProjectMap — the corpus map is cut to the prompt budget, and the map body's own
 * ordering (intro + stack line first) survives that cut on a production-sized map.
 */
import { describe, expect, it, vi } from 'vitest';
import { buildOverviewBody, type OverviewDocFile } from '$lib/server/docs/overview-body';
import { PROJECT_MAP_MAX_CHARS } from '../config';

const getCorpusMap = vi.fn();
vi.mock('$lib/server/db/retrieval/queries', () => ({
	getCorpusMap: (...args: unknown[]) => getCorpusMap(...args),
}));

const { loadProjectMap } = await import('./project-map');

const mapRow = (body: string) => ({ id: 'map_docs', title: 'Map', body, builtAt: new Date() });

describe('loadProjectMap', () => {
	it('returns null when the corpus has no map', async () => {
		getCorpusMap.mockResolvedValueOnce(null);
		expect(await loadProjectMap()).toBeNull();
	});

	it('returns the body whole when under budget', async () => {
		getCorpusMap.mockResolvedValueOnce(mapRow('short body'));
		const map = await loadProjectMap();
		expect(map?.body).toBe('short body');
		expect(map?.truncatedAt).toBeNull();
	});

	it('cuts at the budget with an ellipsis and records where', async () => {
		getCorpusMap.mockResolvedValueOnce(mapRow('a'.repeat(PROJECT_MAP_MAX_CHARS + 500)));
		const map = await loadProjectMap();
		expect(map?.body.length).toBe(PROJECT_MAP_MAX_CHARS + 1); // sliced chars + ellipsis
		expect(map?.body.endsWith('…')).toBe(true);
		expect(map?.truncatedAt).toBe(PROJECT_MAP_MAX_CHARS);
	});

	it('does not cut at exactly the budget', async () => {
		getCorpusMap.mockResolvedValueOnce(mapRow('a'.repeat(PROJECT_MAP_MAX_CHARS)));
		const map = await loadProjectMap();
		expect(map?.body.endsWith('…')).toBe(false);
		expect(map?.truncatedAt).toBeNull();
	});

	// End-to-end with the real map body: an over-budget map (huge blueprint TOC) must still
	// expose the stack summary after the cut — the grounding fix for "which stack does v10r use?".
	it('preserves the Stack line through the cut of a production-sized map', async () => {
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
		expect(body.length).toBeGreaterThan(PROJECT_MAP_MAX_CHARS); // genuinely over budget → the cut engages

		getCorpusMap.mockResolvedValueOnce(mapRow(body));
		const map = await loadProjectMap();
		expect(map?.body.endsWith('…')).toBe(true);
		expect(map?.body).toContain('**Stack:** Bun · Drizzle · SvelteKit');
	});
});
