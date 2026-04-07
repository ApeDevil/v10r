/**
 * Chat orchestration — domain module.
 * Handles conversation management, retrieval integration, streaming, and fallback rotation.
 * No SvelteKit imports — reusable from AI tools, REST, and background jobs.
 */
import { createUIMessageStreamResponse, convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai';
import { chatModel, toolModel, fallbackProviders } from '$lib/server/ai';
import { MAX_TOKENS, SYSTEM_PROMPT, DESK_SYSTEM_PROMPT } from '$lib/server/ai/config';
import { classifyAIError, safeAIMessage, aiErrorToStatus } from '$lib/server/ai/errors';
import { createDeskTools, type DeskToolScope } from '$lib/server/ai/tools';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { createConversation, refreshConversationTokens, saveConversationStep, saveMessages, saveToolCall, updateMessageContent } from '$lib/server/db/ai/mutations';
import { getConversation } from '$lib/server/db/ai/queries';
import { formatContextForPrompt, retrieve } from '$lib/server/retrieval';
import type { PipelineChunksEvent, PipelineStepEvent } from '$lib/types/pipeline';

/** A legacy simple message or a full UIMessage from the AI SDK v6 client. */
export type ChatMessage =
	| { role: 'user' | 'assistant'; content: string }
	| UIMessage;

export interface ChatInput {
	userId: string;
	messages: ChatMessage[];
	conversationId?: string;
	useRetrieval?: boolean;
	retrievalTiers?: (1 | 2 | 3)[];
	panelContext?: { panelType: string; label: string; content: string }[];
	toolScopes?: DeskToolScope[];
	deskLayout?: { panelId: string; fileId?: string; fileType?: string; label: string }[];
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

/** Extract text content from a ChatMessage (handles both legacy and UIMessage format). */
function getMessageText(msg: ChatMessage): string {
	if ('content' in msg && typeof msg.content === 'string') return msg.content;
	if ('parts' in msg) {
		return msg.parts
			.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
			.map((p) => p.text)
			.join('\n');
	}
	return '';
}

/**
 * Window conversation history to last N turns to stay within token budget.
 * Always keeps the most recent messages. Rough estimate: 4 chars ≈ 1 token.
 */
function windowMessages(
	messages: ChatInput['messages'],
	maxTurns = 5,
): ChatInput['messages'] {
	// Each "turn" is a user+assistant pair = 2 messages. Keep last N turns.
	const maxMessages = maxTurns * 2;
	if (messages.length <= maxMessages) return messages;
	const result = messages.slice(-maxMessages);
	// Ensure context starts with a user message (some providers reject assistant-first)
	if (result.length > 0 && result[0].role === 'assistant') {
		return result.slice(1);
	}
	return result;
}

/** Escape XML-special characters to prevent attribute breakout in system prompts. */
function escapeXmlAttr(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** Build the system prompt with optional desk panel context. */
function buildSystemPrompt(
	panelContext?: ChatInput['panelContext'],
	hasTools = false,
	deskLayout?: ChatInput['deskLayout'],
): string {
	let prompt = hasTools ? DESK_SYSTEM_PROMPT : SYSTEM_PROMPT;

	if (panelContext?.length) {
		const sanitized = panelContext.map((pc) => ({
			...pc,
			content: pc.content
				.replace(/(?:sk-|ghp_|AKIA|Bearer\s)\S+/gi, '[REDACTED]')
				.slice(0, 8000),
		}));
		const deskBlock = sanitized
			.map((pc) => `<panel type="${escapeXmlAttr(pc.panelType)}" label="${escapeXmlAttr(pc.label)}">\n${pc.content}\n</panel>`)
			.join('\n');
		prompt += `\n\n<desk-context>\n${deskBlock}\n</desk-context>`;
	}

	if (deskLayout?.length && hasTools) {
		const layoutBlock = deskLayout
			.map((p) => `- ${escapeXmlAttr(p.label)} (${escapeXmlAttr(p.fileType ?? 'panel')})${p.fileId ? ` [${p.fileId}]` : ''}`)
			.join('\n');
		prompt += `\n\n<desk-layout>\nOpen panels:\n${layoutBlock}\n</desk-layout>`;
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
	const title = firstUserMsg ? getMessageText(firstUserMsg).slice(0, 80) : 'New conversation';
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
				maxOutputTokens: MAX_TOKENS,
				abortSignal: AbortSignal.timeout(30_000),
				onFinish: createOnFinish(conversationId, userId),
				onError: ({ error }) => {
					console.error('[ai:chat:fallback] Stream error:', error);
				},
			});

			result.consumeStream();

			const headers: Record<string, string> = {};
			if (conversationId) headers['X-Conversation-Id'] = conversationId;
			return result.toUIMessageStreamResponse({ headers });
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
	const { userId, messages: rawMessages, conversationId: existingConvId, useRetrieval, retrievalTiers, panelContext, toolScopes, deskLayout } = input;

	// Window conversation history to prevent context overflow in multi-turn chats
	const windowedMessages = windowMessages(rawMessages);

	// Convert UIMessages to CoreMessages for streamText compatibility
	const isUIMessages = windowedMessages.some((m) => 'parts' in m);
	const messages = isUIMessages
		? await convertToModelMessages(windowedMessages as UIMessage[])
		: windowedMessages as { role: 'user' | 'assistant'; content: string }[];

	if (!chatModel) {
		return Response.json(
			{ error: { code: 'ai_unavailable', message: 'No AI provider configured.' } },
			{ status: 503 },
		);
	}

	// Use tool-capable provider when tools requested, fall back to chatModel without tools
	const wantsTools = !!toolScopes?.length;
	const hasTools = wantsTools && !!toolModel;
	const model = hasTools ? toolModel : chatModel;
	const deskTools = hasTools ? createDeskTools(userId, toolScopes) : undefined;
	const baseSystemPrompt = buildSystemPrompt(panelContext, hasTools, deskLayout);

	// Resolve conversation (pass raw messages for title extraction)
	const convResult = await resolveConversation(userId, existingConvId, windowedMessages);
	if ('type' in convResult) {
		const err = convResult as ChatError;
		return Response.json(
			{ error: { code: err.code, message: err.message } },
			{ status: err.status },
		);
	}
	const { conversationId } = convResult;

	// Save user message
	const lastRawMsg = windowedMessages[windowedMessages.length - 1];
	const userMsgText = lastRawMsg?.role === 'user' ? getMessageText(lastRawMsg) : '';
	if (conversationId && lastRawMsg?.role === 'user' && userMsgText) {
		await saveMessages(conversationId, userId, [
			{ id: crypto.randomUUID(), role: 'user', content: userMsgText },
		]);
	}

	const responseHeaders: Record<string, string> = {};
	if (conversationId) responseHeaders['X-Conversation-Id'] = conversationId;

	try {
		// Retrieval path — uses createUIMessageStreamResponse for custom pipeline events
		if (useRetrieval && lastRawMsg?.role === 'user' && userMsgText) {
			return createUIMessageStreamResponse({
				headers: responseHeaders,
				execute: async (writer) => {
					let systemPrompt = baseSystemPrompt;

					const emitEvent = (event: PipelineStepEvent | PipelineChunksEvent) => {
						writer.write({ type: 'data', value: [event] });
					};

					try {
						const retrievalResult = await retrieve(
							userMsgText,
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
						maxOutputTokens: MAX_TOKENS,
						abortSignal: AbortSignal.timeout(30_000),
						onFinish: async ({ text }) => {
							emitEvent({ type: 'pipeline:step', step: 'generate', status: 'done' });
							await createOnFinish(conversationId, userId)({ text });
						},
						onError: ({ error }) => {
							console.error('[ai:chat:retrieval] Stream error:', error);
						},
					});

					textResult.consumeStream();
					writer.merge(textResult);
				},
				onError: (error) => {
					console.error('[ai:chat:stream] Stream error:', error);
					return 'An error occurred while processing your request.';
				},
			});
		}

		// Non-retrieval path — pre-insert assistant message so tool_call FK is satisfied
		const assistantMsgId = crypto.randomUUID();
		if (conversationId) {
			await saveMessages(conversationId, userId, [
				{ id: assistantMsgId, role: 'assistant', content: '' },
			]);
		}
		let stepCounter = 0;

		const result = streamText({
			model,
			system: baseSystemPrompt,
			messages,
			maxOutputTokens: MAX_TOKENS,
			abortSignal: AbortSignal.timeout(30_000),
			...(deskTools ? {
				tools: deskTools,
				toolChoice: 'auto' as const,
				stopWhen: stepCountIs(3),
				// Compress earlier tool results after step 2 to prevent context explosion
				prepareStep: async ({ stepNumber, messages: stepMessages }: { stepNumber: number; messages: unknown[] }) => {
					if (stepNumber < 2) return {};
					return {
						messages: stepMessages.map((msg: any) => {
							if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 500) {
								return { ...msg, content: msg.content.slice(0, 500) + '\n[truncated]' };
							}
							return msg;
						}),
					};
				},
			} : {}),
			onStepFinish: async ({ toolResults, usage }) => {
				if (!conversationId) return;
				const currentStep = stepCounter++;

				// Persist tool calls from this step
				const toolCallIds: string[] = [];
				if (toolResults) {
					for (const tr of toolResults) {
						try {
							const hasError = tr.result && typeof tr.result === 'object' && 'error' in tr.result;
							const saved = await saveToolCall({
								messageId: assistantMsgId,
								toolName: tr.toolName,
								args: (tr.args ?? {}) as Record<string, unknown>,
								result: (tr.result ?? {}) as Record<string, unknown>,
								status: hasError ? 'error' : 'success',
								errorMessage: hasError ? String((tr.result as { error: string }).error) : undefined,
							});
							toolCallIds.push(saved.id);
						} catch (err) {
							console.error('[ai:chat] Failed to persist tool call:', err);
						}
					}
				}

				// Persist step usage
				try {
					await saveConversationStep({
						conversationId,
						messageId: assistantMsgId,
						stepIndex: currentStep,
						stepType: currentStep === 0 ? 'initial' : 'tool-result',
						inputTokens: usage?.inputTokens ?? 0,
						outputTokens: usage?.outputTokens ?? 0,
						toolCallIds: toolCallIds.length > 0 ? toolCallIds : undefined,
					});
				} catch (err) {
					console.error('[ai:chat] Failed to persist step:', err);
				}
			},
			onFinish: async ({ text }) => {
				// Update the pre-inserted assistant message with final content
				if (conversationId && text) {
					await updateMessageContent(assistantMsgId, text);
				}
				// Refresh cached token totals
				if (conversationId) {
					try { await refreshConversationTokens(conversationId); } catch { /* non-critical */ }
				}
			},
			onError: ({ error }) => {
				console.error('[ai:chat] Stream error:', error);
			},
		});

		result.consumeStream();
		return result.toUIMessageStreamResponse({ headers: responseHeaders });
	} catch (err) {
		const aiErr = classifyAIError(err);

		if (['unavailable', 'timeout', 'unknown', 'rate_limit'].includes(aiErr.kind)) {
			const fallbackResponse = tryFallback(baseSystemPrompt, messages, conversationId, userId);
			if (fallbackResponse) return fallbackResponse;
		}

		return Response.json(
			{ error: { code: aiErr.kind, message: safeAIMessage(aiErr.kind) } },
			{ status: aiErrorToStatus(aiErr.kind), headers: { 'X-AI-Error-Kind': aiErr.kind } },
		);
	}
}
