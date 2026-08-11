import { parseAnalyticsRange } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/auth/guards';
import {
	getAgentSurfaceHits,
	getBotFamilies,
	getBotMisses,
	getBotRangeStatus,
} from '$lib/server/db/analytics/bot-queries';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const { range, days } = parseAnalyticsRange(url);

	// Eager: the two panels that answer the page's reason for existing — who is
	// crawling, and is the verification data itself current. Everything else
	// streams, because a slow miss-table must not hold up the headline.
	const [families, rangeStatus] = await Promise.all([getBotFamilies(days), getBotRangeStatus()]);

	return {
		title: 'Bots & AI Crawlers',
		range,
		families,
		rangeStatus,
		agentSurfaces: safeDeferPromise(getAgentSurfaceHits(days), []),
		misses: safeDeferPromise(getBotMisses(days), []),
	};
};
