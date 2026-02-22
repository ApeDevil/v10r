import { json } from '@sveltejs/kit';
import { streamText } from 'ai';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import { aiConfigured, chatModel, activeProviderInfo } from '$lib/server/ai';
import { SYSTEM_PROMPT, MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, RATE_LIMIT_PREFIX } from '$lib/server/ai/config';
import { classifyAIError, aiErrorToStatus } from '$lib/server/ai/errors';
import type { RequestHandler } from './$types';

const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW),
	prefix: RATE_LIMIT_PREFIX,
});

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		return json({ error: 'Sign in to use the AI assistant.' }, { status: 401 });
	}

	if (!aiConfigured || !chatModel || !activeProviderInfo) {
		return json(
			{ error: 'No AI provider configured.' },
			{ status: 503 },
		);
	}

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
		const { prompt } = await request.json();

		const result = streamText({
			model: chatModel,
			system: SYSTEM_PROMPT,
			messages: [{ role: 'user', content: prompt }],
			maxTokens: MAX_TOKENS,
		});

		return result.toDataStreamResponse({
			headers: {
				'X-Provider': activeProviderInfo.id,
				'X-Model': activeProviderInfo.model,
			},
		});
	} catch (err) {
		const aiErr = classifyAIError(err);
		return json(
			{ error: aiErr.message },
			{ status: aiErrorToStatus(aiErr.kind) },
		);
	}
};
