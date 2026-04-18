/**
 * Tests for chat-orchestrator — pure helpers + integration error paths.
 *
 * All vi.mock() calls are hoisted before any imports. All module imports are
 * dynamic (after mocks) because chat-orchestrator.ts transitively imports
 * $lib/server/ai/providers which requires $env/dynamic/private.
 */

import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks (hoisted before dynamic imports) ──────────────────────────────────

vi.mock('$lib/server/db/ai/mutations', () => ({
	createConversation: vi.fn(() => ({ id: 'conv-new' })),
	saveMessages: vi.fn(),
	saveToolCall: vi.fn(),
	saveConversationStep: vi.fn(),
	updateMessageContent: vi.fn(),
	refreshConversationTokens: vi.fn(),
}));

vi.mock('$lib/server/db/ai/queries', () => ({
	getConversation: vi.fn(),
}));

vi.mock('$lib/server/db/ai/limits', () => ({
	checkConversationLimit: vi.fn(() => null),
}));

vi.mock('$lib/server/ai', () => ({
	getActiveProvider: vi.fn(),
	getActiveProviderInfo: vi.fn(),
	getFallbacksForUser: vi.fn(() => []),
	getToolProvider: vi.fn(),
}));

vi.mock('$lib/server/ai/providers', () => ({
	isCooledDown: vi.fn(() => false),
	markCooldown: vi.fn(),
}));

vi.mock('$lib/server/rawrag', () => ({
	retrieve: vi.fn(),
	formatContextForPrompt: vi.fn(),
}));

vi.mock('$lib/server/ai/tools', () => ({
	createDeskTools: vi.fn(() => ({})),
	stepsForScopes: vi.fn(() => 5),
	buildRetrievalTools: vi.fn(() => ({ tools: {}, drilledChunks: new Set<string>() })),
}));

vi.mock('$lib/server/llmwiki/overview', () => ({
	loadOverview: vi.fn(async () => null),
}));

vi.mock('$lib/server/llmwiki/search', () => ({
	searchLlmwiki: vi.fn(async () => []),
}));

vi.mock('$lib/server/llmwiki/verify', () => ({
	verifyCitations: vi.fn(async () => ({ verifications: new Map(), driftedChunkIds: [] })),
}));

vi.mock('$lib/server/llmwiki/wiki-format', () => ({
	formatLlmwikiContext: vi.fn(() => ''),
}));

vi.mock('$lib/server/llmwiki/config', () => ({
	MAX_RAWRAG_TOOL_CALLS_PER_TURN: 3,
}));

vi.mock('$lib/server/ai/errors', () => ({
	classifyAIError: vi.fn(() => ({ kind: 'unknown', message: 'Unknown error' })),
	aiErrorToStatus: vi.fn(() => 500),
	safeAIMessage: vi.fn((kind: string) => `Error: ${kind}`),
}));

vi.mock('ai', () => ({
	streamText: vi.fn(() => ({
		consumeStream: vi.fn(),
		toUIMessageStream: vi.fn(
			() =>
				new ReadableStream({
					start(c) {
						c.close();
					},
				}),
		),
	})),
	convertToModelMessages: vi.fn(async () => []),
	createUIMessageStream: vi.fn(
		({ execute }: { execute: (ctx: { writer: { merge: () => void; write: () => void } }) => Promise<void> }) => {
			execute({ writer: { merge: vi.fn(), write: vi.fn() } }).catch(() => {});
			return new ReadableStream({
				start(c) {
					c.close();
				},
			});
		},
	),
	createUIMessageStreamResponse: vi.fn(
		({ headers }: { headers?: Record<string, string> } = {}) => new Response(null, { status: 200, headers }),
	),
	stepCountIs: vi.fn(() => () => false),
}));

// ── Dynamic imports (resolved after vi.mock hoisting) ───────────────────────

const { createOnFinish, orchestrateChat } = await import('./chat-orchestrator');
const { getMessageText, windowMessages, escapeXmlAttr, buildSystemPrompt } = await import('./context/system-prompt');

const { SYSTEM_PROMPT, DESK_SYSTEM_PROMPT } = await import('./config');
const mutations = await import('$lib/server/db/ai/mutations');
const queries = await import('$lib/server/db/ai/queries');
const limits = await import('$lib/server/db/ai/limits');
const providers = await import('$lib/server/ai');

const saveMessages = mutations.saveMessages as ReturnType<typeof vi.fn>;
const createConversation = mutations.createConversation as ReturnType<typeof vi.fn>;
const getConversation = queries.getConversation as ReturnType<typeof vi.fn>;
const checkConversationLimit = limits.checkConversationLimit as ReturnType<typeof vi.fn>;
const getActiveProvider = providers.getActiveProvider as ReturnType<typeof vi.fn>;

// ── 1. getMessageText ───────────────────────────────────────────────────────

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

// ── 2. windowMessages ───────────────────────────────────────────────────────

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

// ── 3. escapeXmlAttr ────────────────────────────────────────────────────────

describe('escapeXmlAttr', () => {
	it('replaces & with &amp;', () => expect(escapeXmlAttr('a&b')).toBe('a&amp;b'));
	it('replaces < with &lt;', () => expect(escapeXmlAttr('a<b')).toBe('a&lt;b'));
	it('replaces > with &gt;', () => expect(escapeXmlAttr('a>b')).toBe('a&gt;b'));
	it('replaces " with &quot;', () => expect(escapeXmlAttr('a"b')).toBe('a&quot;b'));
	it("replaces ' with &apos;", () => expect(escapeXmlAttr("a'b")).toBe('a&apos;b'));
	it('escapes all special chars combined', () => expect(escapeXmlAttr(`a&<>"'b`)).toBe('a&amp;&lt;&gt;&quot;&apos;b'));
	it('passes through safe string unchanged', () => expect(escapeXmlAttr('hello world')).toBe('hello world'));
});

// ── 4. buildSystemPrompt ────────────────────────────────────────────────────

describe('buildSystemPrompt', () => {
	it('returns SYSTEM_PROMPT exactly when called with no arguments', () => {
		expect(buildSystemPrompt({})).toBe(SYSTEM_PROMPT);
	});

	it('starts with DESK_SYSTEM_PROMPT when toolScopes are provided', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:read'] });
		expect(result.startsWith(DESK_SYSTEM_PROMPT)).toBe(true);
	});

	it('includes <permissions> and <completion> when toolScopes are provided', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:read'] });
		expect(result).toContain('<permissions>');
		expect(result).toContain('</permissions>');
		expect(result).toContain('<completion>');
		expect(result).toContain('</completion>');
	});

	it('does not include <available-panels> prose — tool schemas replace it', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:read'] });
		expect(result).not.toContain('<available-panels>');
	});

	it('includes workspace name when activeWorkspace is provided', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:read'], activeWorkspace: { id: 'w1', name: 'My Project' } });
		expect(result).toContain('My Project');
	});

	it('includes <desk-context> block with panel attributes when panelContext is provided and tools are active', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			panelContext: [{ panelType: 'spreadsheet', label: 'Budget', content: 'A1: 100' }],
		});
		expect(result).toContain('<desk-context>');
		expect(result).toContain('<panel type="spreadsheet" label="Budget">');
		expect(result).toContain('A1: 100');
		expect(result).toContain('</desk-context>');
	});

	it('includes status and contentLevel as attributes on <panel> when provided', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			panelContext: [
				{
					panelType: 'spreadsheet',
					label: 'Budget',
					content: 'data',
					status: 'focused',
					contentLevel: 'full',
				},
			],
		});
		expect(result).toContain('status="focused"');
		expect(result).toContain('level="full"');
	});

	it('includes <desk-layout> block when deskLayout and toolScopes are both provided', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			deskLayout: [{ panelId: 'p1', fileId: 'fil_abc', fileType: 'spreadsheet', label: 'Budget 2025' }],
		});
		expect(result).toContain('<desk-layout>');
		expect(result).toContain('Budget 2025 (spreadsheet) [fil_abc]');
	});

	it('omits every desk block when toolScopes are absent (biggest token win)', () => {
		// `toBe(SYSTEM_PROMPT)` is the strongest possible assertion — any
		// extra block would make the string differ. We deliberately don't
		// substring-check the individual tag names because SYSTEM_PROMPT's
		// own prose guidelines mention `<desk-context>`.
		const result = buildSystemPrompt({ deskLayout: [{ panelId: 'p1', label: 'Budget' }] });
		expect(result).toBe(SYSTEM_PROMPT);
	});

	it('redacts sk-, ghp_, AKIA, Bearer tokens in panel content', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			panelContext: [{ panelType: 'note', label: 'S', content: 'key=sk-abcXYZ1234567890' }],
		});
		expect(result).not.toContain('sk-abcXYZ1234567890');
		expect(result).toContain('[REDACTED]');
	});

	it('truncates panel content to 8000 chars', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			panelContext: [{ panelType: 'note', label: 'Big', content: 'x'.repeat(9000) }],
		});
		const panelMatch = result.match(/<panel[^>]*>\n([\s\S]*?)\n<\/panel>/);
		expect(panelMatch).not.toBeNull();
		expect(panelMatch?.[1].length).toBe(8000);
	});

	it('omits <desk-context> for empty panelContext array', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:read'], panelContext: [] });
		expect(result).not.toContain('<desk-context>');
	});

	it('omits <desk-layout> for empty deskLayout array', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:read'], deskLayout: [] });
		expect(result).not.toContain('<desk-layout>');
	});

	it('escapes XML-special chars in panelType and label to prevent injection', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			panelContext: [{ panelType: '"></panel><injected>evil', label: 'n', content: 'safe' }],
		});
		expect(result).not.toContain('<injected>');
		expect(result).toContain('&quot;&gt;&lt;/panel&gt;&lt;injected&gt;evil');
	});

	it('escapes deskLayout labels and fileTypes', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			deskLayout: [{ panelId: 'p1', label: 'file<script>', fileType: 'type"break' }],
		});
		expect(result).not.toContain('<script>');
		expect(result).toContain('file&lt;script&gt;');
		expect(result).toContain('type&quot;break');
	});

	it('escapes XML in activeWorkspace name', () => {
		const result = buildSystemPrompt({
			toolScopes: ['desk:read'],
			activeWorkspace: { id: 'w1', name: '<evil>"ws"' },
		});
		expect(result).not.toContain('<evil>');
		expect(result).toContain('&lt;evil&gt;');
	});

	it('injects <planning> block when requirePlan is true', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:delete'], requirePlan: true });
		expect(result).toContain('<planning>');
		expect(result).toContain('desk_propose_plan');
	});

	it('omits <planning> block by default', () => {
		const result = buildSystemPrompt({ toolScopes: ['desk:delete'] });
		expect(result).not.toContain('<planning>');
	});
});

// ── 5. createOnFinish ───────────────────────────────────────────────────────

describe('createOnFinish', () => {
	beforeEach(() => {
		saveMessages.mockReset();
	});

	it('calls saveMessages when conversationId and text are present', async () => {
		saveMessages.mockResolvedValueOnce(undefined as never);
		const onFinish = createOnFinish('conv-1', 'user-1');
		await onFinish({ text: 'Hello world' });
		expect(saveMessages).toHaveBeenCalledOnce();
		expect(saveMessages).toHaveBeenCalledWith(
			'conv-1',
			'user-1',
			expect.arrayContaining([expect.objectContaining({ role: 'assistant', content: 'Hello world' })]),
		);
	});

	it('does not call saveMessages when conversationId is undefined', async () => {
		const onFinish = createOnFinish(undefined, 'user-1');
		await onFinish({ text: 'Hello' });
		expect(saveMessages).not.toHaveBeenCalled();
	});

	it('does not call saveMessages when text is empty', async () => {
		const onFinish = createOnFinish('conv-1', 'user-1');
		await onFinish({ text: '' });
		expect(saveMessages).not.toHaveBeenCalled();
	});

	it('swallows errors thrown by saveMessages', async () => {
		saveMessages.mockRejectedValueOnce(new Error('DB exploded'));
		const onFinish = createOnFinish('conv-1', 'user-1');
		await expect(onFinish({ text: 'Hello' })).resolves.toBeUndefined();
	});
});

// ── 6. orchestrateChat (integration — error paths) ──────────────────────────

describe('orchestrateChat', () => {
	const baseInput = {
		userId: 'user-1',
		messages: [{ role: 'user' as const, content: 'Hello' }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset();
		getConversation.mockReset();
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
	});

	it('returns 503 with ai_unavailable when no provider is configured', async () => {
		getActiveProvider.mockReturnValue(null);
		const response = await orchestrateChat(baseInput);
		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.error.code).toBe('ai_unavailable');
	});

	it('returns 404 when an existing conversationId is not found', async () => {
		getActiveProvider.mockReturnValue({ getInstance: () => ({}) } as never);
		getConversation.mockResolvedValue(null);
		const response = await orchestrateChat({ ...baseInput, conversationId: 'conv-missing' });
		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.error.code).toBe('not_found');
	});

	it('returns 403 when the conversation limit is exceeded', async () => {
		getActiveProvider.mockReturnValue({ getInstance: () => ({}) } as never);
		checkConversationLimit.mockResolvedValue('Limit reached' as never);
		const response = await orchestrateChat(baseInput);
		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body.error.code).toBe('limit_exceeded');
	});
});
