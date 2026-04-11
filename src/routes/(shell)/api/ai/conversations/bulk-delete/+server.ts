import * as v from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { bulkDeleteConversations } from '$lib/server/db/ai/mutations';
import { getConversationStats } from '$lib/server/db/ai/queries';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(CONV_RATE_LIMIT_PREFIX, CONV_RATE_LIMIT_MAX, CONV_RATE_LIMIT_WINDOW);

const BulkDeleteSchema = v.object({
	ids: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1), v.maxLength(100)),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Request body must be valid JSON.');

	const parsed = v.safeParse(BulkDeleteSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const deletedCount = await bulkDeleteConversations(parsed.output.ids, user.id);
		const meta = await getConversationStats(user.id);
		return apiOk({ deletedCount, meta });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
