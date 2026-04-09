import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiCreated, apiError, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { checkDocumentLimit } from '$lib/server/db/rag/limits';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/retrieval/errors';
import { ingest } from '$lib/server/retrieval/ingest';
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
		return apiError(400, 'invalid_body', 'Invalid request body.');
	}

	const parsed = safeParse(IngestSchema, body);
	if (!parsed.success) {
		return apiValidationError(parsed.issues);
	}

	const limitError = await checkDocumentLimit(user.id);
	if (limitError) {
		return apiError(403, 'limit_exceeded', limitError);
	}

	try {
		const result = await ingest({
			title: parsed.output.title,
			content: parsed.output.content,
			sourceType: parsed.output.sourceType ?? 'text',
			sourcePath: parsed.output.sourcePath,
			userId: user.id,
		});

		return apiCreated(result);
	} catch (err) {
		console.error('[api:retrieval:ingest] Error:', err instanceof Error ? err.message : err);
		if (err instanceof RetrievalError) {
			return apiError(retrievalErrorToStatus(err.kind), err.kind, err.message);
		}
		return apiError(500, 'ingestion_failed', 'Ingestion failed.');
	}
};
