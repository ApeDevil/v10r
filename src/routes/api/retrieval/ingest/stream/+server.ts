import * as v from 'valibot';
import { safeParse } from 'valibot';
import { checkDocumentLimit } from '$lib/server/db/retrieval/limits';
import { MAX_AI_BODY_BYTES, payloadTooLargeResponse, readJsonBounded } from '$lib/server/http/body';
import { guardApiUser } from '$lib/server/http/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/http/rate-limit';
import { apiError, apiValidationError } from '$lib/server/http/response';
import { INGEST_RATE_LIMIT_MAX, INGEST_RATE_LIMIT_WINDOW } from '$lib/server/retrieval/config';
import { RetrievalError } from '$lib/server/retrieval/errors';
import { ingest } from '$lib/server/retrieval/ingest';
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
// Ingest streams chunking + embedding work that routinely exceeds the default.
// (60 = Hobby ceiling; raise to 300 on Pro for large documents.)
export const config = { runtime: 'nodejs22.x', maxDuration: 60 };

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
