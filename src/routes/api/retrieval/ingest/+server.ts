import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import { ingest } from '$lib/server/retrieval/ingest';
import { checkDocumentLimit } from '$lib/server/db/rag/guards';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/retrieval/errors';
import type { RequestHandler } from './$types';

const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(5, '1h'),
	prefix: 'rl:retrieval:ingest',
});

const IngestSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	content: v.pipe(v.string(), v.minLength(10), v.maxLength(200_000)),
	sourceType: v.optional(v.picklist(['upload', 'web', 'text', 'api'])),
	sourcePath: v.optional(v.string()),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to use document ingestion.' }, { status: 401 });
	}

	const { success, reset } = await ratelimit.limit(locals.user.id);
	if (!success) {
		return json(
			{ error: 'Too many ingestion requests. Please wait before trying again.' },
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

	const parsed = safeParse(IngestSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const allowed = await checkDocumentLimit(locals.user.id);
	if (!allowed) {
		return json(
			{ error: 'Document limit reached. Delete old documents to continue.' },
			{ status: 403 },
		);
	}

	try {
		const result = await ingest({
			title: parsed.output.title,
			content: parsed.output.content,
			sourceType: parsed.output.sourceType ?? 'text',
			sourcePath: parsed.output.sourcePath,
			userId: locals.user.id,
		});

		return json(result, { status: 201 });
	} catch (err) {
		console.error('[api:retrieval:ingest] Error:', err instanceof Error ? err.message : err);
		if (err instanceof RetrievalError) {
			return json(
				{ error: err.message },
				{ status: retrievalErrorToStatus(err.kind) },
			);
		}
		return json({ error: 'Ingestion failed' }, { status: 500 });
	}
};
