import * as v from 'valibot';
import { safeParse } from 'valibot';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError, apiValidationError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import { INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW } from '$lib/server/config';
import { checkDocumentLimit } from '$lib/server/db/rag/limits';
import { RetrievalError } from '$lib/server/rawrag/errors';
import { ingest } from '$lib/server/rawrag/ingest';
import type { IngestEvent } from '$lib/types/ingest-pipeline';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter('rl:retrieval:ingest-stream', INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW);

const StreamSchema = v.object({
	title: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	content: v.pipe(v.string(), v.minLength(10), v.maxLength(200_000)),
	sourceType: v.optional(v.picklist(['upload', 'web', 'text', 'api'])),
});

/**
 * NDJSON streaming ingest — one JSON object per line, flushed as soon as it's emitted.
 * Lighter than SSE and trivial to parse on the client with a line-by-line reader.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	const body = await request.json().catch(() => null);
	if (!body) return apiError(400, 'invalid_body', 'Invalid request body.');

	const parsed = safeParse(StreamSchema, body);
	if (!parsed.success) return apiValidationError(parsed.issues);

	const limitError = await checkDocumentLimit(user.id);
	if (limitError) return apiError(403, 'limit_exceeded', limitError);

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		async start(controller) {
			const write = (event: IngestEvent) => {
				controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
			};

			try {
				await ingest(
					{
						title: parsed.output.title,
						content: parsed.output.content,
						sourceType: parsed.output.sourceType ?? 'text',
						userId: user.id,
					},
					write,
				);
			} catch (err) {
				const msg = err instanceof Error ? err.message : 'Ingestion failed';
				const kind = err instanceof RetrievalError ? err.kind : 'ingestion_failed';
				write({
					type: 'ingest:step',
					step: 'insert',
					status: 'error',
					error: msg,
					detail: { kind },
				});
				console.error('[api:retrieval:ingest:stream] Error:', msg);
			} finally {
				controller.close();
			}
		},
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'application/x-ndjson',
			'Cache-Control': 'no-cache',
			'X-Accel-Buffering': 'no',
		},
	});
};
