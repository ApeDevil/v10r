import * as v from 'valibot';
import { DESK_TOOL_SCOPES } from '$lib/types/ai-tools';

const MessageRole = v.picklist(['user', 'assistant']);

/**
 * UIMessage part — AI SDK v6 emits dynamic `tool-<toolName>` part types with
 * `state: 'output-available'|'input-available'|...`, so we accept any
 * `type` that starts with `tool-` via a loose object check and validate
 * the fixed parts strictly.
 */
const FixedUIMessagePart = v.union([
	v.object({ type: v.literal('text'), text: v.pipe(v.string(), v.maxLength(32_000)) }),
	v.object({ type: v.literal('file'), url: v.string(), mediaType: v.string() }),
	v.object({ type: v.literal('source-url'), url: v.string(), title: v.optional(v.string()) }),
	v.object({ type: v.literal('reasoning'), text: v.string() }),
	v.object({ type: v.literal('step-start') }),
]);

const DynamicToolPart = v.object({
	type: v.pipe(
		v.string(),
		v.check((s) => s.startsWith('tool-'), 'tool part type must start with "tool-"'),
	),
	toolCallId: v.optional(v.string()),
	state: v.optional(v.string()),
	input: v.optional(v.unknown()),
	output: v.optional(v.unknown()),
	errorText: v.optional(v.string()),
});

const UIMessagePart = v.union([FixedUIMessagePart, DynamicToolPart]);

/** Accept both legacy {role, content} and UIMessage {id, role, parts} formats. */
const ChatMessageSchema = v.union([
	v.object({
		role: MessageRole,
		content: v.pipe(v.string(), v.minLength(1), v.maxLength(32_000)),
	}),
	v.object({
		id: v.string(),
		role: MessageRole,
		parts: v.array(UIMessagePart),
		metadata: v.optional(v.unknown()),
	}),
]);

const PanelContextEntry = v.object({
	panelType: v.string(),
	label: v.string(),
	content: v.pipe(v.string(), v.maxLength(16_000)),
	status: v.optional(v.picklist(['focused', 'active', 'background'])),
	contentLevel: v.optional(v.picklist(['full', 'summary', 'title-only'])),
	tokenEstimate: v.optional(v.number()),
});

const ToolScope = v.picklist(DESK_TOOL_SCOPES);

const DeskLayoutEntry = v.object({
	panelId: v.string(),
	fileId: v.optional(v.string()),
	fileType: v.optional(v.string()),
	label: v.string(),
});

/**
 * Fields every AI-surface request carries. Spread into each per-surface schema below so
 * the common envelope stays defined once. All three schemas use `v.object` (NOT
 * `v.strictObject`) so the AI SDK's transport envelope fields (`id`, `trigger`,
 * `messageId`, …) pass through and unknown keys are dropped rather than 400'd.
 */
const baseEntries = {
	providerId: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(20))),
	messages: v.pipe(v.array(ChatMessageSchema), v.minLength(1), v.maxLength(100)),
	conversationId: v.optional(v.pipe(v.string(), v.uuid())),
};

/**
 * Site-awareness lookup key: the raw `page.route.id` of the page the user asked from
 * (e.g. `/[[locale=locale]]/(public)/showcases/forms`). An UNTRUSTED lookup key — the
 * server resolves it against the public catalog and discards it on miss; it is never
 * echoed into the prompt. The tight charset rejects `:` `?` `#` `%` whitespace and
 * `<>"'` breakout chars (it still allows the route-group `()`, `[]` and `=` that a
 * SvelteKit route id legitimately contains). See `docs/blueprint/ai/site-awareness.md`.
 */
const PageRouteId = v.optional(v.pipe(v.string(), v.maxLength(120), v.regex(/^\/(?!\/)[A-Za-z0-9/_\-[\]().=]*$/)));

/**
 * `POST /api/ai/chatbot` — the read-only, grounded v10r-expert surface. Carries the shared
 * envelope + site-awareness (`pageRouteId`). Accepts NO desk-mutation fields — a chatbot
 * request's parsed output can never carry `toolScopes`/`deskLayout`/`activeWorkspace`/
 * `resumeFromProposalId` into the orchestrator. See `docs/blueprint/ai/surfaces.md`.
 */
export const ChatbotRequestSchema = v.object({
	...baseEntries,
	pageRouteId: PageRouteId,
});

/**
 * `POST /api/ai/context-probe` — the showcase context x-ray (`/showcases/ai/*#probe`).
 * Runs the SAME gates + retrieval + prompt assembly as a real turn (shared modules)
 * but never calls the LLM. `toolScopes` only shapes the deskbot report (which tools
 * mount, whether the plan governor fires) — the probe cannot execute anything.
 */
export const ContextProbeRequestSchema = v.object({
	surface: v.picklist(['chatbot', 'deskbot']),
	query: v.pipe(v.string(), v.minLength(1), v.maxLength(2000)),
	pageRouteId: PageRouteId,
	toolScopes: v.optional(v.pipe(v.array(ToolScope), v.maxLength(5))),
});

/**
 * `POST /api/ai/deskbot` — the in-desk operator surface (agentic, mutating, plan-gated).
 * Carries the shared envelope + the desk-mutation fields. Accepts NO retrieval/site
 * fields. See `docs/blueprint/ai/surfaces.md`.
 */
export const DeskRequestSchema = v.object({
	...baseEntries,
	panelContext: v.optional(v.pipe(v.array(PanelContextEntry), v.maxLength(5))),
	/** Tool permission scopes — empty or omitted means no tools. */
	toolScopes: v.optional(v.pipe(v.array(ToolScope), v.maxLength(5))),
	/** Current desk layout so AI knows what panels are open. */
	deskLayout: v.optional(v.pipe(v.array(DeskLayoutEntry), v.maxLength(20))),
	/** Active workspace name for AI context. */
	activeWorkspace: v.optional(
		v.object({
			id: v.string(),
			name: v.string(),
		}),
	),
	/**
	 * When present, the chat turn is a "resume after approval" continuation
	 * of a previously approved `agent_proposal`. The orchestrator looks up
	 * the proposal's execution result and injects it as a synthetic tool
	 * result in the model's context instead of re-running the plan.
	 *
	 * Sent by the client after hitting `POST /api/ai/proposals/:id/approve`.
	 */
	resumeFromProposalId: v.optional(v.string()),
});

export const CreateConversationSchema = v.object({
	title: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(200))),
});
