import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { retrieve } from '$lib/server/retrieval';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/retrieval/errors';
import { SEARCH_RATE_LIMIT_MAX, SEARCH_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { requireApiUser } from '$lib/server/auth/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
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
		return json({ error: 'Invalid request body.' }, { status: 400 });
	}

	const parsed = safeParse(SearchSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	try {
		const result = await retrieve(parsed.output.query, {
			userId: user.id,
			tiers: parsed.output.tiers ?? [1],
			maxChunks: parsed.output.maxChunks ?? 5,
			graphDepth: parsed.output.graphDepth ?? 2,
		});

		return json(result);
	} catch (err) {
		console.error('[api:retrieval:search] Error:', err instanceof Error ? err.message : err);
		if (err instanceof RetrievalError) {
			return json(
				{ error: err.message },
				{ status: retrievalErrorToStatus(err.kind) },
			);
		}
		return json({ error: 'Search failed' }, { status: 500 });
	}
};
