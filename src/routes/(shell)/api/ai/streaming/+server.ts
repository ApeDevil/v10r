import { json } from '@sveltejs/kit';
import { streamText } from 'ai';
import { safeParse } from 'valibot';
import { aiConfigured, chatModel } from '$lib/server/ai';
import { MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW, SYSTEM_PROMPT } from '$lib/server/ai/config';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { StreamingRequestSchema } from '$lib/server/ai/validation';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	if (!aiConfigured || !chatModel) {
		return json({ error: 'No AI provider configured.' }, { status: 503 });
	}

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

	// Parse and validate request body
	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid request body.' }, { status: 400 });
	}

	const parsed = safeParse(StreamingRequestSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	try {
		const { prompt } = parsed.output;

		const result = streamText({
			model: chatModel,
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
		return json({ error: safeAIMessage(aiErr.kind) }, { status: aiErrorToStatus(aiErr.kind) });
	}
};
