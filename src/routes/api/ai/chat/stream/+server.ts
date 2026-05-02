import { streamText } from 'ai';
import { safeParse } from 'valibot';
import { aiConfigured, getActiveProvider } from '$lib/server/ai';
import { MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW, SYSTEM_PROMPT } from '$lib/server/ai/config';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { StreamingRequestSchema } from '$lib/server/ai/validation';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { apiError } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	const provider = aiConfigured ? getActiveProvider(user.id) : null;
	const model = provider?.getInstance() ?? null;
	if (!model) {
		return apiError(503, 'unavailable', 'No AI provider configured.');
	}

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	// Parse and validate request body
	const body = await request.json().catch(() => null);
	if (!body) {
		return apiError(400, 'invalid_body', 'Invalid request body.');
	}

	const parsed = safeParse(StreamingRequestSchema, body);
	if (!parsed.success) {
		return apiError(400, 'validation_failed', 'Invalid request.');
	}

	try {
		const { prompt } = parsed.output;

		const result = streamText({
			model,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: prompt }],
			maxOutputTokens: MAX_TOKENS,
			abortSignal: AbortSignal.timeout(30_000),
			onError: ({ error }) => {
				console.error('[ai:streaming] Stream error:', error);
			},
		});

		result.consumeStream();

		return result.toUIMessageStreamResponse();
	} catch (err) {
		const aiErr = classifyAIError(err);
		return apiError(aiErrorToStatus(aiErr.kind), 'ai_error', safeAIMessage(aiErr.kind));
	}
};
