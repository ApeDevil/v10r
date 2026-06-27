/**
 * Chat orchestration — domain module.
 * Handles conversation management, retrieval integration, streaming, and fallback rotation.
 * No SvelteKit imports — reusable from AI tools, REST, and background jobs.
 */
import {
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
	type LanguageModelUsage,
	type ModelMessage,
	stepCountIs,
	streamText,
	type UIMessage,
} from 'ai';
import type { SearchLocale, SearchResult } from '$lib/search/types';
import { getActiveProvider, getActiveProviderInfo, getFallbacksForUser, getToolProvider } from '$lib/server/ai';
import { chargeTokens } from '$lib/server/ai/budget';
import { MAX_TOKENS } from '$lib/server/ai/config';
import {
	buildPromptAssembledEvent,
	buildSystemPrompt,
	formatCurrentPageBlock,
	getMessageText,
	windowMessages,
} from '$lib/server/ai/context/system-prompt';
import { aiErrorToStatus, classifyAIError, safeAIMessage } from '$lib/server/ai/errors';
import { compactToolResults, DEFAULT_BUDGET, runWithCompaction } from '$lib/server/ai/loop/compact';
import { shouldRequirePlan } from '$lib/server/ai/policy';
import { incrProvider429 } from '$lib/server/ai/provider-usage';
import type { ProviderEntry } from '$lib/server/ai/providers';
import { isCooledDown, markCooldown } from '$lib/server/ai/providers';
import { buildRetrievalTools, createDeskTools, type DeskToolScope, stepsForScopes } from '$lib/server/ai/tools';
import { PROJECT_DOCS_COLLECTION_ID, SYSTEM_DOCS_USER_ID } from '$lib/server/config';
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
import type { ProposalExecutionResult } from '$lib/server/db/schema/ai/proposal';
import { MAX_RAWRAG_TOOL_CALLS_PER_TURN } from '$lib/server/llmwiki/config';
import { loadOverview } from '$lib/server/llmwiki/overview';
import { searchLlmwiki } from '$lib/server/llmwiki/search';
import { verifyCitations } from '$lib/server/llmwiki/verify';
import { formatLlmwikiContext } from '$lib/server/llmwiki/wiki-format';
import { formatContextForPrompt, retrieve } from '$lib/server/rawrag';
import { buildSearchIndex, formatCatalogMap, type PageContext } from '$lib/server/search';
import {
	type ChunkSummary,
	LANE_OF,
	type LlmwikiCitationsEvent,
	PHASE_OF,
	type PipelineChunksEvent,
	type PipelinePromptEvent,
	type PipelineStepEvent,
} from '$lib/types/pipeline';
import { streamTextIntoOpenMessage } from './_shared/streaming-turn';
import { verifyCatalogCitations } from './catalog-citations';
import { shapeDrilledCitations } from './citations/drill';
import { createToolLeakGuard, stripTextualToolCall } from './tool-leak-guard';

/** A legacy simple message or a full UIMessage from the AI SDK v6 client. */
export type ChatMessage = { role: 'user' | 'assistant'; content: string } | UIMessage;

/**
 * Which AI surface a turn belongs to — the explicit dispatch discriminant.
 * - `chatbot`  — the v10r expert: read-only, grounded, citation-faithful Q&A.
 * - `deskbot`  — the in-desk operator: agentic, mutating, plan-gated UI parity.
 * - `rag-demo` — the showcase retrieval pipeline demo (not a product surface).
 */
export type TurnSurface = 'chatbot' | 'deskbot' | 'rag-demo';

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
	 * Explicit surface discriminant. Set by the per-surface routes (Phase 3); when
	 * absent it is derived from the legacy `useLlmwiki`/`useRetrieval` flags so existing
	 * clients keep working. Resolved to a concrete {@link TurnSurface} in the orchestrator.
	 */
	surface?: TurnSurface;
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
	/** Auth ceiling for catalog visibility (server-derived from `event.locals.user.role`). */
	authCeiling?: string | null;
	/**
	 * Site-awareness (chatbot only): the page the user is asking from, ALREADY resolved
	 * server-side at the route boundary (`resolvePageContext`) to trusted catalog metadata.
	 * Null when the route didn't resolve (unknown/dynamic/private). Drives the passive
	 * `<current-page>` block + the deixis-gated retrieval seed. See `site-awareness.md`.
	 */
	pageContext?: PageContext | null;
	/**
	 * Ephemeral run (the rag-chat counterfactual): skip ALL persistence —
	 * resolveConversation, the conversation-limit check, message + step rows — so a
	 * throwaway "run without RAG" comparison doesn't create a conversation or count
	 * against the user's limit. The token budget is STILL charged (the tokens were
	 * really spent; skipping it would be a metered-bypass abuse vector).
	 */
	dryRun?: boolean;
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

/**
 * Admin check, framework-free (mirrors `auth/guards.isAdmin` without its SvelteKit
 * import so this domain module stays reusable). `ADMIN_USER_ID` is a comma list of ids.
 * Gates the FULL prompt TEXT in the trace — never the token counts.
 */
function isAdminUser(userId: string): boolean {
	const raw = process.env.ADMIN_USER_ID;
	if (!raw) return false;
	return raw
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean)
		.includes(userId);
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
 * Orchestrate a chat request: resolve conversation, optionally retrieve context,
 * stream the response, and persist messages.
 *
 * Runs the entire request inside a compaction context (`runWithCompaction`) so
 * tool results above the budget are transparently replaced with refs the model
 * can pull back via `resolve_ref` — the AI SDK #9631 workaround.
 *
 * Returns a Response (either streaming or error JSON).
 */
/**
 * Relevance gate for the chatbot's system-docs prefetch (user choice: relevance-gated,
 * not always-on). The chatbot is always about v10r, so we prefetch the system-owned docs
 * corpus by default — but skip trivial turns (greetings, acks, very short messages) so an
 * embedding+retrieval round-trip isn't paid when there's no real question to ground. This
 * closes the "fresh user with an empty llmwiki gets zero project knowledge" gap without a
 * per-turn cost on chit-chat.
 */
function shouldGroundFromSystemDocs(text: string): boolean {
	const t = text.trim();
	if (t.length < 12) return false;
	if (/^(hi|hey|hello|yo|thanks|thank you|ty|ok|okay|k|yes|no|sure|cool|nice|great|lol|hm+)\b[\s!.?]*$/i.test(t)) {
		return false;
	}
	return true;
}

/**
 * Site-awareness deixis gate: does this message point AT the current page ("this", "here",
 * "how does this work", "explain this", "this feature/component/showcase")? Only then do we
 * spend the (already-paid) retrieval embed on a page-seeded query — keeping the page out of
 * the 90% of questions that name their own topic. Deterministic; tune the anchors freely.
 */
function referencesCurrentPage(text: string): boolean {
	return /\b(this|current)\s+(page|feature|component|showcase|section|demo|example|thing)\b|how (?:does|do) (?:this|it|these)\b|what(?:'s| is| are) (?:this|these|here)\b|explain (?:this|it|the page)\b|on this page\b|\bright here\b/i.test(
		text,
	);
}

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
		resumeFromProposalId,
		locale,
		authCeiling,
		pageContext,
		dryRun,
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
	const resolvedToolModel = resolvedToolProvider?.getInstance() ?? null;
	const resolvedToolProviderId = resolvedToolProvider?.id ?? null;
	const resolvedFallbacks = getFallbacksForUser(userId, providerId);

	if (!resolvedChatModel) {
		return Response.json({ error: { code: 'ai_unavailable', message: 'No AI provider configured.' } }, { status: 503 });
	}

	// Use tool-capable provider when tools requested, fall back to chatModel without tools.
	// The llmwiki + rawrag retrieval branches attach their own tools (search_catalog, llmwiki/
	// rawrag drill-down) even without desk scopes, so they must route to the tool-capable model
	// too — otherwise grounding tool calls run on the chat model and silently fail to fire.
	const wantsTools = !!toolScopes?.length || !!useLlmwiki || !!useRetrieval;
	const toolProviderAvailable =
		!!resolvedToolModel && !!resolvedToolProviderId && !(await isCooledDown(resolvedToolProviderId));
	const hasTools = wantsTools && toolProviderAvailable;
	const model = (hasTools ? resolvedToolModel : resolvedChatModel) ?? resolvedChatModel;
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
	// Resolved provider/model attribution for per-step telemetry (conversation_step).
	// The tool provider drives the turn when tools are mounted; otherwise the chat provider.
	const stepProviderId = hasTools ? resolvedToolProviderId : (activeInfo?.id ?? null);
	const stepModelId = hasTools ? (resolvedToolProvider?.model ?? null) : (activeInfo?.model ?? null);
	// --- Plan-before-execute gate (policy/governor.ts) ---
	// Pre-turn estimate of whether this is a destructive, multi-capability, multi-target
	// desk turn that must produce a plan first. Wiring this is what makes the `<planning>`
	// block inject and `desk_propose_plan` reachable — the governor was dead code before
	// (never called), so the model was never instructed to plan. Heuristic is deliberately
	// conservative and tunable; it activates more as the deskbot grows structural tools.
	// Chatbot turns have no mutating scopes, so requirePlan is always false for them.
	const grantedScopes = toolScopes ?? [];
	const lastRawMsg = windowedMessages[windowedMessages.length - 1];
	const userMsgText = lastRawMsg?.role === 'user' ? getMessageText(lastRawMsg) : '';

	// --- Explicit surface discriminant ---
	// One named dispatch decision (replaces implicit branch-guard truthiness). `input.surface`
	// (set by the Phase-3 per-surface routes) wins; otherwise it derives from the legacy
	// `useLlmwiki`/`useRetrieval` flags. The retrieval surfaces additionally require a fresh
	// user turn — resume turns degrade to the plain deskbot streaming path. Computed BEFORE
	// conversation resolution so it can be stamped on the conversation at creation.
	const isFreshUserTurn = lastRawMsg?.role === 'user' && !!userMsgText && !resumeContext;
	let surface: TurnSurface = 'deskbot';
	if (isFreshUserTurn) {
		const requested = input.surface ?? (useLlmwiki ? 'chatbot' : useRetrieval ? 'rag-demo' : 'deskbot');
		if (requested === 'chatbot' || requested === 'rag-demo') surface = requested;
	}
	// rag-demo is a showcase, not a persisted product surface — its conversations carry no
	// surface stamp (daty: ai_surface is a closed two-member enum).
	const stampSurface: 'chatbot' | 'deskbot' | undefined = surface === 'rag-demo' ? undefined : surface;

	// --- Plan-before-execute gate (policy/governor.ts) ---
	// Pre-turn estimate of whether this is a destructive, multi-capability, multi-target
	// desk turn that must produce a plan first. Wiring this is what makes the `<planning>`
	// block inject and `desk_propose_plan` reachable — the governor was dead code before
	// (never called). Heuristic is deliberately conservative and tunable; it activates more
	// as the deskbot grows structural tools. Chatbot turns have no mutating scopes → false.
	// "Structural" capabilities (create/delete files) are the destructive surface; in-place
	// content writes (desk:write) are not counted as structurally destructive.
	const structuralCapabilityCount = grantedScopes.filter((s) => s === 'desk:create' || s === 'desk:delete').length;
	// Distinct desk entities visible to the turn — a proxy for "how many targets".
	const targetEntityCount = new Set([
		...(panelContext ?? []).map((p) => p.label),
		...(deskLayout ?? []).map((p) => p.fileId ?? p.label),
	]).size;
	const hasMutatingScopeGranted = grantedScopes.some(
		(s) => s === 'desk:write' || s === 'desk:create' || s === 'desk:delete',
	);
	const requirePlan = shouldRequirePlan({
		destructiveIntent:
			hasMutatingScopeGranted &&
			/\b(delete|remove|clear|wipe|purge|erase|drop|reset|bulk|all|every|each|multiple)\b/i.test(userMsgText),
		destructiveToolCount: structuralCapabilityCount,
		targetEntityCount,
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
	// any newly-created conversation). dryRun (counterfactual) skips persistence entirely:
	// conversationId stays undefined → every `if (conversationId)` block below no-ops, and the
	// limit check (inside resolveConversation's create path) is skipped. chargeTokens still runs.
	let conversationId: string | undefined;
	if (!dryRun) {
		const convResult = await resolveConversation(userId, existingConvId, windowedMessages, stampSurface);
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

		// Circuit breaker for rate limits during streaming
		if (aiErr.kind === 'rate_limit') {
			const failedProvider = hasTools ? resolvedToolProviderId : (activeInfo?.id ?? null);
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
					// Site-awareness: did the system-docs retrieval actually return page-relevant chunks?
					// Drives the honest-abstention block when the user asks about a page we have no docs for.
					let docsGrounded = false;
					// Does this turn point at the current page? (Gates both the retrieval seed and the
					// abstention.) Scoped out here so both the in-try seed and the post-try injection see it.
					const wantsPageGrounding = !!pageContext && referencesCurrentPage(userMsgText);
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

					try {
						const overviewStart = performance.now();
						emit({
							type: 'pipeline:step',
							step: 'llmwiki:overview',
							status: 'active',
							startOffsetMs: Math.round(overviewStart - t0),
						});
						const searchStart = performance.now();
						emit({
							type: 'pipeline:step',
							step: 'llmwiki:search',
							status: 'active',
							startOffsetMs: Math.round(searchStart - t0),
						});

						// Relevance-gated system-docs grounding runs in PARALLEL with llmwiki. llmwiki is
						// per-user (empty for a fresh user); the system-owned docs corpus is always there,
						// so this is what guarantees the "v10r expert" answers even with no personal wiki.
						const groundDocs = shouldGroundFromSystemDocs(userMsgText);
						// Site-awareness: when the user points AT the current page ("how does this work?"),
						// the bare message embeds to noise — seed the system-docs query with the resolved
						// page title/breadcrumb so it actually retrieves THIS page's docs. Server-authored
						// text only (the embed query never carries the client string); reuses the embed
						// `groundDocs` already pays for → zero extra quota. Gate on the RAW message
						// (`wantsPageGrounding`, hoisted above).
						const docsQuery =
							wantsPageGrounding && pageContext
								? `${pageContext.title}. ${pageContext.breadcrumb.join(' ')}. ${userMsgText}`
								: userMsgText;
						// Make the otherwise-invisible parallel system-docs retrieve a coarse trace lane
						// (one bracketed step, not the engine's sub-steps — those ids collide with llmwiki's).
						const docsStart = performance.now();
						if (groundDocs) {
							emit({
								type: 'pipeline:step',
								step: 'system-docs',
								status: 'active',
								startOffsetMs: Math.round(docsStart - t0),
							});
						}
						const [overviewResult, hitsResult, docsResult, sysOverviewResult] = await Promise.allSettled([
							loadOverview([userId], collectionId),
							searchLlmwiki(userMsgText, { userId, collectionId }),
							groundDocs
								? retrieve(docsQuery, { userId: SYSTEM_DOCS_USER_ID, tiers: [1], maxChunks: 4 })
								: Promise.resolve(null),
							// System-owned project map — grounds broad questions even with an empty personal wiki.
							loadOverview([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID),
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
								error:
									overviewResult.reason instanceof Error
										? overviewResult.reason.message
										: String(overviewResult.reason),
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
								dispositionReason: 'pointer-only',
							}));
							emit({
								type: 'pipeline:chunks',
								tierChunks: { llmwiki: llmwikiSummaries },
								rankedChunks: [],
								contextChunks: [],
							});

							const overview = overviewResult.status === 'fulfilled' ? overviewResult.value : null;
							const ctxStart = performance.now();
							emit({
								type: 'pipeline:step',
								step: 'llmwiki:context',
								status: 'active',
								startOffsetMs: Math.round(ctxStart - t0),
							});
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
							for (const h of hits) {
								promptContextBlocks.push({ chunkId: h.slug, tokens: Math.ceil(h.tldr.length / 4) });
							}
						} else {
							emit({
								type: 'pipeline:step',
								step: 'llmwiki:search',
								status: 'error',
								durationMs: searchMs,
								error: hitsResult.reason instanceof Error ? hitsResult.reason.message : String(hitsResult.reason),
							});
						}

						// System-docs overview anchor — the canonical high-level "what is v10r" map, owned by
						// the system corpus (not the user), so it grounds broad questions even when the user's
						// personal wiki is empty. Always injected when present.
						if (sysOverviewResult.status === 'fulfilled' && sysOverviewResult.value) {
							systemPrompt = `${systemPrompt}

<project-overview>
${sysOverviewResult.value.title}

${sysOverviewResult.value.body}
</project-overview>

The <project-overview> above is the canonical high-level map of v10r (a full-stack reference & test-sandbox). Use it to orient broad questions like "what is v10r" or "how do I use it"; ground specifics from the retrieval context and catalog below.`;
						}

						// System-docs lane terminal — close the coarse `system-docs` bar (gated on groundDocs;
						// a failure here is the embedding 429 that would otherwise vanish into allSettled).
						if (groundDocs) {
							const docsMs = Math.round(performance.now() - docsStart);
							if (docsResult.status === 'fulfilled') {
								const docsChunks = docsResult.value?.chunks ?? [];
								emit({
									type: 'pipeline:step',
									step: 'system-docs',
									status: 'done',
									durationMs: docsMs,
									detail: {
										kind: 'tier',
										tierNumber: 1,
										chunksFound: docsChunks.length,
										topSources: docsChunks
											.slice(0, 3)
											.map((c) => ({ title: c.documentTitle, score: Math.round(c.score * 1000) / 1000 })),
									},
								});
							} else {
								emit({
									type: 'pipeline:step',
									step: 'system-docs',
									status: 'error',
									durationMs: docsMs,
									error: docsResult.reason instanceof Error ? docsResult.reason.message : String(docsResult.reason),
								});
							}
						}

						// System-docs grounding (relevance-gated, parallel above). Injected regardless of
						// whether llmwiki had hits — this is the coverage net for users with an empty wiki.
						if (docsResult.status === 'fulfilled' && docsResult.value && docsResult.value.chunks.length > 0) {
							const docsBlock = formatContextForPrompt(docsResult.value);
							if (docsBlock) {
								docsGrounded = true;
								for (const c of docsResult.value.chunks) {
									promptContextBlocks.push({ chunkId: c.chunkId, tokens: Math.ceil(c.content.length / 4) });
								}
								systemPrompt = `${systemPrompt}

<retrieval-context>
${docsBlock}
</retrieval-context>

The <retrieval-context> above is retrieved from the project's OWN documentation — treat it as authoritative for how and why v10r is built. When you cite a /docs path or link, surface it via \`search_catalog\` (never invent paths).`;
							}
						}
					} catch (err) {
						console.error('[ai:chat:llmwiki] Retrieval failed, proceeding without context:', err);
					}

					// Site-awareness: passive `<current-page>` block (always-on when the route resolved,
					// soft by framing) so the model can bind "this"/"here" to the page. Honest abstention
					// when the user points at a page we retrieved no docs for — server-driven, not left to
					// the model's self-knowledge. See `docs/blueprint/ai/site-awareness.md`.
					if (pageContext) {
						systemPrompt = `${systemPrompt}\n\n${formatCurrentPageBlock(pageContext)}`;
						if (wantsPageGrounding && !docsGrounded) {
							systemPrompt = `${systemPrompt}\n\nNo page-specific documentation was retrieved for "${pageContext.title}". Do not fabricate specifics about this page; if the user is asking about it, say plainly you don't have page-specific docs for it, then offer general project knowledge or where to look.`;
						}
					}

					// Catalog grounding — always available alongside llmwiki. The search_catalog tool
					// is the ONLY authoritative source of project paths; a compact, path-free map orients
					// the model so it knows the catalog exists and when to reach for it.
					systemPrompt = `${systemPrompt}

${formatCatalogMap(catalogLocale)}

Project catalog rules:
1. To find WHERE a page, component/showcase, doc, or blog post lives — or to give the user a link — call \`search_catalog\`. It returns exact canonical paths.
2. Emit a path or link ONLY if it appears verbatim in a \`search_catalog\` result from THIS turn (or a verified llmwiki pointer). NEVER invent or guess a path.
3. If \`search_catalog\` returns nothing for what the user asked, say it isn't in the catalog — do not fabricate a plausible URL.
4. Use \`search_catalog\` for navigation / "what exists"; use the llmwiki pages for explaining how something works.`;

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
										surface: stampSurface,
										inputTokens: usage?.inputTokens ?? 0,
										outputTokens: usage?.outputTokens ?? 0,
										providerId: stepProviderId,
										modelId: stepModelId,
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
					// Pump text into the open message, run afterText, then close — citation/catalog/persist
					// metadata flushes BEFORE the finish frame (fixes the empty-answer / answer⟷trace desync).
					await streamTextIntoOpenMessage(writer, textResult, afterText);
				},
				onError: classifyStreamError,
			});
			return createUIMessageStreamResponse({ stream, headers: responseHeaders });
		}

		// rag-demo (showcase retrieval) path — uses createUIMessageStream for custom pipeline events
		if (surface === 'rag-demo') {
			const requestId = crypto.randomUUID();
			const generateStartedAt = { t: 0 };
			const stream = createUIMessageStream({
				execute: async ({ writer }) => {
					// Open the assistant message frame BEFORE any `message-metadata` write (same
					// rationale as the llmwiki branch: early metadata + a later merge-emitted
					// `start` with a different id => duplicate empty assistant message).
					const assistantMsgId = crypto.randomUUID();
					if (conversationId) {
						await saveMessages(conversationId, userId, [{ id: assistantMsgId, role: 'assistant', content: '' }]);
					}
					writer.write({ type: 'start', messageId: assistantMsgId });

					// Turn t0 — one origin shared by retrieve() (threaded below) and generate, so the
					// waterfall renders true parallel-tier overlap. See nrag-observability.md.
					const t0 = performance.now();

					let systemPrompt = baseSystemPrompt;

					type AnyPipelineEvent = PipelineStepEvent | PipelineChunksEvent | PipelinePromptEvent;
					const pipelineEvents: AnyPipelineEvent[] = [];
					// Accepts raw step literals (from this branch) AND fully-formed events (from the
					// rawrag engine, which already stamped phase/lane); re-deriving them is idempotent.
					const emitEvent = (event: RawStepInput | PipelineChunksEvent | PipelinePromptEvent) => {
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
						writer.write({ type: 'message-metadata', messageMetadata: { pipeline: pipelineEvents } });
					};

					try {
						const retrievalResult = await retrieve(
							userMsgText,
							{ userId, maxChunks: 3, tiers: retrievalTiers ?? [1], fusion },
							emitEvent,
							t0,
						);

						const contextBlock = formatContextForPrompt(retrievalResult);
						if (contextBlock) {
							systemPrompt = `${baseSystemPrompt}\n\n<retrieval-context>\n${contextBlock}\n</retrieval-context>\n\nUse the above context to inform your response. Cite sources when relevant.`;
						}

						// Emit assembled prompt (dev/admin only receives full text; others get hash)
						const contextBlocks = retrievalResult.chunks.map((c) => ({
							chunkId: c.chunkId,
							tokens: Math.ceil(c.content.length / 4),
						}));
						emitEvent(
							buildPromptAssembledEvent({
								userPrompt: userMsgText,
								systemPrompt,
								contextBlocks,
								totalTokens: contextBlocks.reduce((sum, b) => sum + b.tokens, 0),
								isDevOrAdmin: !!import.meta.env?.DEV || isAdminUser(userId),
							}),
						);
					} catch (err) {
						console.error('[ai:chat] Retrieval failed, proceeding without context:', err);
					}

					generateStartedAt.t = performance.now();
					emitEvent({
						type: 'pipeline:step',
						step: 'generate',
						status: 'active',
						startOffsetMs: Math.round(generateStartedAt.t - t0),
					});

					// `assistantMsgId` was created + persisted at the top of `execute` (so the
					// `start` frame can carry it); its content is backfilled in onFinish below.
					const textResult = streamText({
						model,
						system: systemPrompt,
						messages,
						maxRetries: 0,
						maxOutputTokens: MAX_TOKENS,
						abortSignal: AbortSignal.timeout(30_000),
						onError: ({ error }) => {
							console.error('[ai:chat:retrieval] Stream error:', error);
							// Terminal for generate so the bar can't hang `active` on a 503 / 30s abort.
							emitEvent({
								type: 'pipeline:step',
								step: 'generate',
								status: 'error',
								durationMs: Math.round(performance.now() - generateStartedAt.t),
								error: error instanceof Error ? error.message : String(error),
							});
						},
					});

					// Post-text work runs while the message is still OPEN; the helper writes the single
					// `finish` only after it resolves, so metadata never lands after the finish frame.
					const afterText = async (text: string, totalUsage: LanguageModelUsage) => {
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
						// Single-step turn (no tools): persist one step + backfill the message.
						if (conversationId) {
							try {
								await saveConversationStep({
									conversationId,
									messageId: assistantMsgId,
									stepIndex: 0,
									stepType: 'initial',
									surface: stampSurface,
									inputTokens: totalUsage?.inputTokens ?? 0,
									outputTokens: totalUsage?.outputTokens ?? 0,
									providerId: stepProviderId,
									modelId: stepModelId,
									durationMs: Math.round(performance.now() - generateStartedAt.t),
								});
								await updateMessageContent(assistantMsgId, text);
								await refreshConversationTokens(conversationId);
							} catch (err) {
								console.error('[ai:chat:retrieval] Failed to finalize:', err);
							}
						}
						if (totalUsage) {
							await chargeTokens(userId, (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0));
						}
					};
					// Pump text into the open message, run afterText, then close with one `finish`.
					await streamTextIntoOpenMessage(writer, textResult, afterText);
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
					// NOTE: per-step tool-result compaction used to live here via `prepareStep`,
					// but AI SDK #9631 silently drops message mutations returned from `prepareStep`.
					// Compaction is now applied at tool-execute time via `wrapToolsWithCompaction`
					// inside `createDeskTools`, and the whole request runs inside a
					// `runWithCompaction` context (see below) so refs resolve consistently.
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

					const deskNowT = performance.now();
					const deskDurationMs = Math.round(deskNowT - lastStepAt);
					lastStepAt = deskNowT;
					try {
						await saveConversationStep({
							conversationId,
							messageId: assistantMsgId,
							stepIndex: currentStep,
							stepType: currentStep === 0 ? 'initial' : 'tool-result',
							surface: stampSurface,
							inputTokens: usage?.inputTokens ?? 0,
							outputTokens: usage?.outputTokens ?? 0,
							toolCallIds: toolCallIds.length > 0 ? toolCallIds : undefined,
							providerId: stepProviderId,
							modelId: stepModelId,
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
		const aiErr = classifyAIError(err);

		// Circuit breaker: cooldown the provider that just failed with rate limit
		if (aiErr.kind === 'rate_limit') {
			const failedProvider = hasTools ? resolvedToolProviderId : (activeInfo?.id ?? null);
			if (failedProvider) {
				void markCooldown(failedProvider);
				void incrProvider429(failedProvider);
			}
		}

		if (['unavailable', 'timeout', 'unknown', 'rate_limit'].includes(aiErr.kind)) {
			// Per-surface fallback. Only a genuine DESK turn (real desk scopes) may mount desk
			// tools. A failed CHATBOT turn (useLlmwiki, no scopes) previously re-derived
			// createDeskTools with undefined scopes — mounting an empty/wrong toolset and
			// contaminating the surface. It now falls back tool-less on any provider (ungrounded
			// but honest); the full grounded-fallback contract lands with the Phase-1 per-surface
			// pipeline extraction, where each surface owns its own fallback closure.
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
