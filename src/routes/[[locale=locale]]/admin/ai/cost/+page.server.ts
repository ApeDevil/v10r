import { buildUnifiedModelUsage } from '$lib/server/ai/usage-summary';
import { requireAdmin } from '$lib/server/auth/guards';
import { getModelUsage } from '$lib/server/db/ai/admin-queries';
import {
	getImageConversionFunnel,
	getImageModelUsage,
	getImageUsageKpis,
	getImageVolumeByDay,
} from '$lib/server/db/ai/image-metadata-queries';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

/**
 * Cost & Usage — the cross-surface AI spend home. The unified usage-by-model table is the
 * ONLY place the chatbot and image-reader telemetry meet, and the merge happens in the app
 * layer (buildUnifiedModelUsage), never in SQL — the two telemetry tables stay independent.
 *
 * Cost is a REFERENCE estimate at standard pricing; our keys run free-tier, so the real
 * charge is $0. The summary reports coverage so a partial-priced total is never misleading.
 *
 * Centerpiece (the merged table) + headline tiles are awaited (cheap, above-fold). The
 * conversion funnel (cross-schema LEFT JOIN) and the volume chart stream behind {#await}.
 */
export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	const [chatUsage, imageUsage, kpis] = await Promise.all([
		getModelUsage(30),
		getImageModelUsage(30),
		getImageUsageKpis(30),
	]);
	const { rows, summary } = buildUnifiedModelUsage(chatUsage, imageUsage);

	return {
		title: 'Cost & Usage',
		usage: rows,
		summary,
		kpis,
		funnel: safeDeferPromise(getImageConversionFunnel(30), {
			totalImages: 0,
			saved: 0,
			abandoned: 0,
			savedRate: null,
		}),
		volume: safeDeferPromise(getImageVolumeByDay(30), []),
	};
};
