import * as v from 'valibot';
import {
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_WINDOW,
} from '#lib/server/ai/config.ts';
import { getConversationQuota } from '#lib/server/ai/conversation-quota.ts';
import { bulkDeleteConversations } from '#lib/server/db/ai/mutations.ts';
import { classifyDbError, safeDbMessage } from '#lib/server/db/errors.ts';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '#lib/server/http/body.ts';
import { guardApiUser } from '#lib/server/http/guards.ts';
import { createLimiter, rateLimitResponse } from '#lib/server/http/rate-limit.ts';
import { apiError, apiOk, apiValidationError } from '#lib/server/http/response.ts';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(
	CONVERSATION_RATE_LIMIT_PREFIX,
	CONVERSATION_RATE_LIMIT_MAX,
	CONVERSATION_RATE_LIMIT_WINDOW,
);

const BulkDeleteSchema = v.object({
	ids: v.pipe(v.array(v.pipe(v.string(), v.uuid())), v.minLength(1), v.maxLength(100)),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const guard = guardApiUser(locals);
	if ('error' in guard) return guard.error;
	const { user } = guard;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const read = await readJsonBounded(request, MAX_AI_BODY_BYTES);
	if (!read.ok) {
		if (read.reason === 'too_large') return payloadTooLargeResponse(MAX_AI_BODY_BYTES);
		return apiError(400, 'invalid_body', 'Request body must be valid JSON.');
	}
	const body = read.value;

	const parsed = v.safeParse(BulkDeleteSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	try {
		const deletedCount = await bulkDeleteConversations(parsed.output.ids, user.id);
		const meta = await getConversationQuota(user.id);
		return apiOk({ deletedCount, meta });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
