import { json } from '@sveltejs/kit';
import { streamText } from 'ai';
import { safeParse } from 'valibot';
import { aiConfigured, chatModel } from '$lib/server/ai';
import { SYSTEM_PROMPT, MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, RATE_LIMIT_PREFIX } from '$lib/server/ai/config';
import { StreamingRequestSchema } from '$lib/server/ai/validation';
import { classifyAIError, aiErrorToStatus } from '$lib/server/ai/errors';
import { requireApiUser } from '$lib/server/auth/guards';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	if (!aiConfigured || !chatModel) {
		return json(
			{ error: 'No AI provider configured.' },
			{ status: 503 },
		);
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
			maxTokens: MAX_TOKENS,
		});

		result.consumeStream();

		return result.toDataStreamResponse();
	} catch (err) {
		const aiErr = classifyAIError(err);
		return json(
			{ error: aiErr.message },
			{ status: aiErrorToStatus(aiErr.kind) },
		);
	}
};
