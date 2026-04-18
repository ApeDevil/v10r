/**
 * Dev-only end-to-end probe for the llmwiki read path.
 *
 * Hits the REAL modules (`searchLlmwiki`, `fetchPagesByIds`, `hydratePointers`,
 * `computeCoverage`, `verifyCitations`) against whatever is in the DB. Useful
 * for exercising the full stack without going through auth or the LLM.
 *
 * 404s in production.
 */
import { json } from '@sveltejs/kit';
import { loadOverview } from '$lib/server/llmwiki/overview';
import { fetchPagesByIds } from '$lib/server/llmwiki/queries';
import { searchLlmwiki } from '$lib/server/llmwiki/search';
import { verifyCitations } from '$lib/server/llmwiki/verify';
import { formatLlmwikiContext } from '$lib/server/llmwiki/wiki-format';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	if (!import.meta.env.DEV) {
		return json({ error: 'not_found' }, { status: 404 });
	}
	const userId = url.searchParams.get('userId');
	const query = url.searchParams.get('q') ?? 'how does reciprocal rank fusion work?';
	const drillChunkIds = url.searchParams.get('drill')?.split(',').filter(Boolean) ?? [];
	if (!userId) return json({ error: 'missing userId query param' }, { status: 400 });

	const start = performance.now();
	const [overview, hits] = await Promise.all([
		loadOverview(userId, null),
		searchLlmwiki(query, { userId, collectionId: null, limit: 4 }),
	]);

	const contextBlock = formatLlmwikiContext(overview, hits);

	let pageLookup: Awaited<ReturnType<typeof fetchPagesByIds>> | null = null;
	if (hits[0]?.slug) {
		pageLookup = await fetchPagesByIds([hits[0].slug], userId, { includeBody: true });
	}

	let verification: Awaited<ReturnType<typeof verifyCitations>> | null = null;
	if (drillChunkIds.length > 0) {
		verification = await verifyCitations({
			userId,
			drilledChunkIds: drillChunkIds,
			answerText: 'placeholder answer text',
		});
	}

	return json({
		elapsedMs: Math.round(performance.now() - start),
		query,
		overview: overview
			? {
					slug: overview.slug,
					title: overview.title,
					bodyPreview: overview.body.slice(0, 120),
				}
			: null,
		hits: hits.map((h) => ({
			slug: h.slug,
			title: h.title,
			tldr: h.tldr,
			coverage: h.coverage,
			pointerCount: h.pointers.length,
			pointers: h.pointers,
		})),
		pageLookupBySlug: pageLookup
			? {
					keyCount: pageLookup.size,
					firstKey: pageLookup.keys().next().value,
					firstBodyLen: pageLookup.values().next().value?.body.length ?? 0,
				}
			: null,
		verification: verification
			? {
					entries: Array.from(verification.verifications.entries()),
					driftedChunkIds: verification.driftedChunkIds,
				}
			: null,
		systemPromptBlock: contextBlock,
	});
};
