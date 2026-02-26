import { json } from '@sveltejs/kit';
import { streamText, createDataStreamResponse } from 'ai';
import { safeParse } from 'valibot';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '$lib/server/cache';
import { aiConfigured, chatModel, fallbackProviders } from '$lib/server/ai';
import { SYSTEM_PROMPT, MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, RATE_LIMIT_PREFIX } from '$lib/server/ai/config';
import { ChatRequestSchema } from '$lib/server/ai/validation';
import { classifyAIError, aiErrorToStatus } from '$lib/server/ai/errors';
import { createConversation, saveMessages, updateConversationTitle } from '$lib/server/db/ai/mutations';
import { checkConversationLimit } from '$lib/server/db/ai/guards';
import { formatContextForPrompt } from '$lib/server/retrieval';
import { retrieveWithEvents } from '$lib/server/retrieval/instrumented';
import type { PipelineStepEvent, PipelineChunksEvent } from '$lib/types/pipeline';
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

	// Parse and validate request body
	const body = await request.json().catch(() => null);
	if (!body) {
		return json({ error: 'Invalid request body.' }, { status: 400 });
	}

	const parsed = safeParse(ChatRequestSchema, body);
	if (!parsed.success) {
		return json({ error: 'Invalid request.' }, { status: 400 });
	}

	const { messages, conversationId: existingConvId, useRetrieval, retrievalTiers } = parsed.output;

	try {
		// Auto-create conversation if none provided
		let conversationId = existingConvId;
		if (!conversationId) {
			const allowed = await checkConversationLimit(locals.user.id);
			if (!allowed) {
				return json(
					{ error: 'Conversation limit reached. Delete old conversations to continue.' },
					{ status: 403 },
				);
			}

			const firstUserMsg = messages.find((m: { role: string }) => m.role === 'user');
			const title = firstUserMsg
				? firstUserMsg.content.slice(0, 80)
				: 'New conversation';
			const conv = await createConversation(locals.user.id, title);
			conversationId = conv.id;
		}

		// Verify conversation ownership if existing
		if (existingConvId) {
			const { getConversation } = await import('$lib/server/db/ai/mutations');
			const conv = await getConversation(existingConvId, locals.user.id);
			if (!conv) {
				return json({ error: 'Conversation not found.' }, { status: 404 });
			}
		}

		// Save user message before streaming
		const userMsg = messages[messages.length - 1];
		if (conversationId && userMsg?.role === 'user') {
			await saveMessages(conversationId, locals.user.id, [
				{ id: crypto.randomUUID(), role: userMsg.role, content: userMsg.content },
			]);
		}

		const userId = locals.user.id;
		const responseHeaders: Record<string, string> = {};
		if (conversationId) {
			responseHeaders['X-Conversation-Id'] = conversationId;
		}

		// --- Retrieval path: use createDataStreamResponse for pipeline events ---
		if (useRetrieval && userMsg?.role === 'user') {
			return createDataStreamResponse({
				headers: responseHeaders,
				execute: async (dataStream) => {
					let systemPrompt = SYSTEM_PROMPT;

					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const emitEvent = (event: PipelineStepEvent | PipelineChunksEvent) => {
						dataStream.writeMessageAnnotation(event as any);
					};

					try {
						const retrievalResult = await retrieveWithEvents(
							userMsg.content,
							{ userId, maxChunks: 3, tiers: retrievalTiers ?? [1] },
							emitEvent,
						);

						const contextBlock = formatContextForPrompt(retrievalResult);
						if (contextBlock) {
							systemPrompt = `${SYSTEM_PROMPT}\n\n<context>\n${contextBlock}\n</context>\n\nUse the above context to inform your response. Cite sources when relevant.`;
						}

						// Keep X-Retrieval-Meta as fallback for basic chat page
						responseHeaders['X-Retrieval-Meta'] = JSON.stringify({
							tierUsed: retrievalResult.tierUsed,
							chunkCount: retrievalResult.chunks.length,
							durationMs: retrievalResult.durationMs,
						});
					} catch (err) {
						console.error('[ai:chat] Retrieval failed, proceeding without context:', err);
					}

					emitEvent({ type: 'pipeline:step', step: 'generate', status: 'active' });

					const textResult = streamText({
						model: chatModel,
						system: systemPrompt,
						messages,
						maxTokens: MAX_TOKENS,
						onFinish: async ({ text }) => {
							emitEvent({ type: 'pipeline:step', step: 'generate', status: 'done' });
							try {
								if (conversationId && text) {
									await saveMessages(conversationId, userId, [
										{ id: crypto.randomUUID(), role: 'assistant', content: text },
									]);
								}
							} catch (err) {
								console.error('[ai:chat] Failed to persist assistant message:', {
									conversationId,
									error: err instanceof Error ? err.message : err,
								});
							}
						},
					});

					textResult.mergeIntoDataStream(dataStream);
				},
				onError: (error) => {
					console.error('[ai:chat:stream] Stream error:', error);
					return 'An error occurred while processing your request.';
				},
			});
		}

		// --- Non-retrieval path: unchanged ---
		const result = streamText({
			model: chatModel,
			system: SYSTEM_PROMPT,
			messages,
			maxTokens: MAX_TOKENS,
			onFinish: async ({ text }) => {
				try {
					if (conversationId && text) {
						await saveMessages(conversationId, userId, [
							{ id: crypto.randomUUID(), role: 'assistant', content: text },
						]);
					}
				} catch (err) {
					console.error('[ai:chat] Failed to persist assistant message:', {
						conversationId,
						error: err instanceof Error ? err.message : err,
					});
				}
			},
		});

		result.consumeStream();

		return result.toDataStreamResponse({ headers: responseHeaders });
	} catch (err) {
		const aiErr = classifyAIError(err);

		// Attempt fallback for transient errors
		if (['unavailable', 'timeout', 'unknown', 'rate_limit'].includes(aiErr.kind)) {
			for (const fallback of fallbackProviders) {
				try {
					const fallbackModel = fallback.getInstance();
					if (!fallbackModel) continue;

					const result = streamText({
						model: fallbackModel,
						system: SYSTEM_PROMPT,
						messages,
						maxTokens: MAX_TOKENS,
						onFinish: async ({ text }) => {
							try {
								const convId = existingConvId ?? undefined;
								if (convId && text && locals.user) {
									await saveMessages(convId, locals.user.id, [
										{ id: crypto.randomUUID(), role: 'assistant', content: text },
									]);
								}
							} catch (err) {
								console.error('[ai:chat:fallback] Failed to persist assistant message:', {
									error: err instanceof Error ? err.message : err,
								});
							}
						},
					});

					result.consumeStream();

					const headers: Record<string, string> = {};
					if (existingConvId) {
						headers['X-Conversation-Id'] = existingConvId;
					}

					return result.toDataStreamResponse({ headers });
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
