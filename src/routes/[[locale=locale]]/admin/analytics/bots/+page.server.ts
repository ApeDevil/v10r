import { requireAdmin } from '$lib/server/auth/guards';
import {
	getAgentSurfaceHits,
	getBotCategories,
	getBotFamilies,
	getBotMisses,
	getBotRangeStatus,
	getBotTrend,
} from '$lib/server/db/analytics/bot-queries';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

const VALID_RANGES = ['7', '30', '90'] as const;
type Range = (typeof VALID_RANGES)[number];

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const rangeParam = url.searchParams.get('range') ?? '30';
	const range: Range = (VALID_RANGES as readonly string[]).includes(rangeParam) ? (rangeParam as Range) : '30';
	const days = Number(range);

	// Eager: the two panels that answer the page's reason for existing — who is
	// crawling, and is the verification data itself current. Everything else
	// streams, because a slow miss-table must not hold up the headline.
	const [families, rangeStatus] = await Promise.all([getBotFamilies(days), getBotRangeStatus()]);

	return {
		title: 'Bots & AI Crawlers',
		range,
		families,
		rangeStatus,
		categories: safeDeferPromise(getBotCategories(days), []),
		agentSurfaces: safeDeferPromise(getAgentSurfaceHits(days), []),
		misses: safeDeferPromise(getBotMisses(days), []),
		trend: safeDeferPromise(getBotTrend(days), []),
	};
};
