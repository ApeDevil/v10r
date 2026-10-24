import { AI_PAGE_SIZE } from '#lib/server/admin/config.ts';
import { getUsersNearConversationLimit } from '#lib/server/ai/conversation-quota.ts';
import {
	getConversationsList,
	getMessageVolumeByDay,
	getTopUsersByConversations,
} from '#lib/server/db/ai/admin-queries.ts';
import { safeDeferPromise } from '#lib/server/http/defer.ts';
import { requireAdmin } from '#lib/server/http/guards.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
	requireAdmin(locals);

	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const userId = url.searchParams.get('user') || undefined;

	const [topUsers, usersNearLimit] = await Promise.all([
		getTopUsersByConversations(10),
		getUsersNearConversationLimit(),
	]);

	return {
		title: 'AI Usage',
		topUsers,
		usersNearLimit,
		filters: { page, userId },
		conversations: safeDeferPromise(getConversationsList({ userId, page, pageSize: AI_PAGE_SIZE }), {
			entries: [],
			total: 0,
			totalPages: 1,
		}),
		messageVolume: safeDeferPromise(getMessageVolumeByDay(30), []),
	};
};
