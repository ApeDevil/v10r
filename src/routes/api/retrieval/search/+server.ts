import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import { retrieve } from '$lib/server/retrieval';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/retrieval/errors';
import type { RequestHandler } from './$types';

const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, '1m'),
	prefix: 'rl:retrieval:search',
});

const SearchSchema = v.object({
	query: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)),
	tiers: v.optional(v.array(v.picklist([1, 2, 3]))),
	maxChunks: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(20))),
	graphDepth: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(2))),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to use retrieval search.' }, { status: 401 });
	}

	const { success, reset } = await ratelimit.limit(locals.user.id);
	if (!success) {
		return json(
			{ error: 'Too many search requests. Please wait a moment.' },
			{
				status: 429,
				headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
			},
		);
	}

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
			userId: locals.user.id,
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
