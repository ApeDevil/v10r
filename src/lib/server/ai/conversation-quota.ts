/**
 * How many conversations a user may keep, and how close they are to it.
 *
 * The cap is `ai` policy; `db/ai/queries` only counts rows. Keeping the two apart is what
 * lets the same count serve the quota banner, the create-guard and the bulk-delete summary
 * without the data layer needing to know why anyone is asking.
 */

import { getUsersNearLimit } from '$lib/server/db/ai/admin-queries';
import { countConversations, getConversationStats } from '$lib/server/db/ai/queries';
import { MAX_CONVERSATIONS_PER_USER } from './config';

/** Null when the user may create another conversation; a reader-facing reason when not. */
export async function checkConversationLimit(userId: string): Promise<string | null> {
	const total = await countConversations(userId);
	return total < MAX_CONVERSATIONS_PER_USER
		? null
		: `Conversation limit reached (${MAX_CONVERSATIONS_PER_USER}). Delete old conversations to continue.`;
}

export async function getConversationQuota(userId: string) {
	const { total, totalTokens } = await getConversationStats(userId);
	return {
		total,
		totalTokens,
		limit: MAX_CONVERSATIONS_PER_USER,
		usagePercent: Math.round((total / MAX_CONVERSATIONS_PER_USER) * 100),
	};
}

/**
 * Users approaching the cap, with how far along they are.
 *
 * `threshold` is expressed as a fraction of the cap rather than a row count, so the two
 * cannot drift apart the way a hard-coded 40-against-200 did.
 */
export async function getUsersNearConversationLimit(threshold = 0.2) {
	const rows = await getUsersNearLimit(Math.ceil(MAX_CONVERSATIONS_PER_USER * threshold));
	return rows.map((row) => ({
		...row,
		percentageUsed: Math.round((row.conversationCount / MAX_CONVERSATIONS_PER_USER) * 100),
	}));
}
