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
	stepCountIs,
	streamText,
	type UIMessage,
} from 'ai';
import type { HarnessMetadata } from '$lib/components/composites/chatbot/harness-types';
import type { Locale } from '$lib/i18n';
import {
	getActiveProvider,
	getActiveProviderInfo,
	getToolProvider,
	type ProviderEntry,
	type ProviderRegistry,
} from '$lib/server/ai';
import { chargeTokens } from '$lib/server/ai/budget';
import { CHATBOT_GENERATION_OPTIONS, MAX_TOKENS } from '$lib/server/ai/config';
import { getMessageText, windowMessages } from '$lib/server/ai/context/history';
import {
	type AiErrorKind,
	aiErrorFrameText,
	aiErrorToStatus,
	classifyAiError,
	safeAiMessage,
} from '$lib/server/ai/errors';
import { compactToolResults, DEFAULT_BUDGET, runWithCompaction } from '$lib/server/ai/loop/compact';
import { answerOnLastStep } from '$lib/server/ai/policy';
import { estimateTurnTokens, fitsTokenMinute } from '$lib/server/ai/provider-limits';
import { incrProvider429 } from '$lib/server/ai/provider-usage';
import { isCooledDown, markCooldown } from '$lib/server/ai/providers';
import type { DeskToolScope } from '$lib/server/ai/tools';
import type { PanelContextEntry } from '$lib/server/ai/types';
import {
	createConversation,
	refreshConversationTokens,
	saveMessages,
	updateMessageContent,
} from '$lib/server/db/ai/mutations';
import { createProposal } from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import { DbError, safeDbMessage } from '$lib/server/db/errors';
import { observedQueryCount } from '$lib/server/db/query-census';
import { deskCorpusState } from '$lib/server/db/retrieval/queries';
import type { StoredMessagePart } from '$lib/server/db/schema/ai/conversation';
import { type Cancellation, startCancellation } from '$lib/server/http/cancellation';
import type { Deadline } from '$lib/server/http/deadline';
import { holdOpenUntil } from '$lib/server/platform';
import type { PageContext } from '$lib/server/search';
import type { AiSurface } from '$lib/types/db-enums';
import type { ToolExecutionRecord, TurnAwareness, TurnTimings } from '$lib/types/turn-trace';
import {
	type AttemptFailure,
	type PumpableTextResult,
	streamTextIntoOpenMessage,
	type TurnAttempt,
} from './_shared/streaming-turn';
import { checkConversationLimit } from './conversation-quota';
import { composeTurn, PROFILES, type TurnComposition, type TurnInput } from './profile';
import {
	collectApprovalRequests,
	isApprovalSentinel,
	riskTierOf,
	stoppedAtApproval,
	toCardSteps,
} from './proposals/approval-boundary';
import { createToolLeakGuard, stripTextualToolCall } from './tool-leak-guard';
import { traceModelCalls } from './trace/model-call-middleware';
import { createTurnRecorder, historyChars } from './trace/recorder';

/**
 * Which AI surface a turn belongs to — the explicit dispatch discriminant.
 * - `chatbot`  — the v10r expert: read-only, grounded, citation-faithful Q&A.
 * - `deskbot`  — the in-desk operator: agentic, mutating, plan-gated UI parity.
 */

/** The catalog visibility ceiling as the trace records it — never a free string. */
function awarenessCeiling(authCeiling: string | null | undefined): TurnAwareness['authCeiling'] {
	return authCeiling === 'admin' ? 'admin' : authCeiling === 'user' ? 'user' : null;
}

/**
 * The assistant message's parts as a reloaded thread renders them: the tool calls the answer
 * was built on (the SDK's `tool-<name>` part shape, `output-available`), then the text.
 * Rebuilt from the trace rather than captured from the wire — the streaming helper pumps the
 * SDK's parts through without assembling a message.
 */
function storedParts(text: string, toolExecutions: readonly ToolExecutionRecord[]): StoredMessagePart[] | null {
	const parts: StoredMessagePart[] = toolExecutions.map((exec) => ({
		type: `tool-${exec.toolName}`,
		toolCallId: exec.toolCallId,
		state: exec.status === 'error' ? 'output-error' : 'output-available',
		input: exec.input ?? {},
		...(exec.status === 'error' ? { errorText: exec.errorMessage ?? 'error' } : { output: exec.output ?? {} }),
	}));
	if (text) parts.push({ type: 'text', text });
	return parts.length > 0 ? parts : null;
}

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
	messages: UIMessage[];
	conversationId?: string;
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

// The system prompt is the surface's profile (`ai/profile/`); the history helpers are
// `ai/context/history.ts`.

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
 * How long a burst of trace changes is collected before one `message-metadata` frame carries
 * them all. Each frame is the whole snapshot, so a per-change frame would send it dozens of
 * times per turn; the explicit drains (before the first model frame, before `finish`) keep
 * the order against other frames exact regardless of this window.
 */
const METADATA_FLUSH_MS = 16;

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
	turnTokens: number,
): TurnAttempt[] {
	const attempts: TurnAttempt[] = [
		{ providerId: primary.providerId, modelId: primary.modelId, run: () => makeStream(primary.model) },
	];
	for (const f of fallbacks) {
		if (requireTools && !f.capabilities.tools) continue;
		// The pool is every configured connection, the primary included — never re-attempt the
		// provider that just failed.
		if (attempts.some((a) => a.providerId === f.id)) continue;
		// A fallback whose per-minute ceiling cannot carry this turn would stop early on its
		// second step; the primary is the user's choice and is tried regardless.
		if (!fitsTokenMinute(f.id, f.modelId, turnTokens)) {
			console.info(`[ai:chat] fallback ${f.id} left out: ~${turnTokens} tokens exceed its per-minute ceiling`);
			continue;
		}
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

	// Compact loaded history so oversized tool results from resumed conversations
	// don't blow the context window before the first step even runs.
	const messages = compactToolResults(await convertToModelMessages(windowedMessages));

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

	const grantedScopes = toolScopes ?? [];
	const lastRawMsg = windowedMessages[windowedMessages.length - 1];
	const userMsgText = lastRawMsg?.role === 'user' ? getMessageText(lastRawMsg) : '';

	// One named dispatch decision. The routes set `input.surface` explicitly; the chatbot
	// (retrieval) branch additionally requires a fresh user turn — any other turn takes the
	// plain deskbot streaming path. Computed BEFORE conversation resolution so it can be
	// stamped on the conversation at creation. The surface's profile is what the turn is
	// composed from: its identity, its capabilities, its tools.
	const isFreshUserTurn = lastRawMsg?.role === 'user' && !!userMsgText;
	const surface: AiSurface = isFreshUserTurn && input.surface === 'chatbot' ? 'chatbot' : 'deskbot';
	const profile = PROFILES[surface];
	// The desk corpus's state decides whether `desk_search_knowledge` is mounted at all; read
	// once per desk turn, alongside the provider and conversation resolution below.
	const deskCorpus =
		surface === 'deskbot' && grantedScopes.includes('desk:ask') ? deskCorpusState(userId) : Promise.resolve(undefined);

	// Use the tool-capable provider when the profile mounts tools, fall back to the chat model
	// without them. The chatbot brings its retrieval tools on every turn, so it routes to the
	// tool-capable model too — otherwise grounding tool calls run on the chat model and
	// silently fail to fire.
	const wantsTools = profile.wantsTools({ scopes: grantedScopes });
	const availableToolProvider = wantsTools
		? await resolveAvailableToolProvider(resolvedToolProvider, configuredProviders)
		: null;
	const hasTools = wantsTools && !!availableToolProvider;
	const model = availableToolProvider?.model ?? resolvedChatModel;
	// Resolved provider/model attribution for the trace's model calls and for the
	// stream-error circuit breaker. MUTABLE: the chatbot branch rotates providers mid-turn
	// (see `streamTextIntoOpenMessage`), and every reader below must attribute the failure/step to
	// the provider that is actually running, not the one the turn started on.
	let currentProviderId = hasTools ? (availableToolProvider?.provider.id ?? null) : (activeInfo?.id ?? null);
	let currentModelId = hasTools ? (availableToolProvider?.provider.modelId ?? null) : (activeInfo?.model ?? null);

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
	// frame), keys the persisted row and keys the turn trace every `model_call` points at.
	const assistantMsgId = crypto.randomUUID();
	const requestId = crypto.randomUUID();

	// The turn's one trace author. Every branch below reports to it; the client receives its
	// snapshot on each metadata frame and the owner reads the persisted trace back by message id.
	const recorder = createTurnRecorder({
		conversationId: conversationId ?? null,
		messageId: assistantMsgId,
		surface,
		requestId,
		userId,
		t0: turnStartedAt,
	});
	// What the turn brings to the profile — the awareness is recorded when the turn is composed.
	const turn: TurnInput = {
		userId,
		userMsgText,
		locale: catalogLocale,
		authCeiling: awarenessCeiling(authCeiling),
		hasTools,
		toolsCooled: wantsTools && !availableToolProvider,
		// The Google connection the guard's registry already opened: every embed of this turn
		// (the shared query vector, a page-seeded retrieve, `search_project_docs`) rides it
		// instead of reading and decrypting the provider rows again.
		embeddingConnection: registry.embeddingConnection(),
		pageContext: pageContext ?? null,
		scopes: grantedScopes,
		deskCorpus: await deskCorpus,
		panelContext,
		deskLayout,
		activeWorkspace,
		onCompacted: (name, compaction) => recorder.compacted(name, compaction),
	};
	const promptHistoryChars = historyChars(recorder.history(messages, rawMessages.length - windowedMessages.length));

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

		// chatbot path — primary answer surface: Vely, composed from the chatbot profile.
		if (surface === 'chatbot') {
			// Set once the assistant message is closed (or the stream ended on an error frame):
			// no trace change may write a metadata frame after that.
			let closed = false;
			const stream = createUIMessageStream({
				execute: async ({ writer }) => {
					// Open the assistant message frame BEFORE any `message-metadata` write.
					// This branch emits trace metadata before the merged text stream's own
					// `start`; without an explicit leading `start` the v6 client materializes a
					// FIRST (empty) assistant message to hold that early metadata, then the merge's
					// own `start` (different id) appends a SECOND. One `start` up front → one message.
					// Reusing this id for the merged stream (via `sendStart: false`) also makes the
					// client message id match the persisted DB row (inserted above, before the stream).
					writer.write({ type: 'start', messageId: assistantMsgId });
					const preStreamMs = Math.round(performance.now() - turnStartedAt);
					recorder.timing({ preStreamMs });

					// Every metadata frame carries the FULL trace snapshot (the client deep-merges
					// objects and REPLACES arrays, so every key is always present), so a burst of
					// recorder changes — four assembly lanes settling, a tool finishing — is worth
					// exactly one frame. `flush` schedules one write per burst; `flushNow` drains it
					// where the order against other frames matters (before the first model frame,
					// before `finish`). Nothing is written once the message is closed — a frame after
					// `finish` would open a second, empty message on the client.
					let flushPending = false;
					const flushNow = () => {
						if (!flushPending || closed) return;
						flushPending = false;
						writer.write({ type: 'message-metadata', messageMetadata: { trace: recorder.snapshot() } });
					};
					const flush = () => {
						if (flushPending || closed) return;
						flushPending = true;
						setTimeout(flushNow, METADATA_FLUSH_MS);
					};
					recorder.subscribe(flush);

					// ONE DOOR: the profile composes the turn — every capability's rule, the grounding
					// lanes under one shared embed, the prompt block by block, the tools that follow from
					// what the prompt carries. What it decided and built lands on the recorder.
					const composition = await composeTurn(profile, turn, recorder);
					const { systemPrompt, tools, stepBudget } = composition;

					const generateStart = performance.now();
					// Set by the final attempt failure: the turn closes as `error` with the same
					// timing shape a clean turn gets.
					let generateFailure: AiErrorKind | null = null;

					// `assistantMsgId` was persisted before the stream (so the `start` frame carries it
					// and the trace has a valid FK); its content is backfilled in afterText.
					let stepsStarted = 0;
					let awaitingFirstToken = true;

					// Tools are SPREAD, not passed unconditionally: when every tool-capable provider is
					// cooled (`hasTools === false`) the turn must run genuinely tool-less. Mounting
					// tools on a cooled-out turn is what produced "I searched the catalog…" answers
					// with zero tool calls behind them. Paired with the honest-degrade NOTE above.
					// `prepareStep` withholds the tools on the last allowed step, so the budget ends in an
					// answer rather than on a tool call nothing will execute (`policy/step-budget.ts`).
					const toolOpts = hasTools
						? {
								tools,
								toolChoice: 'auto' as const,
								stopWhen: stepCountIs(stepBudget),
								prepareStep: answerOnLastStep(stepBudget),
							}
						: {};
					const blockIds = () => composition.blocks.map((b) => b.id);

					// A fresh `streamText` per attempt — the call fires on invocation and its signal
					// (`modelCallSignal`) is single-use, so a fallback cannot reuse the primary's.
					const makeStream = (attemptModel: LanguageModel) => {
						// The assembly's trace precedes the first model frame.
						flushNow();
						return streamText({
							// The middleware records each provider request as it leaves (prompt hash,
							// history count, tools with schemas); the hooks below record its answer.
							model: traceModelCalls(attemptModel, recorder, { blockIds }),
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
								console.warn(`[ai:chat:chatbot] suppressed textual tool-call leak: ${lead}…`),
							),
							experimental_onStepStart: () => {
								stepsStarted++;
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
									recorder.firstToken();
								}
							},
							experimental_onToolCallFinish: (event) => {
								const { toolCall, durationMs } = event;
								recorder.tool({
									toolCallId: toolCall.toolCallId,
									toolName: toolCall.toolName,
									input: toolCall.input,
									durationMs,
									...(event.success
										? { output: event.output, status: 'success' as const }
										: {
												status: 'error' as const,
												errorMessage: event.error instanceof Error ? event.error.message : String(event.error),
											}),
								});
							},
							onStepFinish: (step) => {
								recorder.callEnd({
									stepIndex: step.stepNumber,
									usage: step.usage,
									finishReason: step.finishReason,
									responseId: step.response?.id,
									responseModel: step.response?.modelId,
									textChars: step.text?.length ?? 0,
									toolCalls: (step.toolCalls ?? []).map((tc) => ({ toolCallId: tc.toolCallId, toolName: tc.toolName })),
									warnings: step.warnings?.map((w) => ('message' in w ? String(w.message) : w.type)),
								});
							},
							// The one place the raw provider error is logged. The trace never carries it:
							// the streaming helper reports the attempt through `onAttemptFailure`, which
							// records the classified kind.
							onError: ({ error }) => {
								console.error('[ai:chat:chatbot] Stream error:', error);
							},
						});
					};

					// Post-text work runs while the assistant message is still OPEN (the streaming helper
					// closes it with a single `finish` only after this resolves) — so the citation
					// metadata flushed here lands on the right message instead of after the `finish` frame.
					const afterText = async (rawText: string, totalUsage: LanguageModelUsage) => {
						// The model is done; everything below runs while the message is still open and
						// is what the client sees as the gap between the last token and `finish`.
						const generateMs = Math.round(performance.now() - generateStart);
						recorder.timing({ generateMs });
						const finalize: NonNullable<TurnTimings['finalize']> = {};
						const timed = async (stage: keyof typeof finalize, work: () => Promise<void>) => {
							const from = performance.now();
							try {
								await work();
							} finally {
								finalize[stage] = Math.round(performance.now() - from);
							}
						};
						try {
							await finalizeTurn(rawText, totalUsage, finalize, timed);
						} finally {
							recorder.timing({ finalize: { ...finalize } });
							if (generateFailure) recorder.outcome('error', generateFailure);
							else if (cancellation.signal.aborted) recorder.outcome('cancelled');
							else recorder.attemptEnd('ok');
							// The trace is written after the answer's own row so the turn joins a
							// backfilled message, and before `finish` so the function is still alive;
							// the cached totals are summed from its model-call rows, so they follow it.
							await timed('persistMs', async () => {
								await recorder.persist();
								if (conversationId) await refreshConversationTokens(conversationId);
							});
							recorder.timing({ finalize: { ...finalize } });
							// One sanitized line per turn: ids, milliseconds and tool names — never text.
							const recorded = recorder.trace();
							const ms = (value: number | undefined) => (value === undefined ? '-' : String(value));
							const laneMs = recorded.grounding.map((g) => `${g.id}:${ms(g.ms)}`).join(',');
							console.info(
								`[ai:chat:timing] requestId=${requestId} preStream=${preStreamMs} embed=${ms(composition.embedMs)} ` +
									`lanes=[${laneMs}] generate=${generateMs} steps=${stepsStarted} ` +
									`firstToken=[${(recorded.timings.firstTokenMs ?? []).join(',')}] reasoning=${ms(totalUsage?.outputTokenDetails?.reasoningTokens)} ` +
									`tools=[${recorded.toolExecutions.map((t) => `${t.toolName}:${t.durationMs ?? '-'}`).join(',')}] ` +
									`finalize={catalog:${ms(finalize.catalogMs)},` +
									`persist:${ms(finalize.persistMs)},budget:${ms(finalize.budgetMs)}} ` +
									`queries=${observedQueryCount() ?? '-'}`,
							);
							// The last metadata frame must precede the `finish` the helper writes next.
							flushNow();
							closed = true;
						}
					};
					const finalizeTurn = async (
						rawText: string,
						totalUsage: LanguageModelUsage,
						finalize: NonNullable<TurnTimings['finalize']>,
						timed: (stage: keyof NonNullable<TurnTimings['finalize']>, work: () => Promise<void>) => Promise<void>,
					) => {
						// Mirror the stream guard: if the whole turn was a textual tool-call
						// leak (`<function=…>`), blank it before persistence / citation
						// verification so the leak isn't saved or counted as an answer.
						const text = stripTextualToolCall(rawText);
						// The capabilities verify the answer: the catalog's paths (surfaced → cited; a
						// path nothing surfaced → `unsurfaced`). Each stage is timed under the
						// capability that ran it.
						const verified = await composition.verify(text);
						if (verified.stages.catalog !== undefined) finalize.catalogMs = verified.stages.catalog;
						// The durable writes — backfill the assistant row (text + the parts a reload
						// renders), charge the Redis budget — are independent of each other and run
						// together. ALL of them are awaited, whatever fails: they must land before
						// `finish` (a function is frozen once its response completes), and a failed
						// write is logged, never allowed to cost the user an answer that already streamed.
						// The trace and the cached totals follow in `afterText`, once the answer row exists.
						const outcomes = await Promise.allSettled([
							conversationId
								? updateMessageContent(assistantMsgId, text, storedParts(text, recorder.trace().toolExecutions))
								: Promise.resolve(),
							totalUsage
								? timed('budgetMs', () =>
										chargeTokens(userId, (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0)),
									)
								: Promise.resolve(),
						]);
						for (const outcome of outcomes) {
							if (outcome.status === 'rejected') console.error('[ai:chat:chatbot] Failed to finalize:', outcome.reason);
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
						estimateTurnTokens(systemPrompt.length + promptHistoryChars, hasTools ? 2 : 1),
					);

					// Pump text into the open message, run afterText, then close — citation/persist
					// metadata flushes BEFORE the finish frame (fixes the empty-answer / answer⟷trace desync).
					// The same promise is handed to the platform: a client disconnect must not take the
					// function down before the cancelled turn's tail has persisted what streamed.
					const streamed = streamTextIntoOpenMessage(writer, attempts, afterText, {
						signal: cancellation.signal,
						isSkipped: (id) => (id ? isCooledDown(id) : Promise.resolve(false)),
						// The client left: the helper persists what streamed (through `afterText`) and
						// closes the message; nothing is cooled and no error frame is written.
						onCancellation: ({ providerId: cancelledId, contentParts }) => {
							recorder.attemptEnd('cancelled', { contentParts });
							console.info(
								`[ai:chat:chatbot] turn cancelled by the client requestId=${requestId} provider=${cancelledId ?? 'unknown'} contentParts=${contentParts}`,
							);
						},
						onAttemptStart: (attempt) => {
							// Re-point attribution at the provider actually running this attempt.
							currentProviderId = attempt.providerId;
							currentModelId = attempt.modelId;
							stepsStarted = 0;
							awaitingFirstToken = true;
							recorder.attemptStart({ providerId: attempt.providerId, modelId: attempt.modelId });
						},
						onAttemptFailure: async ({ providerId: failedId, error, willRetry }: AttemptFailure) => {
							const { kind } = classifyAiError(error);
							console.error(
								`[ai:chat:chatbot] attempt failed provider=${failedId ?? 'unknown'} kind=${kind} willRetry=${willRetry}`,
							);
							// Every failed attempt lands here exactly once — retry or final — so this is
							// the chatbot turn's one cooldown door; the stream's `onError` only formats.
							coolProvider(failedId, kind);
							recorder.attemptEnd(willRetry ? 'rotated' : 'failed', { errorKind: kind });
							if (willRetry) return;
							// Final: the turn closes as `error` with the classified kind — never the
							// provider's prose. Drained now, before the helper closes the message
							// (a partial answer) or the stream ends on the error frame.
							generateFailure = kind;
							recorder.outcome('error', kind);
							flushNow();
						},
					});
					holdOpenUntil(streamed);
					await streamed;
					closed = true;
				},
				// A failure that left the message empty rethrows out of the helper to here: the ONE
				// `[kind] message` error frame the client parses. The attempt was logged and cooled
				// by the hook; a turn no provider could take (every one cooled) only passes here.
				// The trace is still written: a turn that failed is a turn the owner can inspect.
				onError: (error) => {
					const text = aiErrorFrameText(error);
					console.warn(`[ai:chat:chatbot] turn ended on an error frame requestId=${requestId} ${text.split(' ')[0]}`);
					closed = true;
					recorder.outcome('error', classifyAiError(error).kind);
					void recorder.persist();
					return text;
				},
			});
			return createUIMessageStreamResponse({ stream: cancellation.body(stream), headers: responseHeaders });
		}

		// deskbot path — the surface === 'deskbot' fallthrough, which also takes any non-fresh
		// turn. Streams through the same helper as the chatbot: one open message, provider
		// rotation before the first content part, a classified error frame when nothing reached
		// the client. The assistant row (`assistantMsgId`) is already persisted above. The desk
		// profile has no retrieval lane, so the composition is ready before the stream opens.
		const deskComposition: TurnComposition = await composeTurn(profile, turn, recorder);
		const { systemPrompt, tools: deskTools, stepBudget: maxSteps } = deskComposition;
		const hasDeskTools = Object.keys(deskTools).length > 0;
		let stepCounter = 0;

		/**
		 * Harness metadata accumulator — per SVEY's gotcha, `message-metadata`
		 * events REPLACE (not merge) on the client, so every write must include
		 * the full accumulated object. The chatbot path already does this for the
		 * trace snapshot; here we do the same for `harness.proposal` events.
		 */
		const harnessMetadata: HarnessMetadata = {};
		// See the chatbot branch: no metadata frame once the message is closed.
		let closed = false;

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				// One assistant message, opened here with the persisted row's id (see the chatbot
				// branch): the client's message id is the DB's, and the proposal metadata written
				// from `onStepFinish` lands inside the message the helper keeps open.
				writer.write({ type: 'start', messageId: assistantMsgId });
				recorder.timing({ preStreamMs: Math.round(performance.now() - turnStartedAt) });

				// The desk client reads `harness` only; the trace snapshot rides on the same frames
				// so a desk turn is inspectable like a chatbot turn. Batched per microtask like
				// the chatbot's, drained before `finish`.
				let flushPending = false;
				const flushNow = () => {
					if (!flushPending || closed) return;
					flushPending = false;
					writer.write({
						type: 'message-metadata',
						messageMetadata: { harness: harnessMetadata, trace: recorder.snapshot() },
					});
				};
				const flush = () => {
					if (flushPending || closed) return;
					flushPending = true;
					setTimeout(flushNow, METADATA_FLUSH_MS);
				};
				recorder.subscribe(flush);

				type ToolResultRecord = {
					toolCallId: string;
					toolName: string;
					input?: unknown;
					output?: unknown;
				};
				const onStepFinish = async (step: {
					stepNumber?: number;
					toolCalls?: Array<{ toolCallId: string; toolName: string }>;
					toolResults?: ToolResultRecord[];
					usage?: LanguageModelUsage;
					finishReason?: string;
					text?: string;
					warnings?: Array<{ type: string; message?: string }>;
					response?: { id?: string; modelId?: string };
				}) => {
					const currentStep = stepCounter++;
					const results = step.toolResults ?? [];

					// The approval boundary. A gated tool or `desk_propose_plan` asked for approval:
					// persist the proposal FIRST — it is the one write the user is about to act on —
					// then stream the card. `stopWhen` ends the loop after this step, so a turn has
					// at most one proposal; a second request would only ever come from a step the
					// loop already stopped before.
					const approval = collectApprovalRequests(results);
					let proposalPersisted = approval.steps.length === 0;
					if (conversationId && approval.steps.length > 0 && !harnessMetadata.proposal) {
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
								riskTier: proposal.riskTier,
								status: 'pending',
							};
							proposalPersisted = true;
							recorder.proposal(proposal.id);
							recorder.outcome('awaiting_decision');
						} catch (err) {
							console.error('[ai:chat] Failed to persist proposal:', err);
							// No card without a row: a card the approve route cannot find would be
							// a promise nobody keeps. The tool records below carry the failure too.
							harnessMetadata.proposalError = {
								message: 'The plan could not be saved for approval. Nothing was changed.',
							};
						}
						// Always write the full accumulated object — metadata REPLACES on client.
						flushPending = true;
						flushNow();
					}

					// The tool executions of this step: the hook below already timed them; here each
					// gets its status — an error the tool returned, or an approval request the
					// proposal row could not be written for.
					for (const tr of results) {
						const output = tr.output && typeof tr.output === 'object' ? (tr.output as Record<string, unknown>) : {};
						const hasError = 'error' in output;
						const sentinel = isApprovalSentinel(tr.output);
						const orphanedSentinel = !proposalPersisted && sentinel;
						recorder.tool({
							toolCallId: tr.toolCallId,
							toolName: tr.toolName,
							input: tr.input ?? {},
							output: tr.output,
							status: hasError || orphanedSentinel ? 'error' : sentinel ? 'requires_approval' : 'success',
							errorMessage: hasError
								? String(output.error)
								: orphanedSentinel
									? 'Approval request lost: the proposal could not be persisted.'
									: undefined,
						});
					}

					recorder.callEnd({
						stepIndex: step.stepNumber ?? currentStep,
						usage: step.usage,
						finishReason: step.finishReason,
						responseId: step.response?.id,
						responseModel: step.response?.modelId,
						textChars: step.text?.length ?? 0,
						toolCalls: (step.toolCalls ?? []).map((tc) => ({ toolCallId: tc.toolCallId, toolName: tc.toolName })),
						warnings: step.warnings?.map((w) => w.message ?? w.type),
					});
				};

				const blockIds = () => deskComposition.blocks.map((b) => b.id);
				const makeStream = (attemptModel: LanguageModel) =>
					streamText({
						model: traceModelCalls(attemptModel, recorder, { blockIds }),
						system: systemPrompt,
						messages,
						maxRetries: 0,
						maxOutputTokens: MAX_TOKENS,
						abortSignal: modelCallSignal(cancellation, input.deadline),
						// Net for Groq/llama emitting a tool call as plain text (`<function=…>`).
						// The desk branch routes to the SAME tool-capable provider as the chatbot
						// branch (which already guards at the chatbot stream), so without this a
						// Groq-routed desk turn leaks raw tool-call markup into the UI.
						experimental_transform: createToolLeakGuard((lead) =>
							console.warn(`[ai:chat:desk] suppressed textual tool-call leak: ${lead}…`),
						),
						...(hasDeskTools
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
									// `wrapToolsWithCompaction` in the composition, with the whole request inside
									// a `runWithCompaction` context so refs resolve consistently.
								}
							: {}),
						experimental_onToolCallFinish: (event) => {
							recorder.tool({
								toolCallId: event.toolCall.toolCallId,
								toolName: event.toolCall.toolName,
								input: event.toolCall.input,
								durationMs: event.durationMs,
								...(event.success
									? {}
									: { errorMessage: event.error instanceof Error ? event.error.message : String(event.error) }),
							});
						},
						onStepFinish,
					});

				// The durable tail of a finished (or cut) turn: the answer's row (text + parts), the
				// trace, then the totals (summed from the trace's model calls) and the budget charge.
				// A cut turn arrives here with the partial text the client received and unknown
				// usage, so it is stored but not charged.
				const afterText = async (text: string, totalUsage: LanguageModelUsage) => {
					if (cancellation.signal.aborted) recorder.outcome('cancelled');
					else if (recorder.trace().attempts.at(-1)?.outcome === 'started') recorder.attemptEnd('ok');
					// The capabilities' verifiers: the desk chunks the search tool surfaced join the
					// trace as the `desk` source's items.
					await deskComposition.verify(text);
					if (!conversationId) {
						flushNow();
						closed = true;
						return;
					}
					const tokens = (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0);
					const persisted = await Promise.allSettled([
						text || recorder.trace().toolExecutions.length
							? updateMessageContent(assistantMsgId, text, storedParts(text, recorder.trace().toolExecutions))
							: Promise.resolve(),
						recorder.persist(),
					]);
					const outcomes = await Promise.allSettled([
						refreshConversationTokens(conversationId),
						tokens > 0 ? chargeTokens(userId, tokens) : Promise.resolve(),
					]);
					for (const outcome of [...persisted, ...outcomes]) {
						if (outcome.status === 'rejected') console.error('[ai:chat:desk] Failed to finalize:', outcome.reason);
					}
					// The last metadata frame precedes the `finish` the helper writes next.
					flushNow();
					closed = true;
				};

				// Current-turn provider rotation: primary first, then every configured fallback that
				// can still serve this turn. A desk turn never rotates once a tool has run — the
				// helper pins the attempt at its first content part, and a tool part is one.
				const attempts = buildTurnAttempts(
					{ providerId: currentProviderId, modelId: currentModelId, model },
					configuredProviders,
					makeStream,
					hasTools,
					estimateTurnTokens(systemPrompt.length + promptHistoryChars, hasTools ? 2 : 1),
				);
				const streamed = streamTextIntoOpenMessage(writer, attempts, afterText, {
					signal: cancellation.signal,
					isSkipped: (id) => (id ? isCooledDown(id) : Promise.resolve(false)),
					onCancellation: ({ providerId: cancelledId, contentParts }) => {
						recorder.attemptEnd('cancelled', { contentParts });
						console.info(
							`[ai:chat:desk] turn cancelled by the client provider=${cancelledId ?? 'unknown'} contentParts=${contentParts} steps=${stepCounter}`,
						);
					},
					onAttemptStart: (attempt) => {
						// Re-point attribution at the provider actually running this attempt.
						currentProviderId = attempt.providerId;
						currentModelId = attempt.modelId;
						recorder.attemptStart({ providerId: attempt.providerId, modelId: attempt.modelId });
					},
					onAttemptFailure: async ({ providerId: failedId, error, willRetry }: AttemptFailure) => {
						const { kind } = classifyAiError(error);
						console.error(
							`[ai:chat:desk] attempt failed provider=${failedId ?? 'unknown'} kind=${kind} willRetry=${willRetry}`,
						);
						// Every failed attempt lands here exactly once — retry or final — so this is the
						// desk turn's one cooldown door; the stream's `onError` only formats.
						coolProvider(failedId, kind);
						recorder.attemptEnd(willRetry ? 'rotated' : 'failed', { errorKind: kind });
						if (!willRetry) recorder.outcome('error', kind);
					},
				});
				// Same as the chatbot: the cancelled turn's tail must outlive the disconnect.
				holdOpenUntil(streamed);
				await streamed;
				closed = true;
			},
			onError: (error) => {
				// A turn no provider could take is still a recorded turn.
				closed = true;
				recorder.outcome('error', classifyAiError(error).kind);
				void recorder.persist();
				return classifyStreamError(error);
			},
		});
		return createUIMessageStreamResponse({ stream: cancellation.body(stream), headers: responseHeaders });
	} catch (err) {
		// Error hygiene: a DB failure is NOT an AI failure. `classifyAiError`'s substring rules
		// ('rate' → rate_limit, 'token' → context_length) cheerfully mislabel Postgres messages,
		// which then cooled a perfectly healthy provider and burned a fallback turn on an outage
		// no model can fix. Surface it honestly instead — no cooldown, no fallback.
		if (err instanceof DbError) {
			console.error('[ai:chat] DB failure surfaced through orchestrator:', err);
			return Response.json({ error: { code: err.kind, message: safeDbMessage(err.kind) } }, { status: err.toStatus() });
		}

		// Nothing before the stream opens talks to a provider (the chatbot composes inside the
		// stream, the desk profile has no retrieval lane), so this is a plain failure: no cooldown,
		// no fallback — `streaming-turn.ts` owns provider rotation for the turn itself.
		const aiErr = classifyAiError(err);
		return Response.json(
			{ error: { code: aiErr.kind, message: safeAiMessage(aiErr.kind) } },
			{ status: aiErrorToStatus(aiErr.kind), headers: { 'X-AI-Error-Kind': aiErr.kind } },
		);
	}
}
