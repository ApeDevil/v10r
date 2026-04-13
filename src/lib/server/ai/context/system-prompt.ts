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
import type { UIMessage } from 'ai';
import {
	buildPermissionsBlock,
	COMPLETION_BLOCK,
	DESK_SYSTEM_PROMPT,
	PLANNING_BLOCK,
	SYSTEM_PROMPT,
} from '$lib/server/ai/config';
import type { DeskToolScope } from '$lib/server/ai/tools/_types';

/** A legacy simple message or a full UIMessage from the AI SDK v6 client. */
export type ChatMessage = { role: 'user' | 'assistant'; content: string } | UIMessage;

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

/** Escape XML-special characters to prevent attribute breakout in system prompts. */
export function escapeXmlAttr(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Build the system prompt from `SystemPromptInput`.
 *
 * When `toolScopes` is empty (pure retrieval chat with no desk access),
 * every desk-related block is skipped — the single biggest token win
 * in the prompt assembly path.
 */
export function buildSystemPrompt(input: SystemPromptInput): string {
	const { panelContext, toolScopes, deskLayout, activeWorkspace, requirePlan } = input;
	const hasTools = !!toolScopes?.length;

	// Cache-stable prefix: role + instructions + completion guidance (+ planning when required).
	let prompt = hasTools ? DESK_SYSTEM_PROMPT : SYSTEM_PROMPT;
	if (hasTools) {
		prompt += `\n\n${COMPLETION_BLOCK}`;
		if (requirePlan) {
			prompt += `\n\n${PLANNING_BLOCK}`;
		}
	}

	// Pure retrieval chat with no desk tools — no desk blocks at all.
	if (!hasTools) return prompt;

	// Variable tail — per-user / per-request.
	if (toolScopes) {
		prompt += `\n\n${buildPermissionsBlock(toolScopes)}`;
	}

	if (activeWorkspace) {
		prompt += `\n\nThe user is in workspace "${escapeXmlAttr(activeWorkspace.name)}".`;
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
				return `<panel type="${escapeXmlAttr(pc.panelType)}" label="${escapeXmlAttr(pc.label)}"${statusAttr}${levelAttr}>\n${pc.content}\n</panel>`;
			})
			.join('\n');
		prompt += `\n\n<desk-context>\n${deskBlock}\n</desk-context>`;
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
		prompt += `\n\n<desk-layout>\n${layoutBlock}\n</desk-layout>`;
	}

	return prompt;
}
