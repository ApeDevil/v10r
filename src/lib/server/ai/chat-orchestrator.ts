/**
 * Chat orchestration — domain module.
 * Handles conversation management, retrieval integration, streaming, and fallback rotation.
 * No SvelteKit imports — reusable from AI tools, REST, and background jobs.
 */
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	type ModelMessage,
	stepCountIs,
	streamText,
	type UIMessage,
} from 'ai';
import { getActiveProvider, getActiveProviderInfo, getFallbacksForUser, getToolProvider } from '$lib/server/ai';
import { MAX_TOKENS } from '$lib/server/ai/config';
import { buildSystemPrompt, getMessageText, windowMessages } from '$lib/server/ai/context/system-prompt';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { compactToolResults, DEFAULT_BUDGET, runWithCompaction } from '$lib/server/ai/loop/compact';
import type { ProviderEntry } from '$lib/server/ai/providers';
import { isCooledDown, markCooldown } from '$lib/server/ai/providers';
import { buildRetrievalTools, createDeskTools, type DeskToolScope, stepsForScopes } from '$lib/server/ai/tools';
import { MAX_RAWRAG_TOOL_CALLS_PER_TURN } from '$lib/server/llmwiki/config';
import { loadOverview } from '$lib/server/llmwiki/overview';
import { searchLlmwiki } from '$lib/server/llmwiki/search';
import { verifyCitations } from '$lib/server/llmwiki/verify';
import { formatLlmwikiContext } from '$lib/server/llmwiki/wiki-format';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import {
	createConversation,
	refreshConversationTokens,
	saveConversationStep,
	saveMessages,
	saveToolCall,
	updateMessageContent,
} from '$lib/server/db/ai/mutations';
import { createProposal } from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { formatContextForPrompt, retrieve } from '$lib/server/rawrag';
import type {
	ChunkSummary,
	LlmwikiCitationsEvent,
	PipelineChunksEvent,
	PipelinePromptEvent,
	PipelineStepEvent,
} from '$lib/types/pipeline';

/** A legacy simple message or a full UIMessage from the AI SDK v6 client. */
export type ChatMessage = { role: 'user' | 'assistant'; content: string } | UIMessage;

export interface ChatInput {
	userId: string;
	providerId?: string;
	messages: ChatMessage[];
	conversationId?: string;
	useRetrieval?: boolean;
	retrievalTiers?: (1 | 2 | 3)[];
	fusion?: 'none' | 'rrf';
	/**
	 * Use the llmwiki layer as the primary retrieval surface.
	 * Loads the overview, searches llmwiki pages, hydrates rawrag pointers,
	 * and exposes `get_llmwiki_pages` + `get_rawrag_chunks` tools for drill-down.
	 * Mutually exclusive with the legacy `useRetrieval` path.
	 */
	useLlmwiki?: boolean;
	/** Optional collection scope for llmwiki search. `null` means global. */
	llmwikiCollectionId?: string | null;
	panelContext?: {
		panelType: string;
		label: string;
		content: string;
		status?: string;
		contentLevel?: string;
		tokenEstimate?: number;
	}[];
	toolScopes?: DeskToolScope[];
	deskLayout?: { panelId: string; fileId?: string; fileType?: string; label: string }[];
	activeWorkspace?: { id: string; name: string };
	/**
	 * When set, the caller is resuming a previously approved `agent_proposal`.
	 * The orchestrator can look up the proposal's cached execution result and
	 * inject it as context instead of re-planning. See `db/ai/proposals.ts`.
	 */
	resumeFromProposalId?: string;
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

// System-prompt assembly, message windowing, and XML escape helpers live in
// `src/lib/server/ai/context/system-prompt.ts`.

/** Persist assistant message after stream finishes. */
export function createOnFinish(conversationId: string | undefined, userId: string) {
	return async ({
		text,
		totalUsage,
	}: {
		text: string;
		totalUsage?: { inputTokens?: number; outputTokens?: number };
	}) => {
		try {
			if (conversationId && text) {
				await saveMessages(conversationId, userId, [{ id: crypto.randomUUID(), role: 'assistant', content: text }]);
			}
			if (totalUsage) {
				console.info('[ai:chat] totalUsage:', {
					inputTokens: totalUsage.inputTokens,
					outputTokens: totalUsage.outputTokens,
				});
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
	messages: ModelMessage[],
	conversationId: string | undefined,
	userId: string,
	fallbacks: ProviderEntry[],
	wantsTools = false,
	deskTools?: ReturnType<typeof createDeskTools>,
	toolScopes?: DeskToolScope[],
): Response | null {
	for (const fallback of fallbacks) {
		if (isCooledDown(fallback.id)) continue;
		// For tool requests, prefer tool-capable providers
		if (wantsTools && !fallback.supportsTools) continue;
		try {
			const fallbackModel = fallback.getInstance();
			if (!fallbackModel) continue;

			const useTools = wantsTools && fallback.supportsTools && deskTools;
			const result = streamText({
				model: fallbackModel,
				system: baseSystemPrompt,
				messages,
				maxRetries: 0,
				maxOutputTokens: MAX_TOKENS,
				abortSignal: AbortSignal.timeout(30_000),
				...(useTools
					? { tools: deskTools, toolChoice: 'auto' as const, stopWhen: stepCountIs(stepsForScopes(toolScopes ?? [])) }
					: {}),
				onFinish: createOnFinish(conversationId, userId),
				onError: ({ error }) => {
					console.error('[ai:chat:fallback] Stream error:', error);
				},
			});

			result.consumeStream();

			const headers: Record<string, string> = {};
			if (conversationId) headers['X-Conversation-Id'] = conversationId;
			const stream = createUIMessageStream({
				execute: ({ writer }) => {
					writer.merge(result.toUIMessageStream());
				},
				onError: (error: unknown): string => {
					const aiErr = classifyAIError(error);
					console.error(`[ai:chat:fallback] Stream classify [${aiErr.kind}]:`, error);
					if (aiErr.kind === 'rate_limit') markCooldown(fallback.id);
					return `[${aiErr.kind}] ${safeAIMessage(aiErr.kind)}`;
				},
			});
			return createUIMessageStreamResponse({ stream, headers });
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
 * Runs the entire request inside a compaction context (`runWithCompaction`) so
 * tool results above the budget are transparently replaced with refs the model
 * can pull back via `resolve_ref` — the AI SDK #9631 workaround.
 *
 * Returns a Response (either streaming or error JSON).
 */
export async function orchestrateChat(input: ChatInput): Promise<Response> {
	return runWithCompaction(DEFAULT_BUDGET, () => orchestrateChatInner(input));
}

async function orchestrateChatInner(input: ChatInput): Promise<Response> {
	const {
		userId,
		providerId,
		messages: rawMessages,
		conversationId: existingConvId,
		useRetrieval,
		retrievalTiers,
		fusion,
		useLlmwiki,
		llmwikiCollectionId,
		panelContext,
		toolScopes,
		deskLayout,
		activeWorkspace,
	} = input;

	// Window conversation history to prevent context overflow in multi-turn chats
	const windowedMessages = windowMessages(rawMessages);

	// Convert to ModelMessages for streamText compatibility.
	// Legacy {role, content} messages are wrapped as UIMessages with text parts first.
	const normalized: UIMessage[] = windowedMessages.map((m) => {
		if ('parts' in m) return m as UIMessage;
		return { id: crypto.randomUUID(), role: m.role, parts: [{ type: 'text' as const, text: m.content }] };
	});
	// Compact loaded history so oversized tool results from resumed conversations
	// don't blow the context window before the first step even runs.
	const messages = compactToolResults(await convertToModelMessages(normalized));

	// Resolve provider dynamically per-request (request override → stored preference → env → first configured)
	const activeProvider = getActiveProvider(userId, providerId);
	const activeInfo = getActiveProviderInfo(userId, providerId);
	const resolvedChatModel = activeProvider?.getInstance() ?? null;
	const resolvedToolProvider = getToolProvider(userId, providerId);
	const resolvedToolModel = resolvedToolProvider?.getInstance() ?? null;
	const resolvedToolProviderId = resolvedToolProvider?.id ?? null;
	const resolvedFallbacks = getFallbacksForUser(userId, providerId);

	if (!resolvedChatModel) {
		return Response.json({ error: { code: 'ai_unavailable', message: 'No AI provider configured.' } }, { status: 503 });
	}

	// Use tool-capable provider when tools requested, fall back to chatModel without tools
	const wantsTools = !!toolScopes?.length;
	const toolProviderAvailable =
		!!resolvedToolModel && !!resolvedToolProviderId && !isCooledDown(resolvedToolProviderId);
	const hasTools = wantsTools && toolProviderAvailable;
	const model = (hasTools ? resolvedToolModel : resolvedChatModel) ?? resolvedChatModel;
	const deskTools = hasTools ? createDeskTools(userId, toolScopes, deskLayout) : undefined;
	const baseSystemPrompt = buildSystemPrompt({ panelContext, toolScopes, deskLayout, activeWorkspace });

	// Resolve conversation (pass raw messages for title extraction)
	const convResult = await resolveConversation(userId, existingConvId, windowedMessages);
	if ('type' in convResult) {
		const err = convResult as ChatError;
		return Response.json(
			{ error: { code: err.code, message: err.message } },
			{ status: err.status, headers: { 'X-AI-Error-Kind': err.code } },
		);
	}
	const { conversationId } = convResult;

	// Save user message
	const lastRawMsg = windowedMessages[windowedMessages.length - 1];
	const userMsgText = lastRawMsg?.role === 'user' ? getMessageText(lastRawMsg) : '';
	if (conversationId && lastRawMsg?.role === 'user' && userMsgText) {
		await saveMessages(conversationId, userId, [{ id: crypto.randomUUID(), role: 'user', content: userMsgText }]);
	}

	const responseHeaders: Record<string, string> = {};
	if (conversationId) responseHeaders['X-Conversation-Id'] = conversationId;

	/** Classify a stream error and return a `[kind] user-safe message` string.
	 *  The client parses the `[kind]` prefix to drive error UI and IO log. */
	function classifyStreamError(error: unknown): string {
		const aiErr = classifyAIError(error);
		console.error(`[ai:chat] Stream error [${aiErr.kind}]:`, error);

		// Circuit breaker for rate limits during streaming
		if (aiErr.kind === 'rate_limit') {
			const failedProvider = hasTools ? resolvedToolProviderId : (activeInfo?.id ?? null);
			if (failedProvider) markCooldown(failedProvider);
		}

		return `[${aiErr.kind}] ${safeAIMessage(aiErr.kind)}`;
	}

	try {
		// llmwiki path — primary answer surface; exposes drill-down tools for rawrag.
		if (useLlmwiki && lastRawMsg?.role === 'user' && userMsgText) {
			const collectionId = llmwikiCollectionId ?? null;
			const { tools: retrievalTools, drilledChunks } = buildRetrievalTools(userId);
			const requestId = crypto.randomUUID();

			const stream = createUIMessageStream({
				execute: async ({ writer }) => {
					let systemPrompt = baseSystemPrompt;
					let toolCallCount = 0;

					type AnyLlmwikiEvent =
						| PipelineStepEvent
						| PipelineChunksEvent
						| PipelinePromptEvent
						| LlmwikiCitationsEvent;
					const pipelineEvents: AnyLlmwikiEvent[] = [];
					// Mirror rawrag's citations extra payload so existing consumers still read it.
					let citationsPayload: {
						citations: Array<{ chunkId: string; verification: string; tier: 'rawrag' }>;
						driftedChunkIds: string[];
					} | null = null;

					const flush = () => {
						const meta: Record<string, unknown> = { pipeline: pipelineEvents };
						if (citationsPayload) Object.assign(meta, citationsPayload);
						writer.write({ type: 'message-metadata', messageMetadata: meta });
					};
					const emit = (event: AnyLlmwikiEvent) => {
						if (event.type === 'pipeline:step') event.requestId = requestId;
						pipelineEvents.push(event);
						flush();
					};

					try {
						const overviewStart = performance.now();
						emit({ type: 'pipeline:step', step: 'llmwiki:overview', status: 'active', startedAt: overviewStart });
						const searchStart = performance.now();
						emit({ type: 'pipeline:step', step: 'llmwiki:search', status: 'active', startedAt: searchStart });

						const [overviewResult, hitsResult] = await Promise.allSettled([
							loadOverview(userId, collectionId),
							searchLlmwiki(userMsgText, { userId, collectionId }),
						]);

						const overviewMs = Math.round(performance.now() - overviewStart);
						if (overviewResult.status === 'fulfilled') {
							emit({ type: 'pipeline:step', step: 'llmwiki:overview', status: 'done', durationMs: overviewMs });
						} else {
							emit({
								type: 'pipeline:step',
								step: 'llmwiki:overview',
								status: 'error',
								durationMs: overviewMs,
								error: overviewResult.reason instanceof Error ? overviewResult.reason.message : String(overviewResult.reason),
							});
						}

						const searchMs = Math.round(performance.now() - searchStart);
						if (hitsResult.status === 'fulfilled') {
							const hits = hitsResult.value;
							const pointersHydrated = hits.reduce((sum, h) => sum + h.pointers.length, 0);
							emit({
								type: 'pipeline:step',
								step: 'llmwiki:search',
								status: 'done',
								durationMs: searchMs,
								detail: {
									kind: 'llmwiki-search',
									hits: hits.length,
									vectorHits: hits.length,
									bm25Hits: hits.length,
									pointersHydrated,
									rrfK: 60,
								},
							});
							// Emit llmwiki hits as tierChunks.llmwiki so the viz can render them as pages.
							const llmwikiSummaries: ChunkSummary[] = hits.map((h) => ({
								chunkId: h.slug,
								documentId: h.slug,
								documentTitle: h.title,
								contentPreview: h.tldr,
								contentLength: h.tldr.length,
								score: 0,
								source: 'llmwiki',
								tier: 'llmwiki',
								survived: true,
								survivalReason: 'pointer-only',
							}));
							emit({
								type: 'pipeline:chunks',
								tierChunks: { llmwiki: llmwikiSummaries },
								rankedChunks: [],
								contextChunks: [],
							});

							const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
							const ctxStart = performance.now();
							emit({ type: 'pipeline:step', step: 'llmwiki:context', status: 'active', startedAt: ctxStart });
							const contextBlock = formatLlmwikiContext(overview, hits);
							const ctxMs = Math.round(performance.now() - ctxStart);
							if (contextBlock) {
								systemPrompt = `${baseSystemPrompt}

${contextBlock}

Retrieval rules:
1. Answer from the llmwiki pages above. Their TLDRs and bodies are your primary source.
2. Each page's \`pointers:\` list contains raw chunk IDs (e.g. \`chk_seed_rrf\`). These are the ONLY valid inputs to \`get_rawrag_chunks\`.
3. Call \`get_rawrag_chunks\` ONLY when the user asks for exact wording, a verbatim quote, specific details not in the TLDR, or challenges a claim.
4. When calling \`get_rawrag_chunks\`, you MUST copy chunk IDs verbatim from a page's \`pointers:\` list. NEVER invent, guess, transform, or abbreviate a chunk ID.
5. If no pointer exists for what the user asked, say so plainly instead of fabricating an ID.
6. Do not expand pointers preemptively on broad questions.`;
							}
							emit({
								type: 'pipeline:step',
								step: 'llmwiki:context',
								status: 'done',
								durationMs: ctxMs,
								detail: {
									kind: 'context',
									tokenEstimate: Math.ceil(contextBlock.length / 4),
									chunkCount: hits.length,
								},
							});
							const promptEvent: PipelinePromptEvent = {
								type: 'pipeline:prompt_assembled',
								userPrompt: userMsgText,
								contextBlocks: hits.map((h) => ({ chunkId: h.slug, tokens: Math.ceil(h.tldr.length / 4) })),
								totalTokens: Math.ceil(contextBlock.length / 4),
							};
							if (isDevOrAdmin) {
								promptEvent.systemPrompt = systemPrompt;
							} else {
								promptEvent.systemPromptHash = `sys:${systemPrompt.length.toString(16)}`;
							}
							emit(promptEvent);
						} else {
							emit({
								type: 'pipeline:step',
								step: 'llmwiki:search',
								status: 'error',
								durationMs: searchMs,
								error: hitsResult.reason instanceof Error ? hitsResult.reason.message : String(hitsResult.reason),
							});
						}
					} catch (err) {
						console.error('[ai:chat:llmwiki] Retrieval failed, proceeding without context:', err);
					}

					const generateStart = performance.now();
					emit({ type: 'pipeline:step', step: 'generate', status: 'active', startedAt: generateStart });

					const textResult = streamText({
						model,
						system: systemPrompt,
						messages,
						tools: retrievalTools,
						toolChoice: 'auto',
						stopWhen: stepCountIs(3),
						maxRetries: 0,
						maxOutputTokens: MAX_TOKENS,
						abortSignal: AbortSignal.timeout(30_000),
						onStepFinish: ({
							toolCalls,
							toolResults,
						}: {
							toolCalls?: Array<{ toolName: string; args?: { ids?: string[] } }>;
							toolResults?: Array<{ toolName: string; result?: { chunks?: unknown[] } }>;
						}) => {
							if (!toolCalls) return;
							for (let i = 0; i < toolCalls.length; i++) {
								const tc = toolCalls[i];
								if (tc.toolName !== 'get_rawrag_chunks') continue;
								const callIndex = toolCallCount as 0 | 1 | 2;
								toolCallCount++;
								if (toolCallCount > MAX_RAWRAG_TOOL_CALLS_PER_TURN) {
									console.warn(
										`[ai:chat:llmwiki] get_rawrag_chunks called ${toolCallCount} times, cap is ${MAX_RAWRAG_TOOL_CALLS_PER_TURN}`,
									);
								}
								const idsRequested = tc.args?.ids?.length ?? 0;
								const chunksReturned = toolResults?.[i]?.result?.chunks?.length ?? 0;
								emit({
									type: 'pipeline:step',
									step: 'rawrag:drill',
									status: 'done',
									detail: {
										kind: 'drill',
										callIndex: callIndex <= 2 ? callIndex : 2,
										idsRequested,
										chunksReturned,
									},
								});
							}
						},
						onFinish: async ({ text, totalUsage }) => {
							emit({
								type: 'pipeline:step',
								step: 'generate',
								status: 'done',
								durationMs: Math.round(performance.now() - generateStart),
								detail: {
									kind: 'generate',
									model: activeInfo?.id,
									inputTokens: totalUsage?.inputTokens,
									outputTokens: totalUsage?.outputTokens,
								},
							});
							try {
								if (drilledChunks.size > 0) {
									const verifyStart = performance.now();
									emit({ type: 'pipeline:step', step: 'llmwiki:verify', status: 'active', startedAt: verifyStart });
									const { verifications, driftedChunkIds } = await verifyCitations({
										userId,
										drilledChunkIds: Array.from(drilledChunks),
										answerText: text,
									});
									const verifyMs = Math.round(performance.now() - verifyStart);
									const verdicts = Array.from(verifications.entries()).map(([chunkId, status]) => ({
										pageSlug: '',
										chunkId,
										status,
									}));
									const summary = {
										total: verdicts.length,
										quote: verdicts.filter((v) => v.status === 'quote').length,
										paraphrase: verdicts.filter((v) => v.status === 'paraphrase').length,
										drifted: verdicts.filter((v) => v.status === 'drifted').length,
										uncited: verdicts.filter((v) => v.status === 'uncited').length,
									};
									emit({
										type: 'pipeline:step',
										step: 'llmwiki:verify',
										status: 'done',
										durationMs: verifyMs,
										detail: { kind: 'llmwiki-verify', ...summary },
									});
									emit({ type: 'llmwiki:citations', verdicts, summary });
									// Preserve the existing citations metadata shape for legacy consumers.
									citationsPayload = {
										citations: Array.from(verifications.entries()).map(([chunkId, verification]) => ({
											chunkId,
											verification,
											tier: 'rawrag' as const,
										})),
										driftedChunkIds,
									};
									flush();
								}
							} catch (err) {
								console.error('[ai:chat:llmwiki] Verification failed:', err);
								emit({
									type: 'pipeline:step',
									step: 'llmwiki:verify',
									status: 'error',
									error: err instanceof Error ? err.message : String(err),
								});
							}
							await createOnFinish(conversationId, userId)({ text, totalUsage });
						},
						onError: ({ error }) => {
							console.error('[ai:chat:llmwiki] Stream error:', error);
						},
					});
					textResult.consumeStream();
					writer.merge(textResult.toUIMessageStream());
				},
				onError: classifyStreamError,
			});
			return createUIMessageStreamResponse({ stream, headers: responseHeaders });
		}

		// Retrieval path — uses createUIMessageStream for custom pipeline events
		if (useRetrieval && lastRawMsg?.role === 'user' && userMsgText) {
			const requestId = crypto.randomUUID();
			const generateStartedAt = { t: 0 };
			const stream = createUIMessageStream({
				execute: async ({ writer }) => {
					let systemPrompt = baseSystemPrompt;

					type AnyPipelineEvent = PipelineStepEvent | PipelineChunksEvent | PipelinePromptEvent;
					const pipelineEvents: AnyPipelineEvent[] = [];
					const emitEvent = (event: AnyPipelineEvent) => {
						if (event.type === 'pipeline:step') {
							event.requestId = requestId;
						}
						pipelineEvents.push(event);
						writer.write({ type: 'message-metadata', messageMetadata: { pipeline: pipelineEvents } });
					};

					try {
						const retrievalResult = await retrieve(
							userMsgText,
							{ userId, maxChunks: 3, tiers: retrievalTiers ?? [1], fusion },
							emitEvent,
						);

						const contextBlock = formatContextForPrompt(retrievalResult);
						if (contextBlock) {
							systemPrompt = `${baseSystemPrompt}\n\n<retrieval-context>\n${contextBlock}\n</retrieval-context>\n\nUse the above context to inform your response. Cite sources when relevant.`;
						}

						// Emit assembled prompt (dev/admin only receives full text; others get hash)
						const isDevOrAdmin = !!import.meta.env?.DEV;
						const contextBlocks = retrievalResult.chunks.map((c) => ({
							chunkId: c.chunkId,
							tokens: Math.ceil(c.content.length / 4),
						}));
						const totalTokens = contextBlocks.reduce((sum, b) => sum + b.tokens, 0);
						const promptEvent: PipelinePromptEvent = {
							type: 'pipeline:prompt_assembled',
							userPrompt: userMsgText,
							contextBlocks,
							totalTokens,
						};
						if (isDevOrAdmin) {
							promptEvent.systemPrompt = systemPrompt;
						} else {
							// Short stable hash — not cryptographic, just an identifier.
							let h = 0;
							for (let i = 0; i < systemPrompt.length; i++) {
								h = ((h << 5) - h + systemPrompt.charCodeAt(i)) | 0;
							}
							promptEvent.systemPromptHash = `sys:${Math.abs(h).toString(16)}`;
						}
						emitEvent(promptEvent);
					} catch (err) {
						console.error('[ai:chat] Retrieval failed, proceeding without context:', err);
					}

					generateStartedAt.t = performance.now();
					emitEvent({
						type: 'pipeline:step',
						step: 'generate',
						status: 'active',
						startedAt: generateStartedAt.t,
					});

					const textResult = streamText({
						model,
						system: systemPrompt,
						messages,
						maxRetries: 0,
						maxOutputTokens: MAX_TOKENS,
						abortSignal: AbortSignal.timeout(30_000),
						onFinish: async ({ text, totalUsage }) => {
							emitEvent({
								type: 'pipeline:step',
								step: 'generate',
								status: 'done',
								durationMs: Math.round(performance.now() - generateStartedAt.t),
								detail: {
									kind: 'generate',
									model: activeInfo?.id,
									inputTokens: totalUsage?.inputTokens,
									outputTokens: totalUsage?.outputTokens,
								},
							});
							await createOnFinish(conversationId, userId)({ text, totalUsage });
						},
						onError: ({ error }) => {
							console.error('[ai:chat:retrieval] Stream error:', error);
						},
					});

					textResult.consumeStream();
					writer.merge(textResult.toUIMessageStream());
				},
				onError: classifyStreamError,
			});
			return createUIMessageStreamResponse({ stream, headers: responseHeaders });
		}

		// Non-retrieval path — wrapped in createUIMessageStream for classified error handling
		const assistantMsgId = crypto.randomUUID();
		if (conversationId) {
			await saveMessages(conversationId, userId, [{ id: assistantMsgId, role: 'assistant', content: '' }]);
		}
		let stepCounter = 0;

		/**
		 * Harness metadata accumulator — per SVEY's gotcha, `message-metadata`
		 * events REPLACE (not merge) on the client, so every write must include
		 * the full accumulated object. The retrieval path already does this for
		 * pipeline events; here we do the same for `harness.proposal` events.
		 */
		type HarnessMetadata = {
			proposal?: {
				id: string;
				goal: string;
				steps: unknown[];
				estimatedWrites: number;
				rollback: string;
				riskTier: 'low' | 'medium' | 'high';
				status: 'pending';
			};
		};
		const harnessMetadata: HarnessMetadata = {};

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				// biome-ignore lint/suspicious/noExplicitAny: conditional tool spread confuses TS inference
				const streamOpts: Record<string, any> = {
					model,
					system: baseSystemPrompt,
					messages,
					maxRetries: 0,
					maxOutputTokens: MAX_TOKENS,
					abortSignal: AbortSignal.timeout(30_000),
				};
				if (deskTools) {
					streamOpts.tools = deskTools;
					streamOpts.toolChoice = 'auto';
					streamOpts.stopWhen = stepCountIs(stepsForScopes(toolScopes ?? []));
					// NOTE: per-step tool-result compaction used to live here via `prepareStep`,
					// but AI SDK #9631 silently drops message mutations returned from `prepareStep`.
					// Compaction is now applied at tool-execute time via `wrapToolsWithCompaction`
					// inside `createDeskTools`, and the whole request runs inside a
					// `runWithCompaction` context (see below) so refs resolve consistently.
				}
				// biome-ignore lint/suspicious/noExplicitAny: toolResults type depends on conditional tools
				streamOpts.onStepFinish = async ({
					toolResults,
					usage,
				}: {
					toolResults?: any[];
					usage?: { inputTokens: number; outputTokens: number };
				}) => {
					if (!conversationId) return;
					const currentStep = stepCounter++;

					const toolCallIds: string[] = [];
					if (toolResults) {
						for (const tr of toolResults) {
							try {
								const hasError = tr.output && typeof tr.output === 'object' && 'error' in tr.output;
								const saved = await saveToolCall({
									messageId: assistantMsgId,
									toolName: tr.toolName,
									args: (tr.input ?? {}) as Record<string, unknown>,
									result: (tr.output ?? {}) as Record<string, unknown>,
									status: hasError ? 'error' : 'success',
									errorMessage: hasError ? String((tr.output as { error: string }).error) : undefined,
								});
								toolCallIds.push(saved.id);

								// Plan-before-execute interception: if the model called
								// `desk_propose_plan`, persist an `agent_proposal` row and
								// emit a `harness.proposal` metadata event so the client
								// can render a PlanCard. The stream's natural termination
								// (via `stopWhen` + the model's own "awaiting_approval"
								// response) closes the loop without extra machinery.
								if (tr.toolName === 'desk_propose_plan' && !hasError) {
									try {
										const input = (tr.input ?? {}) as {
											goal: string;
											steps: Array<{ action: string; tool: string; risk: string; rationale: string }>;
											estimated_writes: number;
											rollback: string;
										};
										const proposal = await createProposal({
											conversationId,
											messageId: assistantMsgId,
											riskTier: input.steps.some((s) => s.risk === 'destructive') ? 'high' : 'medium',
											payload: input.steps.map((s) => ({
												toolName: s.tool,
												args: {},
												rationale: s.rationale,
											})),
											rationale: input.goal,
										});
										harnessMetadata.proposal = {
											id: proposal.id,
											goal: input.goal,
											steps: input.steps,
											estimatedWrites: input.estimated_writes,
											rollback: input.rollback,
											riskTier: proposal.riskTier,
											status: 'pending',
										};
										// Always write the full accumulated object — metadata REPLACES on client.
										writer.write({
											type: 'message-metadata',
											messageMetadata: { harness: harnessMetadata },
										});
									} catch (err) {
										console.error('[ai:chat] Failed to persist proposal:', err);
									}
								}
							} catch (err) {
								console.error('[ai:chat] Failed to persist tool call:', err);
							}
						}
					}

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
				};
				streamOpts.onFinish = async ({
					text,
					totalUsage,
				}: {
					text?: string;
					totalUsage?: { inputTokens: number; outputTokens: number };
				}) => {
					if (conversationId && text) {
						await updateMessageContent(assistantMsgId, text);
					}
					if (conversationId) {
						try {
							await refreshConversationTokens(conversationId);
						} catch {
							/* non-critical */
						}
					}
					if (totalUsage) {
						console.info('[ai:chat] totalUsage:', {
							inputTokens: totalUsage.inputTokens,
							outputTokens: totalUsage.outputTokens,
						});
					}
				};
				streamOpts.onError = ({ error }: { error: unknown }) => {
					console.error('[ai:chat] Inner stream error:', error);
				};
				const result = streamText(streamOpts as Parameters<typeof streamText>[0]);

				result.consumeStream();
				writer.merge(result.toUIMessageStream());
			},
			onError: classifyStreamError,
		});
		return createUIMessageStreamResponse({ stream, headers: responseHeaders });
	} catch (err) {
		const aiErr = classifyAIError(err);

		// Circuit breaker: cooldown the provider that just failed with rate limit
		if (aiErr.kind === 'rate_limit') {
			const failedProvider = hasTools ? resolvedToolProviderId : (activeInfo?.id ?? null);
			if (failedProvider) markCooldown(failedProvider);
		}

		if (['unavailable', 'timeout', 'unknown', 'rate_limit'].includes(aiErr.kind)) {
			const fallbackTools = wantsTools ? (deskTools ?? createDeskTools(userId, toolScopes, deskLayout)) : undefined;
			const fallbackResponse = tryFallback(
				baseSystemPrompt,
				messages,
				conversationId,
				userId,
				resolvedFallbacks,
				wantsTools,
				fallbackTools,
				toolScopes,
			);
			if (fallbackResponse) return fallbackResponse;
		}

		return Response.json(
			{ error: { code: aiErr.kind, message: safeAIMessage(aiErr.kind) } },
			{ status: aiErrorToStatus(aiErr.kind), headers: { 'X-AI-Error-Kind': aiErr.kind } },
		);
	}
}
