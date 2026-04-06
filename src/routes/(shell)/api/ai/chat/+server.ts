import { json } from '@sveltejs/kit';
import { createDataStreamResponse, streamText } from 'ai';
import { safeParse } from 'valibot';
import { aiConfigured, chatModel, fallbackProviders } from '$lib/server/ai';
import { MAX_TOKENS, RATE_LIMIT_MAX, RATE_LIMIT_PREFIX, RATE_LIMIT_WINDOW, SYSTEM_PROMPT, buildCapabilitiesBlock } from '$lib/server/ai/config';
import { resolveTools } from '$lib/server/ai/tools';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { ChatRequestSchema } from '$lib/server/ai/validation';
import { createLimiter, rateLimitResponse } from '$lib/server/api/rate-limit';
import { requireApiUser } from '$lib/server/auth/guards';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import { createConversation, saveMessages } from '$lib/server/db/ai/mutations';
import { getConversation } from '$lib/server/db/ai/queries';
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

	const { messages, conversationId: existingConvId, useRetrieval, retrievalTiers, panelContext, availableTools: requestedTools } = parsed.output;

	// Build tool set from client-requested tool names (validated against server allowlist)
	const tools = requestedTools?.length ? resolveTools(requestedTools) : undefined;
	const toolNames = tools ? Object.keys(tools) : [];

	// Build base system prompt with optional desk panel context
	let baseSystemPrompt = SYSTEM_PROMPT;
	if (panelContext?.length) {
		const SECRET_RE = /(?:sk-|ghp_|gho_|ghu_|ghs_|ghr_|glpat-|xox[bsrpa]-|sk_live_|pk_live_|AKIA|ASIA|Bearer\s|postgres:\/\/|password[=:]\s*|secret[=:]\s*)\S+/gi;
		const sanitized = panelContext.map((pc) => ({
			...pc,
			label: pc.label.replace(/[#<>]/g, ''),
			content: pc.content.replace(SECRET_RE, '[REDACTED]'),
		}));
		const deskBlock = sanitized.map((pc) => `## ${pc.label}\n${pc.content}`).join('\n\n---\n\n');
		baseSystemPrompt += `\n\n<desk-context>\n${deskBlock}\n</desk-context>\n\nThe above is context from the user's workspace panels. Reference it when relevant.`;
	}

	// Append available tool capabilities to the system prompt
	baseSystemPrompt += buildCapabilitiesBlock(toolNames);

	let conversationId = existingConvId;

	try {
		// Auto-create conversation if none provided
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
					let systemPrompt = baseSystemPrompt;

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
							systemPrompt = `${baseSystemPrompt}\n\n<retrieval-context>\n${contextBlock}\n</retrieval-context>\n\nUse the above context to inform your response. Cite sources when relevant.`;
						}

						// Emit retrieval metadata as annotation (headers are already captured by createDataStreamResponse)
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						dataStream.writeMessageAnnotation({
							type: 'retrieval:meta',
							tierUsed: retrievalResult.tierUsed,
							chunkCount: retrievalResult.chunks.length,
							durationMs: retrievalResult.durationMs,
						} as any);
					} catch (err) {
						console.error('[ai:chat] Retrieval failed, proceeding without context:', err);
					}

					emitEvent({ type: 'pipeline:step', step: 'generate', status: 'active' });

					const textResult = streamText({
						model,
						system: systemPrompt,
						messages,
						maxTokens: MAX_TOKENS,
						tools,
						maxSteps: tools ? 1 : undefined,
						onFinish: async ({ text, toolCalls }) => {
							emitEvent({ type: 'pipeline:step', step: 'generate', status: 'done' });
							try {
								const content = text || (toolCalls?.length
									? `[Tool calls: ${toolCalls.map((tc) => tc.toolName).join(', ')}]`
									: '');
								if (conversationId && content) {
									await saveMessages(conversationId, userId, [
										{ id: crypto.randomUUID(), role: 'assistant', content },
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
					textResult.consumeStream();
				},
				onError: (error) => {
					console.error('[ai:chat:stream] Stream error:', error);
					return 'An error occurred while processing your request.';
				},
			});
		}

		// --- Non-retrieval path ---
		return createDataStreamResponse({
			headers: responseHeaders,
			execute: async (dataStream) => {
				const textResult = streamText({
					model,
					system: baseSystemPrompt,
					messages,
					maxTokens: MAX_TOKENS,
					tools,
					maxSteps: tools ? 1 : undefined,
					onFinish: async ({ text, toolCalls }) => {
						try {
							const content = text || (toolCalls?.length
								? `[Tool calls: ${toolCalls.map((tc) => tc.toolName).join(', ')}]`
								: '');
							if (conversationId && content) {
								await saveMessages(conversationId, userId, [{ id: crypto.randomUUID(), role: 'assistant', content }]);
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
				textResult.consumeStream();
			},
			onError: (error) => {
				console.error('[ai:chat:stream] Stream error:', error);
				return 'An error occurred while processing your request.';
			},
		});
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
						system: baseSystemPrompt,
						messages,
						maxTokens: MAX_TOKENS,
						tools,
						maxSteps: tools ? 1 : undefined,
						onFinish: async ({ text, toolCalls }) => {
							try {
								const convId = conversationId ?? existingConvId;
								const content = text || (toolCalls?.length
									? `[Tool calls: ${toolCalls.map((tc) => tc.toolName).join(', ')}]`
									: '');
								if (convId && content) {
									await saveMessages(convId, user.id, [{ id: crypto.randomUUID(), role: 'assistant', content }]);
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
					const convId = conversationId ?? existingConvId;
					if (convId) {
						headers['X-Conversation-Id'] = convId;
					}

					return result.toDataStreamResponse({ headers });
				} catch {}
			}
		}

		return json({ error: safeAIMessage(aiErr.kind) }, { status: aiErrorToStatus(aiErr.kind) });
	}
};
