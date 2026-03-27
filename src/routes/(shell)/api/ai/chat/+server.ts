import { json } from '@sveltejs/kit';
import { createDataStreamResponse, streamText } from 'ai';
import { safeParse } from 'valibot';
import { aiConfigured, chatModel, fallbackProviders } from '$lib/server/ai';
import { MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW, SYSTEM_PROMPT } from '$lib/server/ai/config';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { ChatRequestSchema } from '$lib/server/ai/validation';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { createConversation, saveMessages } from '$lib/server/db/ai/mutations';
import { formatContextForPrompt, retrieve } from '$lib/server/retrieval';
import type { PipelineChunksEvent, PipelineStepEvent } from '$lib/types/pipeline';
import type { RequestHandler } from './$types';

const ratelimit = createLimiter(RATE_LIMIT_PREFIX, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW);

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireApiUser(locals);

	if (!aiConfigured || !chatModel) {
		return json({ error: 'No AI provider configured. Add an API key to your environment.' }, { status: 503 });
	}
	const model = chatModel;

	const { success, reset } = await ratelimit.limit(user.id);
	if (!success) return rateLimitResponse(reset);

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
			const limitError = await checkConversationLimit(user.id);
			if (limitError) {
				return json({ error: limitError }, { status: 403 });
			}

			const firstUserMsg = messages.find((m: { role: string }) => m.role === 'user');
			const title = firstUserMsg ? firstUserMsg.content.slice(0, 80) : 'New conversation';
			const conv = await createConversation(user.id, title);
			conversationId = conv.id;
		}

		// Verify conversation ownership if existing
		if (existingConvId) {
			const { getConversation } = await import('$lib/server/db/ai/queries');
			const conv = await getConversation(existingConvId, user.id);
			if (!conv) {
				return json({ error: 'Conversation not found.' }, { status: 404 });
			}
		}

		// Save user message before streaming
		const userMsg = messages[messages.length - 1];
		if (conversationId && userMsg?.role === 'user') {
			await saveMessages(conversationId, user.id, [
				{ id: crypto.randomUUID(), role: userMsg.role, content: userMsg.content },
			]);
		}

		const userId = user.id;
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
						const retrievalResult = await retrieve(
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
						model,
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
			model,
			system: SYSTEM_PROMPT,
			messages,
			maxTokens: MAX_TOKENS,
			onFinish: async ({ text }) => {
				try {
					if (conversationId && text) {
						await saveMessages(conversationId, userId, [{ id: crypto.randomUUID(), role: 'assistant', content: text }]);
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
								if (convId && text) {
									await saveMessages(convId, user.id, [{ id: crypto.randomUUID(), role: 'assistant', content: text }]);
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
				} catch {}
			}
		}

		return json({ error: safeAIMessage(aiErr.kind) }, { status: aiErrorToStatus(aiErr.kind) });
	}
};
