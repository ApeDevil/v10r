import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { retrieve } from '$lib/server/retrieval';
import type { RequestHandler } from './$types';

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
			tiers: parsed.output.tiers ?? [1],
			maxChunks: parsed.output.maxChunks ?? 5,
			graphDepth: parsed.output.graphDepth ?? 2,
		});

		return json(result);
	} catch (err) {
		console.error('[api:retrieval:search] Error:', err);
		return json(
			{ error: err instanceof Error ? err.message : 'Search failed' },
			{ status: 500 },
		);
	}
};
