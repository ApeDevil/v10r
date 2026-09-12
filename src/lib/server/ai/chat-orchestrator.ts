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
import type { HarnessMetadata } from '$lib/components/composites/chatbot/harness-types';
import type { Locale } from '$lib/i18n';
import type { SearchResult } from '$lib/search/types';
import {
	getActiveProvider,
	getActiveProviderInfo,
	getToolProvider,
	type ProviderEntry,
	type ProviderRegistry,
} from '$lib/server/ai';
import { chargeTokens } from '$lib/server/ai/budget';
import { CHATBOT_GENERATION_OPTIONS, CHATBOT_MAX_STEPS, MAX_TOKENS } from '$lib/server/ai/config';
import {
	buildPromptAssembledEvent,
	buildSystemPrompt,
	getMessageText,
	windowMessages,
} from '$lib/server/ai/context/system-prompt';
import { assembleChatbotContext } from '$lib/server/ai/context-assembly';
import {
	type AiErrorKind,
	aiErrorFrameText,
	aiErrorToStatus,
	classifyAiError,
	safeAiMessage,
} from '$lib/server/ai/errors';
import { compactToolResults, DEFAULT_BUDGET, runWithCompaction } from '$lib/server/ai/loop/compact';
import { answerOnLastStep, hasDestructiveIntent, shouldRequirePlan } from '$lib/server/ai/policy';
import { incrProvider429 } from '$lib/server/ai/provider-usage';
import { isCooledDown, markCooldown } from '$lib/server/ai/providers';
import { buildRetrievalTools, createDeskTools, type DeskToolScope, stepsForScopes } from '$lib/server/ai/tools';
import type { ChatMessage, PanelContextEntry } from '$lib/server/ai/types';
import { isAdminUserId as isAdminUser } from '$lib/server/auth/admin-ids';
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
import { DbError, safeDbMessage } from '$lib/server/db/errors';
import { observedQueryCount } from '$lib/server/db/query-census';
import { type Cancellation, startCancellation } from '$lib/server/http/cancellation';
import type { Deadline } from '$lib/server/http/deadline';
import { MAX_SOURCE_CHUNK_TOOL_CALLS_PER_TURN, verifyCitations } from '$lib/server/llmwiki';
import { buildSearchIndex, type PageContext } from '$lib/server/search';
import type { AiSurface } from '$lib/types/db-enums';
import {
	type GenerateDetail,
	type LlmwikiCitationsEvent,
	PHASE_OF,
	RETRIEVER_OF,
	type RetrievalChunksEvent,
	type RetrievalPromptEvent,
	type RetrievalStepEvent,
} from '$lib/types/retrieval-trace';
import {
	type AttemptFailure,
	type PumpableTextResult,
	streamTextIntoOpenMessage,
	type TurnAttempt,
} from './_shared/streaming-turn';
import { verifyCatalogCitations } from './catalog-citations';
import { shapeDrilledCitations } from './citations/drill';
import { checkConversationLimit } from './conversation-quota';
import {
	collectApprovalRequests,
	isApprovalSentinel,
	riskTierOf,
	stoppedAtApproval,
	toCardSteps,
} from './proposals/approval-boundary';
import { createToolLeakGuard, stripTextualToolCall } from './tool-leak-guard';

/**
 * Which AI surface a turn belongs to — the explicit dispatch discriminant.
 * - `chatbot`  — the v10r expert: read-only, grounded, citation-faithful Q&A.
 * - `deskbot`  — the in-desk operator: agentic, mutating, plan-gated UI parity.
 */

/**
 * A `pipeline:step` event as authored at a call site. The emit closures stamp the
 * derived axes (`phase` via PHASE_OF, `lane` via RETRIEVER_OF), the stable `instanceKey`,
 * and the turn `requestId`, so literals stay terse and can't drift from the registry.
 */
type RawStepInput = Omit<RetrievalStepEvent, 'phase' | 'instanceKey' | 'requestId'> & {
	instanceKey?: string;
};

export interface ChatInput {
	userId: string;
	/**
	 * Explicit surface discriminant, set by the per-surface routes. A retrieval
	 * (chatbot) turn additionally requires a fresh user turn — anything else degrades
	 * to the plain deskbot streaming path.
	 */
	surface: AiSurface;
	/** The provider snapshot the entry guard loaded; every resolution in this turn uses it. */
	registry: ProviderRegistry;
	providerId?: string;
	messages: ChatMessage[];
	conversationId?: string;
	/** Optional collection scope for llmwiki search. `null` means global. */
	llmwikiCollectionId?: string | null;
	panelContext?: PanelContextEntry[];
	toolScopes?: DeskToolScope[];
	deskLayout?: { panelId: string; fileId?: string; fileType?: string; label: string }[];
	activeWorkspace?: { id: string; name: string };
	/**
	 * The request's remaining budget, when the route minted one for the whole turn. Every model
	 * call of the turn is bounded by what it has left minus the finalization reserve.
	 */
	deadline?: Deadline;
	/** Resolved request locale (server-derived from `event.locals.locale`). Used by `search_catalog`. */
	locale?: Locale;
	/** Auth ceiling for catalog visibility (server-derived via `isAdmin()` — never a DB column). */
	authCeiling?: string | null;
	/**
	 * Site-awareness (chatbot only): the page the user is asking from, ALREADY resolved
	 * server-side at the route boundary (`resolvePageContext`) to trusted catalog metadata.
	 * Null when the route didn't resolve (unknown/dynamic/private). Drives the passive
	 * `<current-page>` block + the deixis-gated retrieval seed. See `site-awareness.md`.
	 */
	pageContext?: PageContext | null;
	/**
	 * The request's own signal — the platform's word that the client left (Vercel with
	 * `supportsCancellation`; the Node bridge only for an interrupted body). Joined with the
	 * response body's `cancel()` into the turn's cancellation (`http/cancellation.ts`).
	 */
	signal?: AbortSignal;
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

/** Ceiling for one model call: a provider that has not finished by then is treated as timed out. */
const MODEL_CALL_TIMEOUT_MS = 30_000;

/**
 * Time a turn keeps back from its last model call for what has to happen after it: the step
 * rows, the answer's row, the budget charge, the `finish` frame. A call that used the whole
 * function budget would leave a streamed answer with no time to persist it.
 */
const FINALIZATION_RESERVE_MS = 4_000;

/**
 * The signal one model call carries: the turn's cancellation (the client left) plus the call's
 * own ceiling — and, when the route handed one over, the request's remaining budget, so a late
 * step never runs past the function's own deadline. Minted per call — `AbortSignal.timeout()`
 * is single-use, so a fallback attempt cannot reuse the primary's.
 */
function modelCallSignal(cancellation: Cancellation, deadline?: Deadline): AbortSignal {
	const ceiling = deadline
		? deadline.child(MODEL_CALL_TIMEOUT_MS, { reserveMs: FINALIZATION_RESERVE_MS }).signal()
		: AbortSignal.timeout(MODEL_CALL_TIMEOUT_MS);
	return AbortSignal.any([cancellation.signal, ceiling]);
}

/** Attempt streaming with fallback providers on transient errors. */
async function tryFallback(
	baseSystemPrompt: string,
	messages: ModelMessage[],
	conversationId: string | undefined,
	userId: string,
	fallbacks: ProviderEntry[],
	cancellation: Cancellation,
	wantsTools = false,
	deskTools?: ReturnType<typeof createDeskTools>,
	toolScopes?: DeskToolScope[],
	deadline?: Deadline,
): Promise<Response | null> {
	for (const fallback of fallbacks) {
		if (await isCooledDown(fallback.id)) continue;
		// For tool requests, prefer tool-capable providers
		if (wantsTools && !fallback.capabilities.tools) continue;
		try {
			const fallbackModel = fallback.getInstance();
			if (!fallbackModel) continue;

			const useTools = wantsTools && fallback.capabilities.tools && deskTools;
			const result = streamText({
				model: fallbackModel,
				system: baseSystemPrompt,
				messages,
				maxRetries: 0,
				maxOutputTokens: MAX_TOKENS,
				abortSignal: modelCallSignal(cancellation, deadline),
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
					const aiErr = classifyAiError(error);
					console.error(`[ai:chat:fallback] Stream classify [${aiErr.kind}]:`, error);
					if (aiErr.kind === 'rate_limit') {
						void markCooldown(fallback.id);
						void incrProvider429(fallback.id);
					}
					return `[${aiErr.kind}] ${safeAiMessage(aiErr.kind)}`;
				},
			});
			return createUIMessageStreamResponse({ stream: cancellation.body(stream), headers });
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
		if (f.capabilities.tools && !ordered.some((p) => p.id === f.id)) ordered.push(f);
	}
	for (const entry of ordered) {
		if (!entry.configured || !entry.capabilities.tools) continue;
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
		if (requireTools && !f.capabilities.tools) continue;
		// The pool is every configured connection, the primary included — never re-attempt the
		// provider that just failed.
		if (attempts.some((a) => a.providerId === f.id)) continue;
		const instance = f.getInstance();
		if (!instance) continue;
		attempts.push({ providerId: f.id, modelId: f.modelId, run: () => makeStream(instance) });
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
	// Pre-stream clock: everything between here and the chatbot's `start` frame is time the
	// client spends looking at nothing (history conversion, provider resolution, conversation
	// resolution, the user + assistant row writes).
	const turnStartedAt = performance.now();
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
		locale,
		authCeiling,
		pageContext,
	} = input;
	const catalogLocale: Locale = locale ?? 'en';
	// The client stopping to listen (Stop, a closed tab, a dropped connection) aborts every model
	// call of the turn; what had streamed by then is persisted, not the answer nobody will read.
	const cancellation = startCancellation(input.signal);

	// Window conversation history to prevent context overflow in multi-turn chats. An approved
	// plan's outcome reaches the model the same way as everything else: the approve door
	// persists a deterministic receipt message the client carries in this history.
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

	// Resolve the provider for this turn against the snapshot the guard loaded
	// (request override → stored preference → project default → capability order).
	const { registry } = input;
	const activeProvider = getActiveProvider(registry, userId, providerId);
	const activeInfo = getActiveProviderInfo(registry, userId, providerId);
	const resolvedChatModel = activeProvider?.getInstance() ?? null;
	const resolvedToolProvider = getToolProvider(registry, userId, providerId);
	// The turn's fallback pool is every configured connection; each consumer drops the one it is
	// already running on. It is NOT `getFallbacksForUser` (which excludes the *chat* provider —
	// the registry's first connection): on a tool-routed turn the chat provider is exactly the
	// one left to rotate to, and excluding it left Google + Groq with no fallback at all.
	const configuredProviders = registry.entries.filter((p) => p.configured);

	if (!resolvedChatModel) {
		return Response.json(
			{ error: { code: 'ai_unavailable', message: 'No AI provider is connected.' } },
			{ status: 503 },
		);
	}

	// Use tool-capable provider when tools requested, fall back to chatModel without tools.
	// The llmwiki + retrieval retrieval branches attach their own tools (search_catalog, llmwiki/
	// retrieval drill-down) even without desk scopes, so they must route to the tool-capable model
	// too — otherwise grounding tool calls run on the chat model and silently fail to fire.
	const wantsTools = !!toolScopes?.length || input.surface === 'chatbot';
	const availableToolProvider = wantsTools
		? await resolveAvailableToolProvider(resolvedToolProvider, configuredProviders)
		: null;
	const hasTools = wantsTools && !!availableToolProvider;
	const model = availableToolProvider?.model ?? resolvedChatModel;
	// Desk tools only for actual desk scopes — the llmwiki/retrieval branches set hasTools (to claim
	// the tool model) but bring their own retrieval tools and pass no desk scopes.
	const deskTools = hasTools && toolScopes?.length ? createDeskTools(userId, toolScopes, deskLayout) : undefined;
	// Resolved provider/model attribution for per-step telemetry (conversation_step) and for the
	// stream-error circuit breaker. MUTABLE: the chatbot branch rotates providers mid-turn
	// (see `streamTextIntoOpenMessage`), and every reader below must attribute the failure/step to
	// the provider that is actually running, not the one the turn started on.
	let currentProviderId = hasTools ? (availableToolProvider?.provider.id ?? null) : (activeInfo?.id ?? null);
	let currentModelId = hasTools ? (availableToolProvider?.provider.modelId ?? null) : (activeInfo?.model ?? null);
	const grantedScopes = toolScopes ?? [];
	const lastRawMsg = windowedMessages[windowedMessages.length - 1];
	const userMsgText = lastRawMsg?.role === 'user' ? getMessageText(lastRawMsg) : '';

	// One named dispatch decision. The routes set `input.surface` explicitly; the chatbot
	// (retrieval) branch additionally requires a fresh user turn — any other turn takes the
	// plain deskbot streaming path. Computed BEFORE conversation resolution so it can be
	// stamped on the conversation at creation.
	const isFreshUserTurn = lastRawMsg?.role === 'user' && !!userMsgText;
	const surface: AiSurface = isFreshUserTurn && input.surface === 'chatbot' ? 'chatbot' : 'deskbot';

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

	const baseSystemPrompt = buildSystemPrompt({ panelContext, toolScopes, deskLayout, activeWorkspace, requirePlan });

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

	// The assistant row's id is minted here so the same id opens the client message (`start`
	// frame), keys the persisted row and is the FK every `conversation_step` of the turn points at.
	const assistantMsgId = crypto.randomUUID();

	const responseHeaders: Record<string, string> = {};
	if (conversationId) responseHeaders['X-Conversation-Id'] = conversationId;

	/** Circuit breaker: a rate-limited provider sits out the next turns. */
	function coolProvider(providerId: string | null, kind: AiErrorKind): void {
		if (kind !== 'rate_limit' || !providerId) return;
		void markCooldown(providerId);
		void incrProvider429(providerId);
	}

	/** Classify a stream error and return the `[kind] user-safe message` frame text.
	 *  The desk branch's only failure door: it logs and cools here. (The chatbot branch cools in
	 *  the streaming helper's `onAttemptFailure`, which sees every failed attempt exactly once.) */
	function classifyStreamError(error: unknown): string {
		const aiErr = classifyAiError(error);
		console.error(`[ai:chat] Stream error [${aiErr.kind}]:`, error);
		coolProvider(currentProviderId, aiErr.kind);
		return `[${aiErr.kind}] ${safeAiMessage(aiErr.kind)}`;
	}

	try {
		// Both rows of the turn — the user message and the empty assistant row the stream backfills
		// — land in ONE insert before any frame is written: one ownership check, one `updatedAt`
		// touch, one round trip instead of two on the pre-stream path. Site-awareness: the resolved
		// route is stamped on the user row only (chatbot turns; pageContext is null elsewhere) for
		// the per-bubble "asked from" tag — display metadata, never replayed into a later prompt.
		// An insert failure still answers with the JSON error below, before any stream exists.
		if (conversationId) {
			const rows: Parameters<typeof saveMessages>[2] = [];
			if (lastRawMsg?.role === 'user' && userMsgText) {
				rows.push({ id: crypto.randomUUID(), role: 'user', content: userMsgText, route: pageContext?.path ?? null });
			}
			rows.push({ id: assistantMsgId, role: 'assistant', content: '' });
			await saveMessages(conversationId, userId, rows);
		}

		// chatbot (llmwiki) path — primary answer surface; exposes drill-down tools for retrieval.
		if (surface === 'chatbot') {
			const collectionId = llmwikiCollectionId ?? null;
			// The Google connection the guard's registry already opened: every embed of this turn
			// (the shared query vector, a page-seeded retrieve, `search_project_docs`) rides it
			// instead of reading and decrypting the provider rows again.
			const embeddingConnection = registry.embeddingConnection();
			const requestId = crypto.randomUUID();

			const stream = createUIMessageStream({
				execute: async ({ writer }) => {
					// Open the assistant message frame BEFORE any `message-metadata` write.
					// This branch emits pipeline metadata before the merged text stream's own
					// `start`; without an explicit leading `start` the v6 client materializes a
					// FIRST (empty) assistant message to hold that early metadata, then the merge's
					// own `start` (different id) appends a SECOND. One `start` up front → one message.
					// Reusing this id for the merged stream (via `sendStart: false`) also makes the
					// client message id match the persisted DB row (inserted above, before the stream).
					writer.write({ type: 'start', messageId: assistantMsgId });
					const preStreamMs = Math.round(performance.now() - turnStartedAt);

					// Turn t0 — one origin for every step's startOffsetMs (retrieve + generate share it),
					// so the waterfall renders true parallel overlap. See retrieval-observability.md.
					const t0 = performance.now();

					let systemPrompt = baseSystemPrompt;
					let toolCallCount = 0;
					// Gate the full prompt TEXT to dev builds OR real admins (ADMIN_USER_ID); never the
					// token counts. Was DEV-only, so admins saw nothing in prod.
					const isDevOrAdmin = !!import.meta.env?.DEV || isAdminUser(userId);

					type AnyLlmwikiEvent =
						| RetrievalStepEvent
						| RetrievalChunksEvent
						| RetrievalPromptEvent
						| LlmwikiCitationsEvent;
					const pipelineEvents: AnyLlmwikiEvent[] = [];
					// Enumerable context blocks injected into the system prompt (llmwiki pages + system-docs
					// chunks) for the Tokens-pane per-block breakdown. The honest aggregate (Context = the
					// full injected delta) is computed at emit time, after the prompt is fully assembled.
					const promptContextBlocks: { chunkId: string; tokens: number }[] = [];
					// Mirror retrieval's citations extra payload so existing consumers still read it.
					let citationsPayload: {
						citations: Array<{ chunkId: string; verification: string; tier: 'chunks' }>;
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

					// Every metadata frame carries the FULL accumulated state (REPLACE semantics on the
					// client — arrays replace on merge), so a burst of emits — four assembly lanes
					// settling, the prompt-assembled event, a drill tick — is worth exactly one frame.
					// `flush` schedules one write per microtask turn; `flushNow` drains it where the
					// order against other frames matters (before the first model frame, before `finish`).
					let flushPending = false;
					const flushNow = () => {
						if (!flushPending) return;
						flushPending = false;
						const meta: Record<string, unknown> = { pipeline: pipelineEvents };
						if (citationsPayload) Object.assign(meta, citationsPayload);
						if (sourceChunksPayload) Object.assign(meta, sourceChunksPayload);
						if (catalogPayload) Object.assign(meta, catalogPayload);
						writer.write({ type: 'message-metadata', messageMetadata: meta });
					};
					const flush = () => {
						if (flushPending) return;
						flushPending = true;
						queueMicrotask(flushNow);
					};
					// Step events are authored as raw literals (step/status/offset/detail); this
					// closure stamps the derived axes (phase/retriever), the stable instanceKey, and the
					// turn requestId so every literal stays terse and can't drift from PHASE_OF/RETRIEVER_OF.
					const emit = (event: RawStepInput | RetrievalChunksEvent | RetrievalPromptEvent | LlmwikiCitationsEvent) => {
						if (event.type === 'pipeline:step') {
							pipelineEvents.push({
								...event,
								phase: PHASE_OF[event.step],
								instanceKey: event.instanceKey ?? event.step,
								retriever: event.retriever ?? RETRIEVER_OF[event.step],
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
							authCeiling: authCeiling ?? null,
							embeddingConnection,
						},
						{ emit, t0 },
					);
					systemPrompt = assembly.systemPrompt;
					promptContextBlocks.push(...assembly.promptContextBlocks);

					// The tool set follows the prompt: the llmwiki drill-down pair mounts only when the
					// prompt carries an llmwiki context block (the rules naming it), `search_project_docs`
					// already holds this turn's docs retrieval, and the catalog rows the assembly put in
					// the prompt are surfaced — citable, verifiable — before the model has run.
					const {
						tools: retrievalTools,
						drilledChunks,
						surfacedCatalog,
					} = buildRetrievalTools(userId, catalogLocale, authCeiling ?? null, {
						llmwiki: assembly.llmwikiGrounded,
						embeddingConnection,
						docsSeed: assembly.docsSeed,
						catalogSeed: assembly.catalogResults,
					});

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
					// Set by the final attempt failure; the generate terminal then closes as `error`
					// with the same timing shape a clean turn gets.
					let generateFailure: AiErrorKind | null = null;

					// `assistantMsgId` was persisted before the stream (so the `start` frame carries it
					// and conversation_step.messageId has a valid FK); its content is backfilled in
					// afterText (mirrors the desk branch).
					let stepCounter = 0;
					let lastStepAt = generateStart;
					// Step rows are written off the step boundary: awaiting the insert inside
					// `onStepFinish` held the next model call for one DB round trip per step. The
					// writes are collected and awaited in afterText before the totals are refreshed
					// from them — they still land inside the stream, before `finish`.
					const pendingStepWrites: Promise<void>[] = [];
					// Per-step shape of the generate bar: how long each model call waited for its first
					// token, and what every tool execution cost. Reset per provider attempt — a rotation
					// starts the clock over on a fresh request.
					const firstTokenMs: number[] = [];
					const toolsRun: { name: string; ms: number }[] = [];
					let stepsStarted = 0;
					let stepStartedAt = generateStart;
					let awaitingFirstToken = true;

					// Tools are SPREAD, not passed unconditionally: when every tool-capable provider is
					// cooled (`hasTools === false`) the turn must run genuinely tool-less. Mounting
					// tools on a cooled-out turn is what produced "I searched the catalog…" answers
					// with zero tool calls behind them. Paired with the honest-degrade NOTE above.
					// `prepareStep` withholds the tools on the last allowed step, so the budget ends in an
					// answer rather than on a tool call nothing will execute (`policy/step-budget.ts`).
					const toolOpts = hasTools
						? {
								tools: retrievalTools,
								toolChoice: 'auto' as const,
								stopWhen: stepCountIs(CHATBOT_MAX_STEPS),
								prepareStep: answerOnLastStep(CHATBOT_MAX_STEPS),
							}
						: {};

					// A fresh `streamText` per attempt — the call fires on invocation and its signal
					// (`modelCallSignal`) is single-use, so a fallback cannot reuse the primary's.
					const makeStream = (attemptModel: LanguageModel) => {
						// The prompt-assembled + generate-active events precede the first model frame.
						flushNow();
						return streamText({
							model: attemptModel,
							system: systemPrompt,
							messages,
							...toolOpts,
							providerOptions: CHATBOT_GENERATION_OPTIONS,
							maxRetries: 0,
							maxOutputTokens: MAX_TOKENS,
							abortSignal: modelCallSignal(cancellation, input.deadline),
							// Net for Groq/llama emitting a tool call as plain text (`<function=…>`).
							// Suppresses the raw markup so the user never reads it; the turn degrades
							// to empty instead of leaking syntax. See `tool-leak-guard.ts`.
							experimental_transform: createToolLeakGuard((lead) =>
								console.warn(`[ai:chat:llmwiki] suppressed textual tool-call leak: ${lead}…`),
							),
							experimental_onStepStart: () => {
								stepsStarted++;
								stepStartedAt = performance.now();
								awaitingFirstToken = true;
							},
							onChunk: ({ chunk }) => {
								if (!awaitingFirstToken) return;
								if (
									chunk.type === 'text-delta' ||
									chunk.type === 'reasoning-delta' ||
									chunk.type === 'tool-input-start' ||
									chunk.type === 'tool-call'
								) {
									awaitingFirstToken = false;
									firstTokenMs.push(Math.round(performance.now() - stepStartedAt));
								}
							},
							experimental_onToolCallFinish: ({ toolCall, durationMs }) => {
								toolsRun.push({ name: toolCall.toolName, ms: Math.round(durationMs) });
							},
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
										if (tc.toolName !== 'get_source_chunks') continue;
										const callIndex = toolCallCount as 0 | 1 | 2;
										toolCallCount++;
										if (toolCallCount > MAX_SOURCE_CHUNK_TOOL_CALLS_PER_TURN) {
											console.warn(
												`[ai:chat:llmwiki] get_source_chunks called ${toolCallCount} times, cap is ${MAX_SOURCE_CHUNK_TOOL_CALLS_PER_TURN}`,
											);
										}
										const idsRequested = tc.args?.ids?.length ?? 0;
										const chunksReturned = toolResults?.[i]?.result?.chunks?.length ?? 0;
										emit({
											type: 'pipeline:step',
											step: 'chunks:drill',
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
								// Persist the step so the chatbot's usage shows up in "usage by model" —
								// started here, awaited in afterText (see `pendingStepWrites`).
								if (conversationId) {
									const stepIndex = stepCounter++;
									const nowT = performance.now();
									const durationMs = Math.round(nowT - lastStepAt);
									lastStepAt = nowT;
									pendingStepWrites.push(
										saveConversationStep({
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
										}).catch((err) => console.error('[ai:chat:llmwiki] Failed to persist step:', err)),
									);
								}
							},
							// The one place the raw provider error is logged. The trace never carries it:
							// the streaming helper reports the attempt through `onAttemptFailure`, which
							// paints the generate terminal with the classified kind.
							onError: ({ error }) => {
								console.error('[ai:chat:llmwiki] Stream error:', error);
							},
						});
					};

					// Post-text work runs while the assistant message is still OPEN (the streaming helper
					// closes it with a single `finish` only after this resolves) — so the citation/catalog
					// metadata flushed here lands on the right message instead of after the `finish` frame.
					const afterText = async (rawText: string, totalUsage: LanguageModelUsage) => {
						// The model is done; everything below runs while the message is still open and
						// is what the client sees as the gap between the last token and `finish`.
						const generateMs = Math.round(performance.now() - generateStart);
						const finalize: NonNullable<GenerateDetail['finalize']> = {};
						const timed = async (stage: keyof typeof finalize, work: () => Promise<void>) => {
							const from = performance.now();
							try {
								await work();
							} finally {
								finalize[stage] = Math.round(performance.now() - from);
							}
						};
						try {
							await finalizeTurn(rawText, totalUsage, timed);
						} finally {
							// The generate terminal carries the whole turn's timing shape and is emitted
							// LAST so the finalize stages are in it — one frame, never a re-send.
							emit({
								type: 'pipeline:step',
								step: 'generate',
								status: generateFailure ? 'error' : 'done',
								durationMs: generateMs,
								...(generateFailure ? { error: generateFailure } : {}),
								detail: {
									kind: 'generate',
									model: activeInfo?.id,
									inputTokens: totalUsage?.inputTokens,
									outputTokens: totalUsage?.outputTokens,
									// Gemini's `thoughtsTokenCount`: the arm of the thinking A/B this turn ran on.
									reasoningTokens: totalUsage?.outputTokenDetails?.reasoningTokens,
									preStreamMs,
									steps: stepsStarted,
									firstTokenMs: [...firstTokenMs],
									tools: [...toolsRun],
									finalize: { ...finalize },
								},
							});
							// One sanitized line per turn: ids, milliseconds and tool names — never text.
							const { timings } = assembly;
							const ms = (value: number | undefined) => (value === undefined ? '-' : String(value));
							console.info(
								`[ai:chat:timing] requestId=${requestId} preStream=${preStreamMs} embed=${ms(timings.embedMs)} ` +
									`wiki=${ms(timings.llmwikiMs)} docs=${ms(timings.docsMs)} overview=${ms(timings.overviewMs)} ` +
									`catalog=${ms(timings.catalogMs)} generate=${generateMs} steps=${stepsStarted} ` +
									`firstToken=[${firstTokenMs.join(',')}] reasoning=${ms(totalUsage?.outputTokenDetails?.reasoningTokens)} ` +
									`tools=[${toolsRun.map((t) => `${t.name}:${t.ms}`).join(',')}] ` +
									`finalize={verify:${ms(finalize.verifyMs)},catalog:${ms(finalize.catalogMs)},` +
									`persist:${ms(finalize.persistMs)},budget:${ms(finalize.budgetMs)}} ` +
									`queries=${observedQueryCount() ?? '-'}`,
							);
							// The last metadata frame must precede the `finish` the helper writes next.
							flushNow();
						}
					};
					const finalizeTurn = async (
						rawText: string,
						totalUsage: LanguageModelUsage,
						timed: (stage: keyof NonNullable<GenerateDetail['finalize']>, work: () => Promise<void>) => Promise<void>,
					) => {
						// Mirror the stream guard: if the whole turn was a textual tool-call
						// leak (`<function=…>`), blank it before persistence / citation
						// verification so the leak isn't saved or counted as an answer.
						const text = stripTextualToolCall(rawText);
						try {
							if (drilledChunks.size > 0) {
								await timed('verifyMs', async () => {
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
											tier: 'chunks' as const,
										})),
										driftedChunkIds,
									};
									sourceChunksPayload = {
										sourceChunks: await shapeDrilledCitations(userId, Array.from(drilledChunks), verifications),
									};
									flush();
								});
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
								await timed('catalogMs', async () => {
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
								});
							}
						} catch (err) {
							console.error('[ai:chat:catalog] Surface-citation verification failed:', err);
						}
						// Step rows first (each write logs its own failure): the token totals refreshed
						// below are summed from them.
						await Promise.all(pendingStepWrites);
						// The durable writes — backfill the assistant row, refresh the cached totals,
						// charge the Redis budget — are independent of each other and run together.
						// ALL of them are awaited, whatever fails: they must land before `finish`
						// (a function is frozen once its response completes), and a failed write is
						// logged, never allowed to cost the user an answer that already streamed.
						const outcomes = await Promise.allSettled([
							conversationId
								? timed('persistMs', async () => {
										await Promise.all([
											updateMessageContent(assistantMsgId, text),
											refreshConversationTokens(conversationId),
										]);
									})
								: Promise.resolve(),
							totalUsage
								? timed('budgetMs', () =>
										chargeTokens(userId, (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0)),
									)
								: Promise.resolve(),
						]);
						for (const outcome of outcomes) {
							if (outcome.status === 'rejected') console.error('[ai:chat:llmwiki] Failed to finalize:', outcome.reason);
						}
					};
					// Current-turn provider rotation: primary first, then every configured fallback that
					// can still serve this turn. `requireTools` keeps a tool-mounted turn off a
					// tool-incapable provider (which would silently answer without ever searching).
					const attempts = buildTurnAttempts(
						{ providerId: currentProviderId, modelId: currentModelId, model },
						configuredProviders,
						makeStream,
						hasTools,
					);

					// Pump text into the open message, run afterText, then close — citation/catalog/persist
					// metadata flushes BEFORE the finish frame (fixes the empty-answer / answer⟷trace desync).
					await streamTextIntoOpenMessage(writer, attempts, afterText, {
						signal: cancellation.signal,
						isSkipped: (id) => (id ? isCooledDown(id) : Promise.resolve(false)),
						// The client left: the helper persists what streamed (through `afterText`) and
						// closes the message; nothing is cooled and no error frame is written.
						onCancellation: ({ providerId: cancelledId, contentParts }) => {
							console.info(
								`[ai:chat:llmwiki] turn cancelled by the client requestId=${requestId} provider=${cancelledId ?? 'unknown'} contentParts=${contentParts}`,
							);
						},
						onAttemptStart: (attempt) => {
							// Re-point step telemetry at the provider actually running this attempt.
							currentProviderId = attempt.providerId;
							currentModelId = attempt.modelId;
							firstTokenMs.length = 0;
							toolsRun.length = 0;
							stepsStarted = 0;
							stepStartedAt = performance.now();
							awaitingFirstToken = true;
						},
						onAttemptFailure: async ({ providerId: failedId, error, willRetry }: AttemptFailure) => {
							const { kind } = classifyAiError(error);
							console.error(
								`[ai:chat:llmwiki] attempt failed provider=${failedId ?? 'unknown'} kind=${kind} willRetry=${willRetry}`,
							);
							// Every failed attempt lands here exactly once — retry or final — so this is
							// the chatbot turn's one cooldown door; the stream's `onError` only formats.
							coolProvider(failedId, kind);
							if (willRetry) {
								// Re-open the generate bar so the waterfall shows the turn recovering onto
								// the next provider.
								emit({
									type: 'pipeline:step',
									step: 'generate',
									status: 'active',
									startOffsetMs: Math.round(generateStart - t0),
								});
								return;
							}
							// Final: the generate terminal closes as `error` with the classified kind —
							// never the provider's prose. Drained now, before the helper closes the message
							// (a partial answer) or the stream ends on the error frame.
							generateFailure = kind;
							emit({
								type: 'pipeline:step',
								step: 'generate',
								status: 'error',
								durationMs: Math.round(performance.now() - generateStart),
								error: kind,
							});
							flushNow();
						},
					});
				},
				// A failure that left the message empty rethrows out of the helper to here: the ONE
				// `[kind] message` error frame the client parses. The attempt was logged and cooled
				// by the hook; a turn no provider could take (every one cooled) only passes here.
				onError: (error) => {
					const text = aiErrorFrameText(error);
					console.warn(`[ai:chat:llmwiki] turn ended on an error frame requestId=${requestId} ${text.split(' ')[0]}`);
					return text;
				},
			});
			return createUIMessageStreamResponse({ stream: cancellation.body(stream), headers: responseHeaders });
		}

		// deskbot (non-retrieval) path — the surface === 'deskbot' fallthrough, which also
		// takes any non-fresh turn. Streams through the same helper as the chatbot: one open
		// message, provider rotation before the first content part, a classified error frame
		// when nothing reached the client. The assistant row (`assistantMsgId`) is already
		// persisted above.
		let stepCounter = 0;
		let lastStepAt = performance.now();
		// Step rows are written off the step boundary (see the chatbot branch) and awaited in
		// afterText before the totals are refreshed from them.
		const pendingStepWrites: Promise<void>[] = [];

		/**
		 * Harness metadata accumulator — per SVEY's gotcha, `message-metadata`
		 * events REPLACE (not merge) on the client, so every write must include
		 * the full accumulated object. The retrieval path already does this for
		 * pipeline events; here we do the same for `harness.proposal` events.
		 */
		const harnessMetadata: HarnessMetadata = {};

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				// One assistant message, opened here with the persisted row's id (see the chatbot
				// branch): the client's message id is the DB's, and the proposal metadata written
				// from `onStepFinish` lands inside the message the helper keeps open.
				writer.write({ type: 'start', messageId: assistantMsgId });

				type ToolResultRecord = {
					toolName: string;
					input?: unknown;
					output?: unknown;
				};
				const onStepFinish = async ({
					toolResults,
					usage,
				}: {
					toolResults?: ToolResultRecord[];
					usage?: { inputTokens?: number; outputTokens?: number };
				}) => {
					if (!conversationId) return;
					const currentStep = stepCounter++;

					const results = toolResults ?? [];

					// The approval boundary. A gated tool or `desk_propose_plan` asked for approval:
					// persist the proposal FIRST — it is the one write the user is about to act on —
					// then stream the card. `stopWhen` ends the loop after this step, so a turn has
					// at most one proposal; a second request would only ever come from a step the
					// loop already stopped before.
					const approval = collectApprovalRequests(results);
					let proposalPersisted = approval.steps.length === 0;
					if (approval.steps.length > 0 && !harnessMetadata.proposal) {
						const goal = approval.goal ?? approval.steps.map((s) => s.action).join('; ');
						try {
							const proposal = await createProposal({
								conversationId,
								messageId: assistantMsgId,
								// Freeze the grant the plan was proposed under. The approve route
								// replays these, never scopes sent with the approval request.
								grantedScopes,
								riskTier: riskTierOf(approval.steps),
								payload: approval.steps,
								rationale: goal,
							});
							harnessMetadata.proposal = {
								id: proposal.id,
								goal,
								steps: toCardSteps(approval.steps),
								estimatedWrites: approval.steps.length,
								riskTier: proposal.riskTier,
								status: 'pending',
							};
							proposalPersisted = true;
						} catch (err) {
							console.error('[ai:chat] Failed to persist proposal:', err);
							// No card without a row: a card the approve route cannot find would be
							// a promise nobody keeps. The tool records below carry the failure too.
							harnessMetadata.proposalError = {
								message: 'The plan could not be saved for approval. Nothing was changed.',
							};
						}
						// Always write the full accumulated object — metadata REPLACES on client.
						writer.write({ type: 'message-metadata', messageMetadata: { harness: harnessMetadata } });
					}

					// The tool records and the step row are telemetry the next model call must not wait
					// for: they start now and are awaited in `afterText` (the proposal above was awaited —
					// the user acts on it). The step row carries the tool-call ids, so it follows them.
					const toolCallSaves = results.map((tr) => {
						const output = tr.output && typeof tr.output === 'object' ? (tr.output as Record<string, unknown>) : {};
						const hasError = 'error' in output;
						const orphanedSentinel = !proposalPersisted && isApprovalSentinel(tr.output);
						return saveToolCall({
							messageId: assistantMsgId,
							toolName: tr.toolName,
							args: (tr.input ?? {}) as Record<string, unknown>,
							result: output,
							status: hasError || orphanedSentinel ? 'error' : 'success',
							errorMessage: hasError
								? String(output.error)
								: orphanedSentinel
									? 'Approval request lost: the proposal could not be persisted.'
									: undefined,
						})
							.then((saved) => saved.id)
							.catch((err) => {
								console.error('[ai:chat] Failed to persist tool call:', err);
								return null;
							});
					});

					const deskNowT = performance.now();
					const deskDurationMs = Math.round(deskNowT - lastStepAt);
					lastStepAt = deskNowT;
					pendingStepWrites.push(
						Promise.all(toolCallSaves)
							.then((ids) => {
								const toolCallIds = ids.filter((id): id is string => id !== null);
								return saveConversationStep({
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
							})
							.catch((err) => console.error('[ai:chat] Failed to persist step:', err)),
					);
				};

				const maxSteps = stepsForScopes(toolScopes ?? []);
				const makeStream = (attemptModel: LanguageModel) =>
					streamText({
						model: attemptModel,
						system: baseSystemPrompt,
						messages,
						maxRetries: 0,
						maxOutputTokens: MAX_TOKENS,
						abortSignal: modelCallSignal(cancellation, input.deadline),
						// Net for Groq/llama emitting a tool call as plain text (`<function=…>`).
						// The desk branch routes to the SAME tool-capable provider as the chatbot
						// branch (which already guards at the llmwiki stream), so without this a
						// Groq-routed desk turn leaks raw tool-call markup into the UI.
						experimental_transform: createToolLeakGuard((lead) =>
							console.warn(`[ai:chat:desk] suppressed textual tool-call leak: ${lead}…`),
						),
						...(deskTools
							? {
									tools: deskTools,
									toolChoice: 'auto' as const,
									// Two ways the loop ends: the scope's step budget, or the approval boundary —
									// the step that asked for approval is the turn's last, so the model never
									// narrates an "awaiting approval" the card already says and never queues a
									// second plan. The last budgeted step runs tool-less so it ends on an answer.
									stopWhen: [stepCountIs(maxSteps), stoppedAtApproval],
									prepareStep: answerOnLastStep(maxSteps),
									// Compaction deliberately does NOT hook `prepareStep`: AI SDK #9631 silently
									// drops message mutations returned from it. It runs at tool-execute time via
									// `wrapToolsWithCompaction` inside `createDeskTools`, with the whole request
									// inside a `runWithCompaction` context so refs resolve consistently.
								}
							: {}),
						onStepFinish,
					});

				// The durable tail of a finished (or cut) turn: the step rows first — the totals
				// refreshed below are summed from them — then the answer's row, the totals and the
				// budget charge together. A cut turn arrives here with the partial text the client
				// received and unknown usage, so it is stored but not charged.
				const afterText = async (text: string, totalUsage: LanguageModelUsage) => {
					await Promise.all(pendingStepWrites);
					if (!conversationId) return;
					const tokens = (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0);
					const outcomes = await Promise.allSettled([
						text ? updateMessageContent(assistantMsgId, text) : Promise.resolve(),
						refreshConversationTokens(conversationId),
						tokens > 0 ? chargeTokens(userId, tokens) : Promise.resolve(),
					]);
					for (const outcome of outcomes) {
						if (outcome.status === 'rejected') console.error('[ai:chat:desk] Failed to finalize:', outcome.reason);
					}
				};

				// Current-turn provider rotation: primary first, then every configured fallback that
				// can still serve this turn. A desk turn never rotates once a tool has run — the
				// helper pins the attempt at its first content part, and a tool part is one.
				const attempts = buildTurnAttempts(
					{ providerId: currentProviderId, modelId: currentModelId, model },
					configuredProviders,
					makeStream,
					hasTools,
				);
				await streamTextIntoOpenMessage(writer, attempts, afterText, {
					signal: cancellation.signal,
					isSkipped: (id) => (id ? isCooledDown(id) : Promise.resolve(false)),
					onCancellation: ({ providerId: cancelledId, contentParts }) => {
						console.info(
							`[ai:chat:desk] turn cancelled by the client provider=${cancelledId ?? 'unknown'} contentParts=${contentParts} steps=${stepCounter}`,
						);
					},
					onAttemptStart: (attempt) => {
						// Re-point step telemetry at the provider actually running this attempt.
						currentProviderId = attempt.providerId;
						currentModelId = attempt.modelId;
					},
					onAttemptFailure: async ({ providerId: failedId, error, willRetry }: AttemptFailure) => {
						const { kind } = classifyAiError(error);
						console.error(
							`[ai:chat:desk] attempt failed provider=${failedId ?? 'unknown'} kind=${kind} willRetry=${willRetry}`,
						);
						// Every failed attempt lands here exactly once — retry or final — so this is the
						// desk turn's one cooldown door; the stream's `onError` only formats.
						coolProvider(failedId, kind);
					},
				});
			},
			onError: classifyStreamError,
		});
		return createUIMessageStreamResponse({ stream: cancellation.body(stream), headers: responseHeaders });
	} catch (err) {
		// Error hygiene: a DB failure is NOT an AI failure. `classifyAiError`'s substring rules
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

		const aiErr = classifyAiError(err);
		coolProvider(currentProviderId, aiErr.kind);

		// `unknown` is deliberately NOT in this allowlist: it is `classifyAiError`'s catch-all, so
		// falling back on it spent a second provider's quota re-running deterministic bugs (bad
		// tool schema, serialization failure) that every provider fails identically.
		if (['unavailable', 'timeout', 'rate_limit'].includes(aiErr.kind)) {
			// Per-surface fallback. Only a genuine DESK turn (real desk scopes) may mount desk
			// tools — calling createDeskTools with undefined scopes would mount an empty/wrong
			// toolset and contaminate the surface. A chatbot turn falls back tool-less on any
			// provider: ungrounded but honest.
			const isDeskTurn = !!toolScopes?.length;
			const fallbackTools = isDeskTurn ? (deskTools ?? createDeskTools(userId, toolScopes, deskLayout)) : undefined;
			const fallbackResponse = await tryFallback(
				baseSystemPrompt,
				messages,
				conversationId,
				userId,
				configuredProviders.filter((p) => p.id !== currentProviderId),
				cancellation,
				isDeskTurn,
				fallbackTools,
				toolScopes,
				input.deadline,
			);
			if (fallbackResponse) return fallbackResponse;
		}

		return Response.json(
			{ error: { code: aiErr.kind, message: safeAiMessage(aiErr.kind) } },
			{ status: aiErrorToStatus(aiErr.kind), headers: { 'X-AI-Error-Kind': aiErr.kind } },
		);
	}
}
