import { json } from '@sveltejs/kit';
import { streamText } from 'ai';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import { aiConfigured, chatModel, fallbackProviders } from '$lib/server/ai';
import { SYSTEM_PROMPT, MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, RATE_LIMIT_PREFIX } from '$lib/server/ai/config';
import { classifyAIError, aiErrorToStatus } from '$lib/server/ai/errors';
import { createConversation, saveMessages, updateConversationTitle } from '$lib/server/db/ai/mutations';
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

	if (!aiConfigured || !chatModel) {
		return json(
			{ error: 'No AI provider configured. Add an API key to your environment.' },
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
		const { messages, conversationId: existingConvId } = await request.json();

		// Auto-create conversation if none provided
		let conversationId = existingConvId;
		if (!conversationId && locals.user) {
			const firstUserMsg = messages.find((m: { role: string }) => m.role === 'user');
			const title = firstUserMsg
				? firstUserMsg.content.slice(0, 80)
				: 'New conversation';
			const conv = await createConversation(locals.user.id, title);
			conversationId = conv.id;
		}

		// Save user message before streaming
		const userMsg = messages[messages.length - 1];
		if (conversationId && userMsg?.role === 'user') {
			await saveMessages(conversationId, [
				{ id: crypto.randomUUID(), role: userMsg.role, content: userMsg.content },
			]);
		}

		const result = streamText({
			model: chatModel,
			system: SYSTEM_PROMPT,
			messages,
			maxTokens: MAX_TOKENS,
			onFinish: async ({ text }) => {
				if (conversationId && text) {
					await saveMessages(conversationId, [
						{ id: crypto.randomUUID(), role: 'assistant', content: text },
					]);
					// Update title from first user message if auto-created
					if (!existingConvId) {
						const firstUserMsg = messages.find((m: { role: string }) => m.role === 'user');
						if (firstUserMsg) {
							await updateConversationTitle(conversationId, firstUserMsg.content.slice(0, 80));
						}
					}
				}
			},
		});

		const headers: Record<string, string> = {};
		if (conversationId) {
			headers['X-Conversation-Id'] = conversationId;
		}

		return result.toDataStreamResponse({ headers });
	} catch (err) {
		const aiErr = classifyAIError(err);

		// Attempt fallback for transient errors
		if (['unavailable', 'timeout', 'unknown'].includes(aiErr.kind)) {
			for (const fallback of fallbackProviders) {
				try {
					const fallbackModel = fallback.getInstance();
					if (!fallbackModel) continue;

					const { messages } = await request.clone().json();
					const result = streamText({
						model: fallbackModel,
						system: SYSTEM_PROMPT,
						messages,
						maxTokens: MAX_TOKENS,
					});

					return result.toDataStreamResponse();
				} catch {
					continue;
				}
			}
		}

		return json(
			{ error: aiErr.message },
			{ status: aiErrorToStatus(aiErr.kind) },
		);
	}
};
