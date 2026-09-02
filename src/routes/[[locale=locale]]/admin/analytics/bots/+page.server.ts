import { parseAnalyticsRange } from '$lib/server/admin';
import { flushBotHits } from '$lib/server/analytics';
import {
	getAgentSurfaceHits,
	getBotFamilies,
	getBotMisses,
	getBotRangeStatus,
} from '$lib/server/db/analytics/bot-queries';
import { safeDeferPromise } from '$lib/server/http/defer';
import { requireAdmin } from '$lib/server/http/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const { range, days } = parseAnalyticsRange(url);

	// Hits buffer in Redis and reach Postgres once a day; a human looking at this page
	// is the other moment worth a write. Best-effort — a Redis hiccup must not 500 the
	// dashboard, it just shows the last flushed state.
	await flushBotHits().catch((err) => console.error('[analytics] bot-hit flush on view failed:', err));

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
