/**
 * The history helpers: message-text extraction and the context window.
 *
 * These cases lived inside `chat-orchestrator.test.ts` behind eighteen `vi.mock`
 * calls — not because any of them needed a mock, but because they shared a file with
 * an import whose graph reaches Neon, Redis, retrieval and the AI SDK. `history.ts`
 * is edge-free, so here it is exercised directly, with none.
 */

import type { UIMessage } from 'ai';
import { describe, expect, it } from 'vitest';
import { getMessageText, windowMessages } from './history';

const msg = (role: 'user' | 'assistant', text: string): UIMessage => ({
	id: `${role}-${text}`,
	role,
	parts: [{ type: 'text', text }],
});

// 1. getMessageText

describe('getMessageText', () => {
	it('extracts text from UIMessage with a single text part', () => {
		const msg: UIMessage = {
			id: 'x',
			role: 'user',
			parts: [{ type: 'text', text: 'hi there' }],
		};
		expect(getMessageText(msg)).toBe('hi there');
	});

	it('joins multiple text parts with newline', () => {
		const msg: UIMessage = {
			id: 'x',
			role: 'user',
			parts: [
				{ type: 'text', text: 'line one' },
				{ type: 'text', text: 'line two' },
			],
		};
		expect(getMessageText(msg)).toBe('line one\nline two');
	});

	it('ignores non-text parts (tool-invocation, etc.)', () => {
		const msg: UIMessage = {
			id: 'x',
			role: 'assistant',
			parts: [
				{ type: 'source-url', sourceId: 's1', url: 'https://example.com', title: 'test' },
				{ type: 'text', text: 'done' },
			],
		};
		expect(getMessageText(msg)).toBe('done');
	});

	it('returns empty string for UIMessage with no text parts', () => {
		const msg: UIMessage = {
			id: 'x',
			role: 'assistant',
			parts: [{ type: 'source-url', sourceId: 's1', url: 'https://example.com', title: 'test' }],
		};
		expect(getMessageText(msg)).toBe('');
	});
});

// 2. windowMessages

describe('windowMessages', () => {
	it('returns all messages when count is within maxTurns * 2', () => {
		const messages = [msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c'), msg('assistant', 'd')];
		const result = windowMessages(messages, 5);
		expect(result).toHaveLength(4);
		expect(result).toEqual(messages);
	});

	it('slices to last maxTurns*2 messages when over budget', () => {
		const messages = Array.from({ length: 12 }, (_, i) => msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`));
		const result = windowMessages(messages, 5);
		expect(result).toHaveLength(10);
		expect(getMessageText(result[0])).toBe('msg 2');
		expect(getMessageText(result[9])).toBe('msg 11');
	});

	it('result starts with user-role message after slicing', () => {
		const messages = Array.from({ length: 12 }, (_, i) => msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`));
		const result = windowMessages(messages, 5);
		expect(result[0].role).toBe('user');
	});

	it('drops leading assistant message after slicing odd-aligned input', () => {
		const messages = Array.from({ length: 11 }, (_, i) => msg(i % 2 === 0 ? 'assistant' : 'user', `msg ${i}`));
		const result = windowMessages(messages, 2);
		expect(result[0].role).toBe('user');
	});

	it('handles empty array', () => {
		expect(windowMessages([], 5)).toHaveLength(0);
	});

	it('handles single user message', () => {
		const messages = [msg('user', 'hello')];
		const result = windowMessages(messages, 5);
		expect(result).toHaveLength(1);
		expect(result[0].role).toBe('user');
	});

	it('handles odd message count within budget', () => {
		const messages = [msg('user', 'a'), msg('assistant', 'b'), msg('user', 'c')];
		expect(windowMessages(messages, 5)).toHaveLength(3);
	});

	it('returns same reference (no copy) at exact boundary of maxTurns*2', () => {
		const messages = Array.from({ length: 10 }, (_, i) => msg(i % 2 === 0 ? 'user' : 'assistant', `msg ${i}`));
		expect(windowMessages(messages, 5)).toBe(messages);
	});

	it('slices correctly with maxTurns=1', () => {
		const messages = [
			msg('user', 'old'),
			msg('assistant', 'old reply'),
			msg('user', 'new'),
			msg('assistant', 'new reply'),
		];
		const result = windowMessages(messages, 1);
		expect(result).toHaveLength(2);
		expect(getMessageText(result[0])).toBe('new');
	});
});
