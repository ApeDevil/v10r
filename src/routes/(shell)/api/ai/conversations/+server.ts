import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import { CreateConversationSchema } from '$lib/server/ai/validation';
import { parsePagination } from '$lib/server/api/pagination';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { createConversation } from '$lib/server/db/ai/mutations';
import type { ConversationSort } from '$lib/server/db/ai/queries';
import { getConversationStats, listConversations } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const sort: ConversationSort = url.searchParams.get('sort') === 'oldest' ? 'oldest' : 'newest';

	try {
		const pagination = parsePagination(url);
		const [{ items: conversations, total }, meta] = await Promise.all([
			listConversations(user.id, sort, pagination.offset, pagination.pageSize),
			getConversationStats(user.id),
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

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const limitError = await checkConversationLimit(user.id);
	if (limitError) {
		return apiError(403, 'limit_exceeded', limitError);
	}

	const body = await request.json().catch(() => ({}));
	const parsed = safeParse(CreateConversationSchema, body);
	const title = parsed.success ? parsed.output.title : undefined;

	try {
		const conv = await createConversation(user.id, title);
		return apiCreated(conv);
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
