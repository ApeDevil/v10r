import { safeParse } from 'valibot';
import { CreateConversationSchema } from '$lib/server/ai/validation';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { createConversation } from '$lib/server/db/ai/mutations';
import { listConversations } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_WINDOW);

export const GET: RequestHandler = async ({ locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	try {
		const conversations = await listConversations(user.id);
		return apiOk(conversations);
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
