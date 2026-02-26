import { json } from '@sveltejs/kit';
import { safeParse } from 'valibot';
import * as v from 'valibot';
import { ingest } from '$lib/server/retrieval/ingest';
import { checkDocumentLimit } from '$lib/server/db/rag/guards';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/retrieval/errors';
import { INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { requireApiUser } from '$lib/server/auth/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:retrieval:ingest', INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW);

const IngestSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	content: v.pipe(v.string(), v.minLength(10), v.maxLength(200_000)),
	sourceType: v.optional(v.picklist(['upload', 'web', 'text', 'api'])),
	sourcePath: v.optional(v.string()),
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid request body.' }, { status: 400 });
	}

	const parsed = safeParse(IngestSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const allowed = await checkDocumentLimit(user.id);
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
			userId: user.id,
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
