import * as v from 'valibot';
import { safeParse } from 'valibot';
import { checkDocumentLimit } from '$lib/server/db/retrieval/limits';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiCreated, apiError, apiValidationError } from '$lib/server/http/response';
import { INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW } from '$lib/server/retrieval/config';
import { RetrievalError, retrievalErrorToStatus } from '$lib/server/retrieval/errors';
import { ingest } from '$lib/server/retrieval/ingest';
import type { RequestHandler } from './$types';

// Chunk + embed of up to 200k chars runs many sequential embedding calls; the
// serverless default (~10s) kills it mid-ingest on Vercel. Match the /stream sibling.
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

const ratelimit = createLimiter('rl:retrieval:ingest', INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW);

const IngestSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	content: v.pipe(v.string(), v.minLength(10), v.maxLength(200_000)),
	sourceType: v.optional(v.picklist(['upload', 'web', 'text', 'api'])),
	sourcePath: v.optional(v.string()),
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
		return apiError(400, 'invalid_body', 'Invalid request body.');
	}
	const body = read.value;

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
