/**
 * System prompt assembly and message-windowing helpers.
 *
 * Part of the "context" slice of the AI harness (see
 * `docs/blueprint/ai/harness-lens.md`). Pure functions — no provider,
 * no streaming, no persistence. The orchestrator composes these into
 * a system prompt immediately before `streamText`.
 *
 * Ordering inside `buildSystemPrompt` matters for prompt caching: the
 * cache-stable prefix (`<role>` → `<instructions>` → `<completion>`)
 * comes first, variable tail (`<permissions>` → `<desk-context>` →
 * `<desk-layout>`) after. Per-user content lives in the tail so the
 * cached prefix hits across users.
 */
import {
	buildPermissionsBlock,
	COMPLETION_BLOCK,
	DESK_SYSTEM_PROMPT,
	PLANNING_BLOCK,
	SYSTEM_PROMPT,
} from '$lib/server/ai/config';
import type { DeskToolScope } from '$lib/server/ai/tools/_types';
import type { RetrievalPromptEvent } from '$lib/types/retrieval-trace';
import { escapeXmlAttr, escapeXmlText } from '$lib/utils/xml';
import type { ChatMessage } from '../types';

/** Context data used to assemble the system prompt. */
export interface SystemPromptInput {
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
	/** When true, inject the `<planning>` block. Driven by `shouldRequirePlan` in `policy/governor.ts`. */
	requirePlan?: boolean;
}

/** Extract text content from a ChatMessage (handles both legacy and UIMessage format). */
export function getMessageText(msg: ChatMessage): string {
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
export function windowMessages(messages: ChatMessage[], maxTurns = 5): ChatMessage[] {
	const maxMessages = maxTurns * 2;
	if (messages.length <= maxMessages) return messages;
	const result = messages.slice(-maxMessages);
	// Ensure context starts with a user message (some providers reject assistant-first).
	if (result.length > 0 && result[0].role === 'assistant') {
		return result.slice(1);
	}
	return result;
}

/**
 * Stable short hash of a system prompt — used as a non-cryptographic identifier
 * in pipeline events when the full prompt isn't safe to expose (non-dev/admin).
 *
 * ONE implementation for both retrieval branches in the chat orchestrator: two
 * hashes would make cross-branch event correlation impossible.
 */
export function hashSystemPrompt(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) - h + s.charCodeAt(i)) | 0;
	}
	return `sys:${Math.abs(h).toString(16)}`;
}

/**
 * Build a `pipeline:prompt_assembled` event from the assembled prompt + retrieval
 * context. Dev/admin callers receive the full system prompt; others get a stable
 * hash via `hashSystemPrompt`. Returns the event for the caller to emit — keeps
 * the function pure and decoupled from the emitter shape (which differs per path).
 */
export function buildPromptAssembledEvent(opts: {
	userPrompt: string;
	systemPrompt: string;
	contextBlocks: { chunkId: string; tokens: number }[];
	totalTokens: number;
	isDevOrAdmin: boolean;
}): RetrievalPromptEvent {
	const event: RetrievalPromptEvent = {
		type: 'pipeline:prompt_assembled',
		userPrompt: opts.userPrompt,
		contextBlocks: opts.contextBlocks,
		totalTokens: opts.totalTokens,
		// Ungated count (chars/4 estimate, incl. injected context) — a count is not a leak,
		// so the token panel can show system vs context vs output regardless of role.
		systemPromptTokens: Math.ceil(opts.systemPrompt.length / 4),
		estimated: true,
	};
	if (opts.isDevOrAdmin) {
		event.systemPrompt = opts.systemPrompt;
	} else {
		event.systemPromptHash = hashSystemPrompt(opts.systemPrompt);
	}
	return event;
}

/**
 * Site-awareness: the passive `<current-page>` block injected into the chatbot's grounding
 * tail when the route resolves. Soft by framing — it cannot scope-trap an off-topic question.
 * The content is server-resolved (catalog) and XML-escaped; the client string never reaches it.
 * See `docs/blueprint/ai/site-awareness.md`.
 */
export function formatCurrentPageBlock(page: {
	path: string;
	title: string;
	breadcrumb: string[];
	surface: string;
}): string {
	const trail = page.breadcrumb.length ? ` (${page.breadcrumb.join(' › ')})` : '';
	return [
		`<current-page route="${escapeXmlAttr(page.path)}" kind="${escapeXmlAttr(page.surface)}">`,
		`The user is currently viewing: ${escapeXmlAttr(page.title + trail)}.`,
		`Treat this only as the referent of "this", "here", or "this page". The user's explicit topic always wins over the current page.`,
		`</current-page>`,
	].join('\n');
}

// Re-exported so existing imports (and their tests) keep working; the
// implementations moved to $lib/utils/xml so the retrieval layer can share them.
export { escapeXmlAttr, escapeXmlText };

/** Identity of one block in the assembled base system prompt. */
export type SystemPromptBlockId =
	| 'role'
	| 'completion'
	| 'planning'
	| 'permissions'
	| 'workspace'
	| 'desk-context'
	| 'desk-layout';

/** One block of the base system prompt — id + the text it contributes. */
export interface SystemPromptBlock {
	id: SystemPromptBlockId;
	text: string;
}

/**
 * Build the system prompt from `SystemPromptInput`, as an ordered block list.
 *
 * When `toolScopes` is empty (pure retrieval chat with no desk access),
 * every desk-related block is skipped — the single biggest token win
 * in the prompt assembly path.
 *
 * The block list is the single source of truth: `buildSystemPrompt` joins it,
 * and the context-probe endpoint reports it (ids + sizes) — so the probe's
 * prompt outline structurally cannot drift from what a real turn assembles.
 */
export function buildSystemPromptBlocks(input: SystemPromptInput): SystemPromptBlock[] {
	const { panelContext, toolScopes, deskLayout, activeWorkspace, requirePlan } = input;
	const hasTools = !!toolScopes?.length;

	// Cache-stable prefix: role + instructions + completion guidance (+ planning when required).
	const blocks: SystemPromptBlock[] = [{ id: 'role', text: hasTools ? DESK_SYSTEM_PROMPT : SYSTEM_PROMPT }];
	if (hasTools) {
		blocks.push({ id: 'completion', text: COMPLETION_BLOCK });
		if (requirePlan) {
			blocks.push({ id: 'planning', text: PLANNING_BLOCK });
		}
	}

	// Pure retrieval chat with no desk tools — no desk blocks at all.
	if (!hasTools) return blocks;

	// Variable tail — per-user / per-request.
	if (toolScopes) {
		blocks.push({ id: 'permissions', text: buildPermissionsBlock(toolScopes) });
	}

	if (activeWorkspace) {
		blocks.push({ id: 'workspace', text: `The user is in workspace "${escapeXmlAttr(activeWorkspace.name)}".` });
	}

	if (panelContext?.length) {
		const sanitized = panelContext.map((pc) => ({
			...pc,
			content: pc.content.replace(/(?:sk-|ghp_|AKIA|Bearer\s)\S+/gi, '[REDACTED]').slice(0, 8000),
		}));
		const deskBlock = sanitized
			.map((pc) => {
				const statusAttr = pc.status ? ` status="${escapeXmlAttr(pc.status)}"` : '';
				const levelAttr = pc.contentLevel ? ` level="${escapeXmlAttr(pc.contentLevel)}"` : '';
				// Content is escaped like every sibling value. Unescaped, a desk file
				// containing `</panel></desk-context>` closes the block early and the
				// rest of that file reads as prompt rather than data — to a model
				// holding desk:write / desk:delete tools.
				return `<panel type="${escapeXmlAttr(pc.panelType)}" label="${escapeXmlAttr(pc.label)}"${statusAttr}${levelAttr}>\n${escapeXmlText(pc.content)}\n</panel>`;
			})
			.join('\n');
		blocks.push({ id: 'desk-context', text: `<desk-context>\n${deskBlock}\n</desk-context>` });
	}

	// Compressed desk layout — `{ id, type, title }` only, no positions/sizes/styles.
	if (deskLayout?.length) {
		const layoutBlock = deskLayout
			.map((p) => {
				const idPart = p.fileId ? ` [${escapeXmlAttr(p.fileId)}]` : '';
				const typePart = escapeXmlAttr(p.fileType ?? 'panel');
				return `- ${escapeXmlAttr(p.label)} (${typePart})${idPart}`;
			})
			.join('\n');
		blocks.push({ id: 'desk-layout', text: `<desk-layout>\n${layoutBlock}\n</desk-layout>` });
	}

	return blocks;
}

/** Build the system prompt string — the joined block list. */
export function buildSystemPrompt(input: SystemPromptInput): string {
	return buildSystemPromptBlocks(input)
		.map((b) => b.text)
		.join('\n\n');
}
