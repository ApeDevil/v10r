import { json } from '@sveltejs/kit';
import { streamText } from 'ai';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import { aiConfigured, chatModel } from '$lib/server/ai';
import { SYSTEM_PROMPT, MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, RATE_LIMIT_PREFIX } from '$lib/server/ai/config';
import { classifyAIError, aiErrorToStatus } from '$lib/server/ai/errors';
import type { RequestHandler } from './$types';

const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW),
	prefix: RATE_LIMIT_PREFIX,
});

export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth gate
	if (!locals.user) {
		return json({ error: 'Sign in to use the AI assistant.' }, { status: 401 });
	}

	// AI availability
	if (!aiConfigured || !chatModel) {
		return json(
			{ error: 'AI is not configured. Set GROQ_API_KEY in your environment.' },
			{ status: 503 },
		);
	}

	// Rate limit per user
	const { success, reset } = await ratelimit.limit(locals.user.id);
	if (!success) {
		return json(
			{ error: 'Too many requests. Please wait a moment.' },
			{
				status: 429,
				headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) },
			},
		);
	}

	try {
		const { messages } = await request.json();

		const result = streamText({
			model: chatModel,
			system: SYSTEM_PROMPT,
			messages,
			maxTokens: MAX_TOKENS,
		});

		return result.toDataStreamResponse();
	} catch (err) {
		const aiErr = classifyAIError(err);
		return json(
			{ error: aiErr.message },
			{ status: aiErrorToStatus(aiErr.kind) },
		);
	}
};
