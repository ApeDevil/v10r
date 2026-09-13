/**
 * Conversation history helpers — the message-side half of a turn's context.
 *
 * Pure functions, no provider, no persistence. The system-prompt side lives with the
 * profiles (`ai/profile/`): what the assistant is told about itself is the profile's,
 * what it is told about the conversation so far is here.
 */
import type { ChatMessage } from '../types';

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
 * Stable short hash of a system prompt — the non-cryptographic identifier the turn trace
 * keeps per model call (`systemHash`: was the same prompt sent on every step?), hashes
 * the stable blocks + tool definitions into (`profileVersion`: is the prefix the same across
 * turns?) and the profile manifest stamps as its `version`. ONE implementation for all
 * three, or they could never be compared.
 */
export function hashSystemPrompt(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = ((h << 5) - h + s.charCodeAt(i)) | 0;
	}
	return `sys:${Math.abs(h).toString(16)}`;
}
