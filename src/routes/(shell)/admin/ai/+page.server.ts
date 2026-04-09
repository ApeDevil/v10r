import { activeProviderInfo } from '$lib/server/ai';
import { getProviderStatuses } from '$lib/server/ai/showcase/queries';
import { requireAdmin } from '$lib/server/auth/guards';
import {
	getAIOverviewStats,
	getConversationsList,
	getMessageVolumeByDay,
	getTopUsersByConversations,
	getUsersNearLimit,
} from '$lib/server/db/ai/admin-queries';
import { safeDeferPromise } from '$lib/server/utils/safe-defer';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const userId = url.searchParams.get('user') || undefined;

	const [overview, topUsers, usersNearLimit] = await Promise.all([
		getAIOverviewStats(),
		getTopUsersByConversations(10),
		getUsersNearLimit(40),
	]);

	return {
		overview,
		topUsers,
		usersNearLimit,
		providers: getProviderStatuses(),
		activeProvider: activeProviderInfo,
		filters: { page, userId },
		conversations: safeDeferPromise(getConversationsList({ userId, page }), { entries: [], total: 0, totalPages: 1 }),
		messageVolume: safeDeferPromise(getMessageVolumeByDay(30), []),
	};
};
