/**
 * The orchestrator's own behaviour: the refusal paths it takes BEFORE streaming, and
 * what `createOnFinish` persists.
 *
 * The forty pure cases that used to share this file moved to `context/system-prompt.test.ts`,
 * where they run with none of the mocks below. What is left genuinely needs them:
 * `chat-orchestrator.ts` transitively imports `$lib/server/ai/providers`, whose graph reaches
 * Neon, Redis and the AI SDK. All `vi.mock()` calls are hoisted before any import, and every
 * module import is dynamic so it resolves after that hoisting.
 *
 * The load-bearing case here is the DbError envelope: a database failure must surface as a DB
 * error, never be laundered into an AI error that trips a provider cooldown.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mocks (hoisted before dynamic imports)

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

vi.mock('./conversation-quota', () => ({
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

vi.mock('$lib/server/ai/provider-usage', () => ({
	incrProvider429: vi.fn(),
	incrEmbeddingCalls: vi.fn(),
}));

vi.mock('$lib/server/retrieval', () => ({
	retrieve: vi.fn(),
	formatContextForPrompt: vi.fn(),
}));

vi.mock('$lib/server/ai/tools', () => ({
	createDeskTools: vi.fn(() => ({})),
	stepsForScopes: vi.fn(() => 5),
	buildRetrievalTools: vi.fn(() => ({ tools: {}, drilledChunks: new Set<string>(), surfacedCatalog: new Map() })),
}));

vi.mock('$lib/server/search', () => ({
	buildSearchIndex: vi.fn(() => []),
	formatCatalogMap: vi.fn(() => '<catalog-map></catalog-map>'),
	searchContent: vi.fn(async () => []),
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
	MAX_SOURCE_CHUNK_TOOL_CALLS_PER_TURN: 3,
}));

vi.mock('$lib/server/ai/errors', () => ({
	classifyAiError: vi.fn(() => ({ kind: 'unknown', message: 'Unknown error' })),
	aiErrorToStatus: vi.fn(() => 500),
	safeAiMessage: vi.fn((kind: string) => `Error: ${kind}`),
	// `_shared/streaming-turn` (imported transitively) constructs this for the
	// "every provider cooled" path — the mock must expose it or the import throws.
	AiError: class AiError extends Error {
		constructor(
			public readonly kind: string,
			message: string,
			public readonly code?: string,
		) {
			super(message);
		}
	},
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

// Dynamic imports (resolved after vi.mock hoisting)

const { createOnFinish, orchestrateChat } = await import('./chat-orchestrator');

const mutations = await import('$lib/server/db/ai/mutations');
const queries = await import('$lib/server/db/ai/queries');
const limits = await import('./conversation-quota');
const providers = await import('$lib/server/ai');
const providerRegistry = await import('$lib/server/ai/providers');
const { DbError } = await import('$lib/server/db/errors');

const saveMessages = mutations.saveMessages as ReturnType<typeof vi.fn>;
const createConversation = mutations.createConversation as ReturnType<typeof vi.fn>;
const getConversation = queries.getConversation as ReturnType<typeof vi.fn>;
const checkConversationLimit = limits.checkConversationLimit as ReturnType<typeof vi.fn>;
const getActiveProvider = providers.getActiveProvider as ReturnType<typeof vi.fn>;
const markCooldown = providerRegistry.markCooldown as ReturnType<typeof vi.fn>;

// 5. createOnFinish

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

// 6. orchestrateChat (integration — error paths)

describe('orchestrateChat', () => {
	const baseInput = {
		userId: 'user-1',
		surface: 'deskbot' as const,
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

	// Error hygiene: a DB outage inside the orchestrator used to be laundered through
	// `classifyAiError` (whose substring rules read 'rate'/'token' out of Postgres messages),
	// cooling a healthy provider and burning a fallback turn on something no model can fix.
	it('surfaces a DbError as a DB envelope — no AI classification, no cooldown', async () => {
		getActiveProvider.mockReturnValue({ getInstance: () => ({}) } as never);
		markCooldown.mockReset();
		const dbErr = new DbError('connection', 'fetch failed: Neon endpoint is disabled', 'NETWORK');
		// 1st call = the user message (before the try); 2nd = the assistant row inside the try.
		saveMessages
			.mockReset()
			.mockResolvedValueOnce(undefined as never)
			.mockRejectedValueOnce(dbErr as never);

		const response = await orchestrateChat(baseInput);

		expect(response.status).toBe(dbErr.toStatus());
		expect(response.status).toBe(503);
		expect(response.headers.get('X-Error-Source')).toBe('db');
		// The AI error lane must not claim this failure.
		expect(response.headers.get('X-AI-Error-Kind')).toBeNull();

		const body = await response.json();
		expect(body.error.code).toBe('connection');
		// User-safe text only — never the raw driver message.
		expect(body.error.message).toBe('Database connection failed. Please try again later.');
		expect(body.error.message).not.toContain('Neon');

		expect(markCooldown).not.toHaveBeenCalled();
	});
});
