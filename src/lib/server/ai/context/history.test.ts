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

// 1. getMessageText

describe('getMessageText', () => {
	it('returns content from legacy {role, content} format', () => {
		expect(getMessageText({ role: 'user', content: 'hello' })).toBe('hello');
	});

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

	it('returns empty string for legacy message with empty content', () => {
		expect(getMessageText({ role: 'user', content: '' })).toBe('');
	});
});

// 2. windowMessages

describe('windowMessages', () => {
	it('returns all messages when count is within maxTurns * 2', () => {
		const messages = [
			{ role: 'user' as const, content: 'a' },
			{ role: 'assistant' as const, content: 'b' },
			{ role: 'user' as const, content: 'c' },
			{ role: 'assistant' as const, content: 'd' },
		];
		const result = windowMessages(messages, 5);
		expect(result).toHaveLength(4);
		expect(result).toEqual(messages);
	});

	it('slices to last maxTurns*2 messages when over budget', () => {
		const messages = Array.from({ length: 12 }, (_, i) => ({
			role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
			content: `msg ${i}`,
		}));
		const result = windowMessages(messages, 5);
		expect(result).toHaveLength(10);
		expect((result[0] as { content: string }).content).toBe('msg 2');
		expect((result[9] as { content: string }).content).toBe('msg 11');
	});

	it('result starts with user-role message after slicing', () => {
		const messages = Array.from({ length: 12 }, (_, i) => ({
			role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
			content: `msg ${i}`,
		}));
		const result = windowMessages(messages, 5);
		expect(result[0].role).toBe('user');
	});

	it('drops leading assistant message after slicing odd-aligned input', () => {
		const messages = Array.from({ length: 11 }, (_, i) => ({
			role: (i % 2 === 0 ? 'assistant' : 'user') as 'user' | 'assistant',
			content: `msg ${i}`,
		}));
		const result = windowMessages(messages, 2);
		expect(result[0].role).toBe('user');
	});

	it('handles empty array', () => {
		expect(windowMessages([], 5)).toHaveLength(0);
	});

	it('handles single user message', () => {
		const messages = [{ role: 'user' as const, content: 'hello' }];
		const result = windowMessages(messages, 5);
		expect(result).toHaveLength(1);
		expect(result[0].role).toBe('user');
	});

	it('handles odd message count within budget', () => {
		const messages = [
			{ role: 'user' as const, content: 'a' },
			{ role: 'assistant' as const, content: 'b' },
			{ role: 'user' as const, content: 'c' },
		];
		expect(windowMessages(messages, 5)).toHaveLength(3);
	});

	it('returns same reference (no copy) at exact boundary of maxTurns*2', () => {
		const messages = Array.from({ length: 10 }, (_, i) => ({
			role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
			content: `msg ${i}`,
		}));
		expect(windowMessages(messages, 5)).toBe(messages);
	});

	it('slices correctly with maxTurns=1', () => {
		const messages = [
			{ role: 'user' as const, content: 'old' },
			{ role: 'assistant' as const, content: 'old reply' },
			{ role: 'user' as const, content: 'new' },
			{ role: 'assistant' as const, content: 'new reply' },
		];
		const result = windowMessages(messages, 1);
		expect(result).toHaveLength(2);
		expect((result[0] as { content: string }).content).toBe('new');
	});
});
