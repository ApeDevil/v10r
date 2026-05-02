import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiOk, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { SEARCH_RATE_LIMIT_MAX, SEARCH_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { retrieve } from '$lib/server/rawrag';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/rawrag/errors';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:retrieval:search', SEARCH_RATE_LIMIT_MAX, SEARCH_RATE_LIMIT_WINDOW);

const SearchSchema = v.object({
	query: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)),
	tiers: v.optional(v.array(v.picklist([1, 2, 3]))),
	maxChunks: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(20))),
	graphDepth: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(2))),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) {
		return apiError(400, 'invalid_body', 'Invalid request body.');
	}

	const parsed = safeParse(SearchSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	try {
		const result = await retrieve(parsed.output.query, {
			userId: user.id,
			tiers: parsed.output.tiers ?? [1],
			maxChunks: parsed.output.maxChunks ?? 5,
			graphDepth: parsed.output.graphDepth ?? 2,
		});

		return apiOk(result);
	} catch (err) {
		console.error('[api:retrieval:search] Error:', err instanceof Error ? err.message : err);
		if (err instanceof RetrievalError) {
			return apiError(retrievalErrorToStatus(err.kind), err.kind, err.message);
		}
		return apiError(500, 'search_failed', 'Search failed.');
	}
};
