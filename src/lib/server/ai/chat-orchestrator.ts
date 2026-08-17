/**
 * Chat orchestration — domain module.
 * Handles conversation management, retrieval integration, streaming, and fallback rotation.
 * No SvelteKit imports — reusable from AI tools, REST, and background jobs.
 */
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	type LanguageModel,
	type LanguageModelUsage,
	type ModelMessage,
	stepCountIs,
	streamText,
	type UIMessage,
} from 'ai';
import type { SearchLocale, SearchResult } from '$lib/search/types';
import { getActiveProvider, getActiveProviderInfo, getFallbacksForUser, getToolProvider } from '$lib/server/ai';
import { chargeTokens } from '$lib/server/ai/budget';
import { CHATBOT_MAX_STEPS, MAX_TOKENS } from '$lib/server/ai/config';
import {
	buildPromptAssembledEvent,
	buildSystemPrompt,
	getMessageText,
	windowMessages,
} from '$lib/server/ai/context/system-prompt';
import { assembleChatbotContext } from '$lib/server/ai/context-assembly';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { compactToolResults, DEFAULT_BUDGET, runWithCompaction } from '$lib/server/ai/loop/compact';
import { hasDestructiveIntent, shouldRequirePlan } from '$lib/server/ai/policy';
import { incrProvider429 } from '$lib/server/ai/provider-usage';
import type { ProviderEntry } from '$lib/server/ai/providers';
import { isCooledDown, markCooldown } from '$lib/server/ai/providers';
import {
	buildRetrievalTools,
	createDeskTools,
	type DeskToolScope,
	getToolRisk,
	stepsForScopes,
} from '$lib/server/ai/tools';
import { isAdminUserId as isAdminUser } from '$lib/server/auth/admin-ids';
import { checkConversationLimit } from '$lib/server/db/ai/limits';
import {
	createConversation,
	refreshConversationTokens,
	saveConversationStep,
	saveMessages,
	saveToolCall,
	updateMessageContent,
} from '$lib/server/db/ai/mutations';
import { createProposal, getProposal } from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { DbError, safeDbMessage } from '$lib/server/db/errors';
import type { ProposalExecutionResult, ProposedToolCall } from '$lib/server/db/schema/ai/proposal';
import { MAX_RAWRAG_TOOL_CALLS_PER_TURN, verifyCitations } from '$lib/server/llmwiki';
import { buildSearchIndex, type PageContext } from '$lib/server/search';
import {
	LANE_OF,
	type LlmwikiCitationsEvent,
	PHASE_OF,
	type PipelineChunksEvent,
	type PipelinePromptEvent,
	type PipelineStepEvent,
} from '$lib/types/pipeline';
import {
	type AttemptFailure,
	type PumpableTextResult,
	streamTextIntoOpenMessage,
	type TurnAttempt,
} from './_shared/streaming-turn';
import { verifyCatalogCitations } from './catalog-citations';
import { shapeDrilledCitations } from './citations/drill';
import { createToolLeakGuard, stripTextualToolCall } from './tool-leak-guard';

/** A legacy simple message or a full UIMessage from the AI SDK v6 client. */
export type ChatMessage = { role: 'user' | 'assistant'; content: string } | UIMessage;

/**
 * Which AI surface a turn belongs to — the explicit dispatch discriminant.
 * - `chatbot`  — the v10r expert: read-only, grounded, citation-faithful Q&A.
 * - `deskbot`  — the in-desk operator: agentic, mutating, plan-gated UI parity.
 */
export type TurnSurface = 'chatbot' | 'deskbot';

/**
 * A `pipeline:step` event as authored at a call site. The emit closures stamp the
 * derived axes (`phase` via PHASE_OF, `lane` via LANE_OF), the stable `instanceKey`,
 * and the turn `requestId`, so literals stay terse and can't drift from the registry.
 */
type RawStepInput = Omit<PipelineStepEvent, 'phase' | 'instanceKey' | 'requestId'> & {
	instanceKey?: string;
};

export interface ChatInput {
	userId: string;
	/**
	 * Explicit surface discriminant, set by the per-surface routes. A retrieval
	 * (chatbot) turn additionally requires a fresh user turn — anything else degrades
	 * to the plain deskbot streaming path.
	 */
	surface: TurnSurface;
	providerId?: string;
	messages: ChatMessage[];
	conversationId?: string;
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
	 * The orchestrator looks up the proposal's cached `executionResult`, injects
	 * a `<plan-execution-result>` block into the system prompt, strips the
	 * `[resumeFromProposalId:...]` sentinel from the user message, and skips
	 * llmwiki/retrieval branches for the turn. Stale or invalid ids degrade
	 * silently to a normal turn (the user already saw their plan execute —
	 * a 500 here would be hostile).
	 */
	resumeFromProposalId?: string;
	/** Resolved request locale (server-derived from `event.locals.locale`). Used by `search_catalog`. */
	locale?: SearchLocale;
	/** Auth ceiling for catalog visibility (server-derived via `isAdmin()` — never a DB column). */
	authCeiling?: string | null;
	/**
	 * Site-awareness (chatbot only): the page the user is asking from, ALREADY resolved
	 * server-side at the route boundary (`resolvePageContext`) to trusted catalog metadata.
	 * Null when the route didn't resolve (unknown/dynamic/private). Drives the passive
	 * `<current-page>` block + the deixis-gated retrieval seed. See `site-awareness.md`.
	 */
	pageContext?: PageContext | null;
}

interface ChatError {
	type: 'error';
	status: number;
	code: string;
	message: string;
}

// System-prompt assembly, message windowing, and XML escape helpers live in
// `src/lib/server/ai/context/system-prompt.ts`.

/** Persist assistant message after stream finishes; charge token budget. */
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
				const inputTokens = totalUsage.inputTokens ?? 0;
				const outputTokens = totalUsage.outputTokens ?? 0;
				console.info('[ai:chat] totalUsage:', { inputTokens, outputTokens });
				await chargeTokens(userId, inputTokens + outputTokens);
			}
		} catch (err) {
			console.error('[ai:chat] Failed to finalize stream:', {
				conversationId,
				error: err instanceof Error ? err.message : err,
			});
		}
	};
}

/**
 * Format a proposal's cached execution result into a human-readable summary block
 * the model can ingest as `<plan-execution-result>` context on a resume turn.
 */
function formatExecutionSummary(proposalId: string, result: ProposalExecutionResult | null): string {
	if (!result || !result.results.length) {
		return `Plan ${proposalId} executed (no step output recorded).`;
	}
	const lines: string[] = [`Plan ${proposalId} executed:`];
	for (const step of result.results) {
		if (step.ok) {
			const out = step.output ? JSON.stringify(step.output) : 'ok';
			lines.push(`- ${step.toolName} → ok: ${out}`);
		} else {
			lines.push(`- ${step.toolName} → FAILED: ${step.errorMessage ?? 'unknown error'}`);
		}
	}
	return lines.join('\n');
}

/**
 * Resolve a resume-from-proposal turn. Returns `null` if not a resume, or if the
 * lookup/ownership/status checks fail (in which case the orchestrator proceeds
 * as a normal turn — a stale or invalid id should not 500 the user's chat).
 *
 * Mutates `windowedMessages` in place: when the last user message is the
 * `[resumeFromProposalId:X]` sentinel, replaces its text with a clean
 * "I approved the plan." so the persisted log isn't polluted.
 */
async function resolveResumeContext(
	userId: string,
	resumeFromProposalId: string | undefined,
	existingConvId: string | undefined,
	windowedMessages: ChatMessage[],
): Promise<{ summary: string } | null> {
	if (!resumeFromProposalId) return null;
	if (!existingConvId) {
		console.warn('[ai:chat:resume] resumeFromProposalId without conversationId — ignored');
		return null;
	}

	const proposal = await getProposal(resumeFromProposalId);
	if (!proposal) {
		console.warn(`[ai:chat:resume] proposal ${resumeFromProposalId} not found`);
		return null;
	}
	if (proposal.conversationId !== existingConvId) {
		console.warn(`[ai:chat:resume] proposal ${resumeFromProposalId} belongs to a different conversation`);
		return null;
	}
	const conv = await getConversation(proposal.conversationId, userId);
	if (!conv) {
		console.warn(`[ai:chat:resume] proposal ${resumeFromProposalId} not owned by user`);
		return null;
	}
	if (proposal.status !== 'executed') {
		console.warn(`[ai:chat:resume] proposal ${resumeFromProposalId} status is ${proposal.status} (need executed)`);
		return null;
	}

	// Strip the `[resumeFromProposalId:X]` sentinel from the last user message
	// so the persisted conversation log shows clean text, not a control marker.
	const sentinel = `[resumeFromProposalId:${resumeFromProposalId}]`;
	const cleanText = 'I approved the plan.';
	const idx = windowedMessages.length - 1;
	const last = windowedMessages[idx];
	if (last?.role === 'user' && getMessageText(last) === sentinel) {
		if ('parts' in last) {
			const parts = last.parts.map((p) => (p.type === 'text' ? { ...p, text: cleanText } : p));
			windowedMessages[idx] = { ...last, parts };
		} else {
			windowedMessages[idx] = { ...last, content: cleanText };
		}
	}

	return { summary: formatExecutionSummary(proposal.id, proposal.executionResult) };
}

/** Resolve or auto-create the conversation. Returns conversationId or error. */
async function resolveConversation(
	userId: string,
	existingConvId: string | undefined,
	messages: ChatInput['messages'],
	surface?: 'chatbot' | 'deskbot',
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
	const conv = await createConversation(userId, title, surface);
	return { conversationId: conv.id };
}

/** Attempt streaming with fallback providers on transient errors. */
async function tryFallback(
	baseSystemPrompt: string,
	messages: ModelMessage[],
	conversationId: string | undefined,
	userId: string,
	fallbacks: ProviderEntry[],
	wantsTools = false,
	deskTools?: ReturnType<typeof createDeskTools>,
	toolScopes?: DeskToolScope[],
): Promise<Response | null> {
	for (const fallback of fallbacks) {
		if (await isCooledDown(fallback.id)) continue;
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
					if (aiErr.kind === 'rate_limit') {
						void markCooldown(fallback.id);
						void incrProvider429(fallback.id);
					}
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
 * Honest tool degrade — pick a tool-capable provider that can actually serve THIS turn.
 *
 * The previous check looked only at the resolved tool provider: one cooled provider silently
 * dropped every retrieval/desk tool for the turn even though another configured, tool-capable
 * provider sat idle. Scan in preference order (resolved tool provider first, then the configured
 * fallbacks) and take the first that is configured, tool-capable, not cooled, and instantiable.
 *
 * Returns null ONLY when every tool-capable provider is cooled — the one case where the turn
 * genuinely has to run tool-less (and must then say so rather than pretend it searched).
 */
async function resolveAvailableToolProvider(
	preferred: ProviderEntry | null,
	fallbacks: ProviderEntry[],
): Promise<{ provider: ProviderEntry; model: LanguageModel } | null> {
	const ordered: ProviderEntry[] = [];
	if (preferred) ordered.push(preferred);
	for (const f of fallbacks) {
		if (f.supportsTools && !ordered.some((p) => p.id === f.id)) ordered.push(f);
	}
	for (const entry of ordered) {
		if (!entry.configured || !entry.supportsTools) continue;
		if (await isCooledDown(entry.id)) continue;
		const instance = entry.getInstance();
		if (instance) return { provider: entry, model: instance };
	}
	return null;
}

/**
 * Build the current-turn attempt chain for a streaming branch: the primary provider first, then
 * every configured fallback that can serve this turn. `run()` stays lazy per entry — `streamText`
 * fires on call and `AbortSignal.timeout()` is single-use, so each attempt must mint its own call.
 */
function buildTurnAttempts(
	primary: { providerId: string | null; modelId: string | null; model: LanguageModel },
	fallbacks: ProviderEntry[],
	makeStream: (model: LanguageModel) => PumpableTextResult,
	requireTools: boolean,
): TurnAttempt[] {
	const attempts: TurnAttempt[] = [
		{ providerId: primary.providerId, modelId: primary.modelId, run: () => makeStream(primary.model) },
	];
	for (const f of fallbacks) {
		if (requireTools && !f.supportsTools) continue;
		// `getFallbacksForUser` only excludes the active CHAT provider, so on a tool-routed turn the
		// primary can appear here — never re-attempt the provider that just failed.
		if (attempts.some((a) => a.providerId === f.id)) continue;
		const instance = f.getInstance();
		if (!instance) continue;
		attempts.push({ providerId: f.id, modelId: f.model, run: () => makeStream(instance) });
	}
	return attempts;
}

/**
 * Resolve conversation, optionally retrieve context, stream the response, persist
 * messages. Returns a streaming Response or error JSON.
 *
 * The whole request runs inside a compaction context so tool results above the
 * budget are replaced with refs the model pulls back via `resolve_ref` — the
 * AI SDK #9631 workaround.
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
		llmwikiCollectionId,
		panelContext,
		toolScopes,
		deskLayout,
		activeWorkspace,
		resumeFromProposalId,
		locale,
		authCeiling,
		pageContext,
	} = input;
	const catalogLocale: SearchLocale = locale ?? 'en';

	// Window conversation history to prevent context overflow in multi-turn chats.
	// Cloned to a mutable array so resume injection can rewrite the sentinel user message.
	const windowedMessages = [...windowMessages(rawMessages)];

	// Resume-from-approval: lookup the executed proposal, strip the sentinel from the
	// user message, and prepare a context block for the system prompt. Returns null on
	// any failed lookup/ownership/status check (resume turns silently degrade to a normal
	// turn rather than 500ing the user mid-flow).
	const resumeContext = await resolveResumeContext(userId, resumeFromProposalId, existingConvId, windowedMessages);

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
	const resolvedFallbacks = getFallbacksForUser(userId, providerId);

	if (!resolvedChatModel) {
		return Response.json({ error: { code: 'ai_unavailable', message: 'No AI provider configured.' } }, { status: 503 });
	}

	// Use tool-capable provider when tools requested, fall back to chatModel without tools.
	// The llmwiki + rawrag retrieval branches attach their own tools (search_catalog, llmwiki/
	// rawrag drill-down) even without desk scopes, so they must route to the tool-capable model
	// too — otherwise grounding tool calls run on the chat model and silently fail to fire.
	const wantsTools = !!toolScopes?.length || input.surface === 'chatbot';
	const availableToolProvider = wantsTools
		? await resolveAvailableToolProvider(resolvedToolProvider, resolvedFallbacks)
		: null;
	const hasTools = wantsTools && !!availableToolProvider;
	const model = availableToolProvider?.model ?? resolvedChatModel;
	// Desk tools only for actual desk scopes — the llmwiki/rawrag branches set hasTools (to claim
	// the tool model) but bring their own retrieval tools and pass no desk scopes.
	// On a resume-from-proposal turn the approved plan has ALREADY executed via the
	// deterministic approve-route replay — this turn's only job is to acknowledge it.
	// Strip mutating scopes so the model physically cannot re-run or diverge from the
	// approved plan: approval binds execution. Read tools stay so it can still verify.
	const effectiveToolScopes =
		resumeContext && toolScopes ? toolScopes.filter((s) => s === 'desk:read' || s === 'desk:ask') : toolScopes;
	const deskTools =
		hasTools && effectiveToolScopes?.length ? createDeskTools(userId, effectiveToolScopes, deskLayout) : undefined;
	// Resolved provider/model attribution for per-step telemetry (conversation_step) and for the
	// stream-error circuit breaker. MUTABLE: the chatbot branch rotates providers mid-turn
	// (see `streamTextIntoOpenMessage`), and every reader below must attribute the failure/step to
	// the provider that is actually running, not the one the turn started on.
	let currentProviderId = hasTools ? (availableToolProvider?.provider.id ?? null) : (activeInfo?.id ?? null);
	let currentModelId = hasTools ? (availableToolProvider?.provider.model ?? null) : (activeInfo?.model ?? null);
	const grantedScopes = toolScopes ?? [];
	const lastRawMsg = windowedMessages[windowedMessages.length - 1];
	const userMsgText = lastRawMsg?.role === 'user' ? getMessageText(lastRawMsg) : '';

	// One named dispatch decision. The routes set `input.surface` explicitly; the chatbot
	// (retrieval) branch additionally requires a fresh user turn — resume turns degrade to
	// the plain deskbot streaming path. Computed BEFORE conversation resolution so it can
	// be stamped on the conversation at creation.
	const isFreshUserTurn = lastRawMsg?.role === 'user' && !!userMsgText && !resumeContext;
	const surface: TurnSurface = isFreshUserTurn && input.surface === 'chatbot' ? 'chatbot' : 'deskbot';

	// Plan-before-execute gate (policy/governor.ts)
	// Pre-turn estimate of whether this is a destructive, multi-capability, multi-target
	// desk turn that must produce a plan first. Wiring it is what makes the `<planning>`
	// block inject and `desk_propose_plan` reachable. Deliberately conservative and
	// tunable; it activates more as the deskbot grows structural tools. Chatbot turns have
	// no mutating scopes → false. "Structural" (create/delete) is the destructive surface;
	// in-place content writes (desk:write) are not.
	const hasMutatingScopeGranted = grantedScopes.some(
		(s) => s === 'desk:write' || s === 'desk:create' || s === 'desk:delete',
	);
	const requirePlan = shouldRequirePlan({
		mutatingScopeGranted: hasMutatingScopeGranted,
		destructiveIntent: hasDestructiveIntent(userMsgText),
	});

	let baseSystemPrompt = buildSystemPrompt({ panelContext, toolScopes, deskLayout, activeWorkspace, requirePlan });
	if (resumeContext) {
		baseSystemPrompt = `${baseSystemPrompt}

<plan-execution-result>
${resumeContext.summary}
</plan-execution-result>

The user has just approved the plan above and the listed steps were executed. Acknowledge what was done in your reply and continue the conversation. Do NOT call \`desk_propose_plan\` again for the same goal.`;
	}

	// Resolve conversation (pass raw messages for title extraction; stamp the surface on
	// any newly-created conversation).
	let conversationId: string | undefined;
	{
		const convResult = await resolveConversation(userId, existingConvId, windowedMessages, surface);
		if ('type' in convResult) {
			const err = convResult as ChatError;
			return Response.json(
				{ error: { code: err.code, message: err.message } },
				{ status: err.status, headers: { 'X-AI-Error-Kind': err.code } },
			);
		}
		conversationId = convResult.conversationId;
	}

	// Save user message. Site-awareness: stamp the resolved route on the user row (chatbot turns
	// only; pageContext is null elsewhere) for the per-bubble "asked from" tag — display metadata,
	// never replayed into a later prompt.
	if (conversationId && lastRawMsg?.role === 'user' && userMsgText) {
		await saveMessages(conversationId, userId, [
			{ id: crypto.randomUUID(), role: 'user', content: userMsgText, route: pageContext?.path ?? null },
		]);
	}

	const responseHeaders: Record<string, string> = {};
	if (conversationId) responseHeaders['X-Conversation-Id'] = conversationId;

	/** Classify a stream error and return a `[kind] user-safe message` string.
	 *  The client parses the `[kind]` prefix to drive error UI and IO log. */
	function classifyStreamError(error: unknown): string {
		const aiErr = classifyAIError(error);
		console.error(`[ai:chat] Stream error [${aiErr.kind}]:`, error);

		// Circuit breaker for rate limits during streaming. This is the FINAL-failure path: the
		// streaming helper only rethrows once no eligible provider is left, and it cools the
		// providers it rotated away from itself — so reading the mutable `currentProviderId` here
		// cools the provider that actually died last, with no double count.
		if (aiErr.kind === 'rate_limit') {
			const failedProvider = currentProviderId;
			if (failedProvider) {
				void markCooldown(failedProvider);
				void incrProvider429(failedProvider);
			}
		}

		return `[${aiErr.kind}] ${safeAIMessage(aiErr.kind)}`;
	}

	try {
		// chatbot (llmwiki) path — primary answer surface; exposes drill-down tools for rawrag.
		// Resume turns skip retrieval branches: the model just needs to acknowledge the
		// executed plan from `<plan-execution-result>`, not re-search for context.
		if (surface === 'chatbot') {
			const collectionId = llmwikiCollectionId ?? null;
			const {
				tools: retrievalTools,
				drilledChunks,
				surfacedCatalog,
			} = buildRetrievalTools(userId, catalogLocale, authCeiling ?? null);
			const requestId = crypto.randomUUID();

			const stream = createUIMessageStream({
				execute: async ({ writer }) => {
					// Open the assistant message frame BEFORE any `message-metadata` write.
					// This branch emits pipeline metadata before the merged text stream's own
					// `start`; without an explicit leading `start` the v6 client materializes a
					// FIRST (empty) assistant message to hold that early metadata, then the merge's
					// own `start` (different id) appends a SECOND. One `start` up front → one message.
					// Reusing this id for the merged stream (via `sendStart: false`) also makes the
					// client message id match the persisted DB row.
					const assistantMsgId = crypto.randomUUID();
					if (conversationId) {
						await saveMessages(conversationId, userId, [{ id: assistantMsgId, role: 'assistant', content: '' }]);
					}
					writer.write({ type: 'start', messageId: assistantMsgId });

					// Turn t0 — one origin for every step's startOffsetMs (retrieve + generate share it),
					// so the waterfall renders true parallel overlap. See nrag-observability.md.
					const t0 = performance.now();

					let systemPrompt = baseSystemPrompt;
					let toolCallCount = 0;
					// Gate the full prompt TEXT to dev builds OR real admins (ADMIN_USER_ID); never the
					// token counts. Was DEV-only, so admins saw nothing in prod.
					const isDevOrAdmin = !!import.meta.env?.DEV || isAdminUser(userId);

					type AnyLlmwikiEvent = PipelineStepEvent | PipelineChunksEvent | PipelinePromptEvent | LlmwikiCitationsEvent;
					const pipelineEvents: AnyLlmwikiEvent[] = [];
					// Enumerable context blocks injected into the system prompt (llmwiki pages + system-docs
					// chunks) for the Tokens-pane per-block breakdown. The honest aggregate (Context = the
					// full injected delta) is computed at emit time, after the prompt is fully assembled.
					const promptContextBlocks: { chunkId: string; tokens: number }[] = [];
					// Mirror rawrag's citations extra payload so existing consumers still read it.
					let citationsPayload: {
						citations: Array<{ chunkId: string; verification: string; tier: 'rawrag' }>;
						driftedChunkIds: string[];
					} | null = null;
					// Evidence chips: the original drilled chunks (content + verdict + level)
					// the floating chatbot renders as a "View N sources" affordance.
					let sourceChunksPayload: {
						sourceChunks: Awaited<ReturnType<typeof shapeDrilledCitations>>;
					} | null = null;
					// Catalog chips (surfaces the answer linked to) + surface-citation verdicts.
					let catalogPayload: {
						catalogSources: Array<
							Pick<SearchResult, 'surface' | 'title' | 'path' | 'anchor' | 'breadcrumb' | 'icon' | 'badge' | 'locale'>
						>;
						catalogCitations: ReturnType<typeof verifyCatalogCitations>;
					} | null = null;

					const flush = () => {
						const meta: Record<string, unknown> = { pipeline: pipelineEvents };
						if (citationsPayload) Object.assign(meta, citationsPayload);
						if (sourceChunksPayload) Object.assign(meta, sourceChunksPayload);
						if (catalogPayload) Object.assign(meta, catalogPayload);
						writer.write({ type: 'message-metadata', messageMetadata: meta });
					};
					// Step events are authored as raw literals (step/status/offset/detail); this
					// closure stamps the derived axes (phase/lane), the stable instanceKey, and the
					// turn requestId so every literal stays terse and can't drift from PHASE_OF/LANE_OF.
					const emit = (event: RawStepInput | PipelineChunksEvent | PipelinePromptEvent | LlmwikiCitationsEvent) => {
						if (event.type === 'pipeline:step') {
							pipelineEvents.push({
								...event,
								phase: PHASE_OF[event.step],
								instanceKey: event.instanceKey ?? event.step,
								lane: event.lane ?? LANE_OF[event.step],
								requestId,
							});
						} else {
							event.requestId = requestId;
							pipelineEvents.push(event);
						}
						flush();
					};

					// ONE DOOR: the gates → shared embed → llmwiki/system-docs retrieval → block
					// assembly all live in context-assembly.ts, shared verbatim with the
					// /api/ai/context-probe endpoint (the showcase x-ray) so the probe cannot
					// drift from production. Telemetry streams through this turn's `emit`.
					const assembly = await assembleChatbotContext(
						{
							userId,
							userMsgText,
							baseSystemPrompt,
							collectionId,
							pageContext: pageContext ?? null,
							catalogLocale,
							hasTools,
						},
						{ emit, t0 },
					);
					systemPrompt = assembly.systemPrompt;
					promptContextBlocks.push(...assembly.promptContextBlocks);

					// Prompt assembled — emitted AFTER every context injection (llmwiki + project-overview +
					// system-docs + current-page + catalog) so `systemPromptTokens` reflects the FULL prompt
					// and the injected context is attributed to "Context", not "prompt overhead". `totalTokens`
					// is the whole injected delta (full prompt − base); `contextBlocks` enumerates what it can.
					emit(
						buildPromptAssembledEvent({
							userPrompt: userMsgText,
							systemPrompt,
							contextBlocks: promptContextBlocks,
							totalTokens: Math.ceil(Math.max(0, systemPrompt.length - baseSystemPrompt.length) / 4),
							isDevOrAdmin,
						}),
					);

					const generateStart = performance.now();
					emit({
						type: 'pipeline:step',
						step: 'generate',
						status: 'active',
						startOffsetMs: Math.round(generateStart - t0),
					});

					// `assistantMsgId` was created + persisted at the top of `execute` (so the
					// `start` frame can carry it and conversation_step.messageId has a valid FK);
					// its content is backfilled in onFinish (mirrors the desk branch).
					let stepCounter = 0;
					let lastStepAt = generateStart;

					// Tools are SPREAD, not passed unconditionally: when every tool-capable provider is
					// cooled (`hasTools === false`) the turn must run genuinely tool-less. Mounting
					// tools on a cooled-out turn is what produced "I searched the catalog…" answers
					// with zero tool calls behind them. Paired with the honest-degrade NOTE above.
					const toolOpts = hasTools
						? { tools: retrievalTools, toolChoice: 'auto' as const, stopWhen: stepCountIs(CHATBOT_MAX_STEPS) }
						: {};

					// A fresh `streamText` per attempt — the call fires on invocation and
					// `AbortSignal.timeout()` is single-use, so a fallback cannot reuse the primary's.
					const makeStream = (attemptModel: LanguageModel) =>
						streamText({
							model: attemptModel,
							system: systemPrompt,
							messages,
							...toolOpts,
							maxRetries: 0,
							maxOutputTokens: MAX_TOKENS,
							abortSignal: AbortSignal.timeout(30_000),
							// Net for Groq/llama emitting a tool call as plain text (`<function=…>`).
							// Suppresses the raw markup so the user never reads it; the turn degrades
							// to empty instead of leaking syntax. See `tool-leak-guard.ts`.
							experimental_transform: createToolLeakGuard((lead) =>
								console.warn(`[ai:chat:llmwiki] suppressed textual tool-call leak: ${lead}…`),
							),
							onStepFinish: async ({
								toolCalls,
								toolResults,
								usage,
							}: {
								toolCalls?: Array<{ toolName: string; args?: { ids?: string[] } }>;
								toolResults?: Array<{ toolName: string; result?: { chunks?: unknown[] } }>;
								usage?: { inputTokens?: number; outputTokens?: number };
							}) => {
								if (toolCalls) {
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
											// Unique per drill so the waterfall keys 0–3 distinct ticks (avoids each_key_duplicate).
											instanceKey: `drill#${callIndex}`,
											status: 'done',
											// Point tick nested by time inside the generate bar (we don't measure per-tool latency).
											startOffsetMs: Math.round(performance.now() - t0),
											detail: {
												kind: 'drill',
												callIndex: callIndex <= 2 ? callIndex : 2,
												idsRequested,
												chunksReturned,
											},
										});
									}
								}
								// Persist the step so the chatbot's usage shows up in "usage by model".
								if (conversationId) {
									const stepIndex = stepCounter++;
									const nowT = performance.now();
									const durationMs = Math.round(nowT - lastStepAt);
									lastStepAt = nowT;
									try {
										await saveConversationStep({
											conversationId,
											messageId: assistantMsgId,
											stepIndex,
											stepType: stepIndex === 0 ? 'initial' : 'tool-result',
											surface,
											inputTokens: usage?.inputTokens ?? 0,
											outputTokens: usage?.outputTokens ?? 0,
											providerId: currentProviderId,
											modelId: currentModelId,
											durationMs,
										});
									} catch (err) {
										console.error('[ai:chat:llmwiki] Failed to persist step:', err);
									}
								}
							},
							onError: ({ error }) => {
								console.error('[ai:chat:llmwiki] Stream error:', error);
								// Terminal for generate — without this a provider 503 / 30s abort leaves the
								// bar stuck `active` forever. Client also has a finalizeActive() backstop, but
								// emit here so the error reason is visible.
								emit({
									type: 'pipeline:step',
									step: 'generate',
									status: 'error',
									durationMs: Math.round(performance.now() - generateStart),
									error: error instanceof Error ? error.message : String(error),
								});
							},
						});

					// Post-text work runs while the assistant message is still OPEN (the streaming helper
					// closes it with a single `finish` only after this resolves) — so the citation/catalog
					// metadata flushed here lands on the right message instead of after the `finish` frame.
					const afterText = async (rawText: string, totalUsage: LanguageModelUsage) => {
						// Mirror the stream guard: if the whole turn was a textual tool-call
						// leak (`<function=…>`), blank it before persistence / citation
						// verification so the leak isn't saved or counted as an answer.
						const text = stripTextualToolCall(rawText);
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
								emit({
									type: 'pipeline:step',
									step: 'llmwiki:verify',
									status: 'active',
									startOffsetMs: Math.round(verifyStart - t0),
								});
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
								sourceChunksPayload = {
									sourceChunks: await shapeDrilledCitations(userId, Array.from(drilledChunks), verifications),
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
						// Surface-citation verification — ground the citation chips and flag any
						// project path the model emitted that search_catalog did not surface this turn.
						try {
							if (surfacedCatalog.size > 0) {
								const surfaced = Array.from(surfacedCatalog.values());
								const surfacedPaths = new Set(surfaced.map((r) => r.path));
								const knownPaths = new Set(buildSearchIndex(catalogLocale).map((r) => r.path));
								const catalogCitations = verifyCatalogCitations(text, surfacedPaths, knownPaths);
								// Chips: only the surfaces the answer actually references, collapsed to
								// one chip per unique (path, anchor). Docs retrieval surfaces several
								// CHUNKS of the same doc → identical paths; the keyed {#each} in
								// ChatMessage (keyed by path+anchor) would throw each_key_duplicate,
								// crashing the chip row AND wedging the loading state. Keep best score.
								const cited = surfaced.filter((r) => text.includes(r.path));
								const bySurface = new Map<string, (typeof cited)[number]>();
								for (const r of cited) {
									const key = `${r.path}\u0000${r.anchor ?? ''}`;
									const prev = bySurface.get(key);
									if (!prev || (r.score ?? 0) > (prev.score ?? 0)) bySurface.set(key, r);
								}
								catalogPayload = {
									catalogSources: Array.from(bySurface.values()).map((r) => ({
										surface: r.surface,
										title: r.title,
										path: r.path,
										anchor: r.anchor,
										breadcrumb: r.breadcrumb,
										icon: r.icon,
										badge: r.badge,
										locale: r.locale,
									})),
									catalogCitations,
								};
								flush();
							}
						} catch (err) {
							console.error('[ai:chat:catalog] Surface-citation verification failed:', err);
						}
						// Backfill the pre-created assistant message + refresh cached token totals
						// (steps were persisted in onStepFinish). Keep charging the Redis budget.
						if (conversationId) {
							try {
								await updateMessageContent(assistantMsgId, text);
								await refreshConversationTokens(conversationId);
							} catch (err) {
								console.error('[ai:chat:llmwiki] Failed to finalize:', err);
							}
						}
						if (totalUsage) {
							await chargeTokens(userId, (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0));
						}
					};
					// Current-turn provider rotation: primary first, then every configured fallback that
					// can still serve this turn. `requireTools` keeps a tool-mounted turn off a
					// tool-incapable provider (which would silently answer without ever searching).
					const attempts = buildTurnAttempts(
						{ providerId: currentProviderId, modelId: currentModelId, model },
						resolvedFallbacks,
						makeStream,
						hasTools,
					);

					// Pump text into the open message, run afterText, then close — citation/catalog/persist
					// metadata flushes BEFORE the finish frame (fixes the empty-answer / answer⟷trace desync).
					await streamTextIntoOpenMessage(writer, attempts, afterText, {
						isSkipped: (id) => (id ? isCooledDown(id) : Promise.resolve(false)),
						onAttemptStart: (attempt) => {
							// Re-point step telemetry at the provider actually running this attempt.
							currentProviderId = attempt.providerId;
							currentModelId = attempt.modelId;
						},
						onAttemptFailure: async ({ providerId: failedId, error, willRetry }: AttemptFailure) => {
							const aiErr = classifyAIError(error);
							console.error(
								`[ai:chat:llmwiki] attempt failed provider=${failedId ?? 'unknown'} kind=${aiErr.kind} willRetry=${willRetry}:`,
								error,
							);
							// Retry-path cooldown only. A FINAL failure rethrows into classifyStreamError,
							// which owns the cooldown for it — cooling here too would double-count the 429.
							if (!willRetry) return;
							if (aiErr.kind === 'rate_limit' && failedId) {
								void markCooldown(failedId);
								void incrProvider429(failedId);
							}
							// streamText's own onError already painted the generate bar `error`; re-open it
							// so the waterfall shows the turn recovering onto the next provider.
							emit({
								type: 'pipeline:step',
								step: 'generate',
								status: 'active',
								startOffsetMs: Math.round(generateStart - t0),
							});
						},
					});
				},
				onError: classifyStreamError,
			});
			return createUIMessageStreamResponse({ stream, headers: responseHeaders });
		}

		// deskbot (non-retrieval) path — the surface === 'deskbot' fallthrough. Also handles
		// resume turns and any non-fresh turn. Wrapped in createUIMessageStream for classified
		// error handling.
		const assistantMsgId = crypto.randomUUID();
		if (conversationId) {
			await saveMessages(conversationId, userId, [{ id: assistantMsgId, role: 'assistant', content: '' }]);
		}
		let stepCounter = 0;
		let lastStepAt = performance.now();

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
					// Net for Groq/llama emitting a tool call as plain text (`<function=…>`).
					// The desk branch routes to the SAME tool-capable provider as the chatbot
					// branch (which already guards at the llmwiki stream), so without this a
					// Groq-routed desk turn leaks raw tool-call markup into the UI.
					experimental_transform: createToolLeakGuard((lead) =>
						console.warn(`[ai:chat:desk] suppressed textual tool-call leak: ${lead}…`),
					),
				};
				if (deskTools) {
					streamOpts.tools = deskTools;
					streamOpts.toolChoice = 'auto';
					streamOpts.stopWhen = stepCountIs(stepsForScopes(toolScopes ?? []));
					// Compaction deliberately does NOT hook `prepareStep`: AI SDK #9631 silently
					// drops message mutations returned from it. It runs at tool-execute time via
					// `wrapToolsWithCompaction` inside `createDeskTools`, with the whole request
					// inside a `runWithCompaction` context (below) so refs resolve consistently.
				}
				type ToolResultRecord = {
					toolName: string;
					input?: unknown;
					output?: unknown;
				};
				streamOpts.onStepFinish = async ({
					toolResults,
					usage,
				}: {
					toolResults?: ToolResultRecord[];
					usage?: { inputTokens: number; outputTokens: number };
				}) => {
					if (!conversationId) return;
					const currentStep = stepCounter++;

					const toolCallIds: string[] = [];
					// Single-op approval accumulator: write/destructive desk tools return a
					// `requiresApproval` sentinel instead of mutating; collect them and flush ONE
					// pending proposal per step (below).
					const pendingApproval: ProposedToolCall[] = [];
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

								// HARD-GATE sentinel: a write/destructive desk tool refused to mutate in-loop
								// and asked for approval. Queue it for a single-op proposal. Args come from the
								// tool CALL input (tr.input), which — unlike the output — is never compaction-wrapped.
								const gatedOut = tr.output as { requiresApproval?: boolean; action?: string } | undefined;
								if (gatedOut?.requiresApproval === true) {
									pendingApproval.push({
										toolName: tr.toolName,
										args: (tr.input ?? {}) as Record<string, unknown>,
										rationale: gatedOut.action ?? tr.toolName,
									});
								}

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
											steps: Array<{
												action: string;
												tool: string;
												risk: string;
												rationale: string;
												args?: Record<string, unknown>;
											}>;
											estimated_writes: number;
											rollback: string;
										};
										const proposal = await createProposal({
											conversationId,
											messageId: assistantMsgId,
											// Freeze the grant the plan was proposed under. The approve route
											// replays these, never scopes sent with the approval request.
											grantedScopes,
											riskTier: input.steps.some((s) => s.risk === 'destructive') ? 'high' : 'medium',
											payload: input.steps.map((s) => ({
												toolName: s.tool,
												// Carry the model's per-step args so the approve-route replay can
												// actually execute the approved plan (empty args → "File not found").
												args: s.args ?? {},
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

					// Flush the single-op approval gate: ONE pending proposal for all write/destructive
					// tool calls this step, reusing the SAME infra as desk_propose_plan (createProposal →
					// PlanCard → POST /api/ai/proposals/[id]/approve). The mutation runs ONLY via that
					// approve-route replay, which records a genuine approvedBy/approvedAt — never here.
					// `!harnessMetadata.proposal` yields to an explicit desk_propose_plan in the same step.
					if (pendingApproval.length > 0 && conversationId && !harnessMetadata.proposal) {
						try {
							const goal = pendingApproval.map((s) => s.rationale ?? s.toolName).join('; ');
							const anyDestructive = pendingApproval.some((s) => getToolRisk(s.toolName) === 'destructive');
							const proposal = await createProposal({
								conversationId,
								messageId: assistantMsgId,
								// Freeze the grant the plan was proposed under — see above.
								grantedScopes,
								riskTier: anyDestructive ? 'high' : 'medium',
								payload: pendingApproval,
								rationale: goal,
							});
							harnessMetadata.proposal = {
								id: proposal.id,
								goal,
								steps: pendingApproval.map((s) => ({
									action: s.rationale ?? s.toolName,
									tool: s.toolName,
									risk: getToolRisk(s.toolName) ?? 'write',
									rationale: s.rationale ?? '',
									args: s.args,
								})),
								estimatedWrites: pendingApproval.length,
								rollback: 'Recoverable from desk file revision history (restore for deletes).',
								riskTier: proposal.riskTier,
								status: 'pending',
							};
							writer.write({ type: 'message-metadata', messageMetadata: { harness: harnessMetadata } });
						} catch (err) {
							console.error('[ai:chat] Failed to persist single-op approval proposal:', err);
						}
					}

					const deskNowT = performance.now();
					const deskDurationMs = Math.round(deskNowT - lastStepAt);
					lastStepAt = deskNowT;
					try {
						await saveConversationStep({
							conversationId,
							messageId: assistantMsgId,
							stepIndex: currentStep,
							stepType: currentStep === 0 ? 'initial' : 'tool-result',
							surface,
							inputTokens: usage?.inputTokens ?? 0,
							outputTokens: usage?.outputTokens ?? 0,
							toolCallIds: toolCallIds.length > 0 ? toolCallIds : undefined,
							providerId: currentProviderId,
							modelId: currentModelId,
							durationMs: deskDurationMs,
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
		// Error hygiene: a DB failure is NOT an AI failure. `classifyAIError`'s substring rules
		// ('rate' → rate_limit, 'token' → context_length) cheerfully mislabel Postgres messages,
		// which then cooled a perfectly healthy provider and burned a fallback turn on an outage
		// no model can fix. Surface it honestly instead — no cooldown, no fallback.
		if (err instanceof DbError) {
			console.error('[ai:chat] DB failure surfaced through orchestrator:', err);
			return Response.json(
				{ error: { code: err.kind, message: safeDbMessage(err.kind) } },
				{ status: err.toStatus(), headers: { 'X-Error-Source': 'db' } },
			);
		}

		const aiErr = classifyAIError(err);

		// Circuit breaker: cooldown the provider that just failed with rate limit
		if (aiErr.kind === 'rate_limit') {
			const failedProvider = currentProviderId;
			if (failedProvider) {
				void markCooldown(failedProvider);
				void incrProvider429(failedProvider);
			}
		}

		// `unknown` is deliberately NOT in this allowlist: it is `classifyAIError`'s catch-all, so
		// falling back on it spent a second provider's quota re-running deterministic bugs (bad
		// tool schema, serialization failure) that every provider fails identically.
		if (['unavailable', 'timeout', 'rate_limit'].includes(aiErr.kind)) {
			// Per-surface fallback. Only a genuine DESK turn (real desk scopes) may mount desk
			// tools — calling createDeskTools with undefined scopes would mount an empty/wrong
			// toolset and contaminate the surface. A chatbot turn falls back tool-less on any
			// provider: ungrounded but honest.
			const isDeskTurn = !!toolScopes?.length;
			const fallbackTools = isDeskTurn
				? (deskTools ?? createDeskTools(userId, effectiveToolScopes ?? toolScopes, deskLayout))
				: undefined;
			const fallbackResponse = await tryFallback(
				baseSystemPrompt,
				messages,
				conversationId,
				userId,
				resolvedFallbacks,
				isDeskTurn,
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
