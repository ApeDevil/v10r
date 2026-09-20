import { json } from '@sveltejs/kit';
import {
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_WINDOW,
} from '$lib/server/ai/config';
import { getConversationQuota } from '$lib/server/ai/conversation-quota';
import type { ConversationSort } from '$lib/server/db/ai/queries';
import { listConversations } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import { guardApiUser } from '$lib/server/http/guards';
import { parsePagination } from '$lib/server/http/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError } from '$lib/server/http/response';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_WINDOW,
);

export const GET: RequestHandler = async ({ url, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const sort: ConversationSort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

	try {
		const pagination = parsePagination(url);
		const [{ items: conversations, total }, meta] = await Promise.all([
			listConversations(user.id, sort, pagination.offset, pagination.pageSize),
			getConversationQuota(user.id),
		]);
		return json({
			data: {
				items: conversations,
				meta,
				pagination: {
					page: pagination.page,
					pageSize: pagination.pageSize,
					total,
					totalPages: Math.ceil(total / pagination.pageSize),
				},
			},
		});
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
