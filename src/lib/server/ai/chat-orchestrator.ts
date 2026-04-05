/**
 * Chat orchestration — domain module.
 * Handles conversation management, retrieval integration, streaming, and fallback rotation.
 * No SvelteKit imports — reusable from AI tools, REST, and background jobs.
 */
import { createDataStreamResponse, streamText, type DataStreamWriter } from 'ai';
import { chatModel, fallbackProviders } from '$lib/server/ai';
import { MAX_TOKENS, SYSTEM_PROMPT } from '$lib/server/ai/config';
import { classifyAIError, safeAIMessage, aiErrorToStatus } from '$lib/server/ai/errors';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { createConversation, saveMessages } from '$lib/server/db/ai/mutations';
import { getConversation } from '$lib/server/db/ai/queries';
import { formatContextForPrompt, retrieve } from '$lib/server/retrieval';
import type { PipelineChunksEvent, PipelineStepEvent } from '$lib/types/pipeline';

export interface ChatInput {
	userId: string;
	messages: { role: 'user' | 'assistant'; content: string }[];
	conversationId?: string;
	useRetrieval?: boolean;
	retrievalTiers?: (1 | 2 | 3)[];
	panelContext?: { panelType: string; label: string; content: string }[];
}

export interface ChatResult {
	type: 'stream' | 'data-stream' | 'error';
	conversationId?: string;
}

interface ChatError {
	type: 'error';
	status: number;
	code: string;
	message: string;
}

/** Build the system prompt with optional desk panel context. */
function buildSystemPrompt(panelContext?: ChatInput['panelContext']): string {
	let prompt = SYSTEM_PROMPT;
	if (panelContext?.length) {
		const sanitized = panelContext.map((pc) => ({
			...pc,
			content: pc.content.replace(/(?:sk-|ghp_|AKIA|Bearer\s)\S+/gi, '[REDACTED]'),
		}));
		const deskBlock = sanitized.map((pc) => `## ${pc.label}\n${pc.content}`).join('\n\n---\n\n');
		prompt += `\n\n<desk-context>\n${deskBlock}\n</desk-context>\n\nThe above is context from the user's workspace panels. Reference it when relevant.`;
	}
	return prompt;
}

/** Persist assistant message after stream finishes. */
function createOnFinish(conversationId: string | undefined, userId: string) {
	return async ({ text }: { text: string }) => {
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
	};
}

/** Resolve or auto-create the conversation. Returns conversationId or error. */
async function resolveConversation(
	userId: string,
	existingConvId: string | undefined,
	messages: ChatInput['messages'],
): Promise<{ conversationId: string } | ChatError> {
	if (existingConvId) {
		const conv = await getConversation(existingConvId, userId);
		if (!conv) return { type: 'error', status: 404, code: 'not_found', message: 'Conversation not found.' };
		return { conversationId: existingConvId };
	}

	const limitError = await checkConversationLimit(userId);
	if (limitError) return { type: 'error', status: 403, code: 'limit_exceeded', message: limitError };

	const firstUserMsg = messages.find((m) => m.role === 'user');
	const title = firstUserMsg ? firstUserMsg.content.slice(0, 80) : 'New conversation';
	const conv = await createConversation(userId, title);
	return { conversationId: conv.id };
}

/** Attempt streaming with fallback providers on transient errors. */
function tryFallback(
	baseSystemPrompt: string,
	messages: ChatInput['messages'],
	conversationId: string | undefined,
	userId: string,
): Response | null {
	for (const fallback of fallbackProviders) {
		try {
			const fallbackModel = fallback.getInstance();
			if (!fallbackModel) continue;

			const result = streamText({
				model: fallbackModel,
				system: baseSystemPrompt,
				messages,
				maxTokens: MAX_TOKENS,
				onFinish: createOnFinish(conversationId, userId),
			});

			result.consumeStream();

			const headers: Record<string, string> = {};
			if (conversationId) headers['X-Conversation-Id'] = conversationId;
			return result.toDataStreamResponse({ headers });
		} catch {
			// try next fallback
		}
	}
	return null;
}

/**
 * Orchestrate a chat request: resolve conversation, optionally retrieve context,
 * stream the response, and persist messages.
 *
 * Returns a Response (either streaming or error JSON).
 */
export async function orchestrateChat(input: ChatInput): Promise<Response> {
	const { userId, messages, conversationId: existingConvId, useRetrieval, retrievalTiers, panelContext } = input;

	if (!chatModel) {
		return Response.json(
			{ error: { code: 'ai_unavailable', message: 'No AI provider configured.' } },
			{ status: 503 },
		);
	}
	const model = chatModel;
	const baseSystemPrompt = buildSystemPrompt(panelContext);

	// Resolve conversation
	const convResult = await resolveConversation(userId, existingConvId, messages);
	if ('type' in convResult) {
		const err = convResult as ChatError;
		return Response.json(
			{ error: { code: err.code, message: err.message } },
			{ status: err.status },
		);
	}
	const { conversationId } = convResult;

	// Save user message
	const userMsg = messages[messages.length - 1];
	if (conversationId && userMsg?.role === 'user') {
		await saveMessages(conversationId, userId, [
			{ id: crypto.randomUUID(), role: userMsg.role, content: userMsg.content },
		]);
	}

	const responseHeaders: Record<string, string> = {};
	if (conversationId) responseHeaders['X-Conversation-Id'] = conversationId;

	try {
		// Retrieval path
		if (useRetrieval && userMsg?.role === 'user') {
			return createDataStreamResponse({
				headers: responseHeaders,
				execute: async (dataStream: DataStreamWriter) => {
					let systemPrompt = baseSystemPrompt;

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
							systemPrompt = `${baseSystemPrompt}\n\n<retrieval-context>\n${contextBlock}\n</retrieval-context>\n\nUse the above context to inform your response. Cite sources when relevant.`;
						}
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
							await createOnFinish(conversationId, userId)({ text });
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

		// Non-retrieval path
		const result = streamText({
			model,
			system: baseSystemPrompt,
			messages,
			maxTokens: MAX_TOKENS,
			onFinish: createOnFinish(conversationId, userId),
		});

		result.consumeStream();
		return result.toDataStreamResponse({ headers: responseHeaders });
	} catch (err) {
		const aiErr = classifyAIError(err);

		if (['unavailable', 'timeout', 'unknown', 'rate_limit'].includes(aiErr.kind)) {
			const fallbackResponse = tryFallback(baseSystemPrompt, messages, conversationId, userId);
			if (fallbackResponse) return fallbackResponse;
		}

		return Response.json(
			{ error: { code: aiErr.kind, message: safeAIMessage(aiErr.kind) } },
			{ status: aiErrorToStatus(aiErr.kind) },
		);
	}
}
