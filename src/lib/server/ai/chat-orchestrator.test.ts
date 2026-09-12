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

/** What the mocked UI-message stream saw: every frame written, and the `execute` promise to await. */
const streamRun = vi.hoisted(() => ({
	writes: [] as Array<Record<string, unknown>>,
	done: Promise.resolve() as Promise<void>,
	/** The promise the mocked `streamText` got back from `onStepFinish` (what the SDK would await). */
	stepFinish: undefined as Promise<unknown> | undefined,
	/** Observes every frame as it is written — for ordering assertions against other side effects. */
	onWrite: undefined as ((frame: Record<string, unknown>) => void) | undefined,
	/** The text the mocked model answers with. */
	answer: 'Hi',
	/** When set, the mocked model fails the way the SDK does: an `error` part carrying this
	 * error (through `onError`), then `text` rejects with the generic "No output generated". */
	failure: undefined as unknown,
	/** When set, `failure` is spent by the first model call: the next one (a rotated attempt) answers. */
	failOnce: false,
	/** When set, the mocked model streams its answer and then holds the connection open until the
	 * call's `abortSignal` fires — answering it the way the SDK does, with an `abort` part. */
	hold: false,
	/** Resolves once the held model has streamed its answer (the moment a client would hit Stop). */
	held: undefined as (() => void) | undefined,
	/** The `abortSignal` the last mocked model call was given. */
	signal: undefined as AbortSignal | undefined,
	/** The tool results the mocked model's one step reports to `onStepFinish`. */
	toolResults: [] as Array<{ toolName: string; input?: unknown; output?: unknown }>,
}));

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

vi.mock('$lib/server/db/ai/proposals', () => ({
	createProposal: vi.fn(async () => ({ id: 'prp_1', riskTier: 'medium' })),
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

vi.mock('$lib/server/ai/budget', () => ({
	chargeTokens: vi.fn(async () => undefined),
}));

vi.mock('$lib/server/retrieval', () => ({
	retrieve: vi.fn(),
	formatContextForPrompt: vi.fn(),
}));

vi.mock('$lib/server/ai/tools', () => ({
	createDeskTools: vi.fn(() => ({})),
	stepsForScopes: vi.fn(() => 5),
	// Mirrors the real factory's one observable contract for these tests: rows the assembly
	// pre-searched are surfaced before any tool runs.
	buildRetrievalTools: vi.fn(
		(_userId: string, _locale: string, _ceiling: string | null, options?: { catalogSeed?: Array<{ id: string }> }) => ({
			tools: {},
			drilledChunks: new Set<string>(),
			surfacedCatalog: new Map((options?.catalogSeed ?? []).map((row) => [row.id, row])),
		}),
	),
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
	// Classified by an explicit `kind` on the error object (the real classifier's status rules
	// are its own test); anything else is `unknown`, the catch-all.
	classifyAiError: vi.fn((err: unknown) => ({
		kind: (err as { kind?: string })?.kind ?? 'unknown',
		message: err instanceof Error ? err.message : 'Unknown error',
	})),
	aiErrorToStatus: vi.fn(() => 500),
	safeAiMessage: vi.fn((kind: string) => `Error: ${kind}`),
	aiErrorFrameText: vi.fn((err: unknown) => `[${(err as { kind?: string })?.kind ?? 'unknown'}] frame`),
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
	// One text step with one tool execution: enough to drive every timing hook the chatbot
	// branch registers (step start, first chunk, tool finish, step finish) without a provider.
	streamText: vi.fn((opts: Record<string, (event: unknown) => unknown>) => {
		streamRun.signal = opts.abortSignal as unknown as AbortSignal | undefined;
		opts.experimental_onStepStart?.({ stepNumber: 0 });
		opts.onChunk?.({ chunk: { type: 'text-delta', id: 't1', text: streamRun.answer } });
		opts.experimental_onToolCallFinish?.({ toolCall: { toolName: 'search_catalog' }, durationMs: 12.4, success: true });
		streamRun.stepFinish = opts.onStepFinish?.({
			toolCalls: [],
			toolResults: streamRun.toolResults,
			usage: { inputTokens: 10, outputTokens: 5 },
		}) as Promise<unknown> | undefined;
		const failure = streamRun.failure;
		if (streamRun.failOnce) {
			streamRun.failure = undefined;
			streamRun.failOnce = false;
		}
		const rejectedText = failure
			? Promise.reject(new Error('No output generated. Check the stream for errors.'))
			: null;
		rejectedText?.catch(() => {});
		return {
			consumeStream: vi.fn(),
			toUIMessageStream: vi.fn(
				({ onError }: { onError?: (e: unknown) => string } = {}) =>
					new ReadableStream({
						start(c) {
							if (failure) c.enqueue({ type: 'error', errorText: onError?.(failure) });
							else c.enqueue({ type: 'text-delta', id: 't1', delta: streamRun.answer });
							if (streamRun.hold) {
								streamRun.held?.();
								streamRun.signal?.addEventListener('abort', () => {
									// The SDK's shape: `onAbort` with the finished steps, never `onFinish`.
									void opts.onAbort?.({ steps: [] });
									c.enqueue({ type: 'abort' });
									c.close();
								});
								return;
							}
							c.close();
						},
					}),
			),
			text: rejectedText ?? Promise.resolve(streamRun.answer),
			totalUsage: Promise.resolve({
				inputTokens: 10,
				outputTokens: 5,
				outputTokenDetails: { textTokens: 2, reasoningTokens: 3 },
			}),
		};
	}),
	convertToModelMessages: vi.fn(async () => []),
	createUIMessageStream: vi.fn(
		({
			execute,
			onError,
		}: {
			execute: (ctx: {
				writer: { merge: () => void; write: (frame: Record<string, unknown>) => void };
			}) => Promise<void>;
			onError?: (error: unknown) => string;
		}) => {
			streamRun.writes = [];
			streamRun.done = execute({
				writer: {
					merge: vi.fn(),
					write: (frame) => {
						streamRun.writes.push(frame);
						streamRun.onWrite?.(frame);
					},
				},
				// The SDK's shape: a rejection of `execute` becomes one `error` frame with `onError`'s text.
			}).catch((error) => {
				streamRun.writes.push({ type: 'error', errorText: onError?.(error) ?? String(error) });
			});
			// Open until `execute` settles, as the SDK's stream is — so a cancel can still reach it.
			return new ReadableStream({
				start(c) {
					void streamRun.done.finally(() => {
						try {
							c.close();
						} catch {
							// already cancelled by the reader — the SDK swallows this too
						}
					});
				},
			});
		},
	),
	// The body is the orchestrator's wrapped stream: cancelling it is the Node bridge's disconnect door.
	createUIMessageStreamResponse: vi.fn(
		({ stream, headers }: { stream?: ReadableStream; headers?: Record<string, string> } = {}) =>
			new Response(stream ?? null, { status: 200, headers }),
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
const saveConversationStep = mutations.saveConversationStep as ReturnType<typeof vi.fn>;
const updateMessageContent = mutations.updateMessageContent as ReturnType<typeof vi.fn>;
const refreshConversationTokens = mutations.refreshConversationTokens as ReturnType<typeof vi.fn>;
const createConversation = mutations.createConversation as ReturnType<typeof vi.fn>;
const getConversation = queries.getConversation as ReturnType<typeof vi.fn>;
const checkConversationLimit = limits.checkConversationLimit as ReturnType<typeof vi.fn>;
const getActiveProvider = providers.getActiveProvider as ReturnType<typeof vi.fn>;
const getActiveProviderInfo = providers.getActiveProviderInfo as ReturnType<typeof vi.fn>;
const getToolProvider = providers.getToolProvider as ReturnType<typeof vi.fn>;
const markCooldown = providerRegistry.markCooldown as ReturnType<typeof vi.fn>;
const { chargeTokens } = await import('$lib/server/ai/budget');

/** The snapshot the guard would have loaded; the mocked facade ignores its contents. */
const registry = {
	entries: [],
	defaultProviderId: null,
	degraded: false,
	embeddingConnection: () => ({ apiKey: 'request-key' }),
};

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
		registry,
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
		// The one insert of the turn (user + assistant rows) fails before any stream exists.
		saveMessages.mockReset().mockRejectedValueOnce(dbErr as never);

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

// 7. chatbot turn — the timing shape on the generate terminal

describe('chatbot turn timing', () => {
	const toolProvider = {
		id: 'google',
		modelId: 'gemini-2.5-flash',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};

	const chatbotInput = {
		userId: 'user-1',
		surface: 'chatbot' as const,
		registry,
		messages: [{ role: 'user' as const, content: 'Hello' }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveConversationStep.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockClear();
		streamRun.onWrite = undefined;
	});

	/**
	 * The generate terminal is the one frame that carries the turn's timing shape — what the
	 * client waited for before any frame, per-step first-token latency, tool execution cost,
	 * and the post-text stages between the last token and `finish`. It is emitted once, last.
	 */
	it('stamps the generate terminal with pre-stream, step and finalize timings, once, before finish', async () => {
		const response = await orchestrateChat(chatbotInput);
		expect(response.status).toBe(200);
		await streamRun.done;

		const frames = streamRun.writes;
		expect(frames[0]).toMatchObject({ type: 'start' });
		expect(frames.at(-1)).toEqual({ type: 'finish' });

		const lastMeta = frames.filter((f) => f.type === 'message-metadata').at(-1) as {
			messageMetadata: { pipeline: Array<Record<string, unknown>> };
		};
		const generateDone = lastMeta.messageMetadata.pipeline.filter(
			(e) => e.type === 'pipeline:step' && e.step === 'generate' && e.status === 'done',
		);
		expect(generateDone).toHaveLength(1);
		expect(generateDone[0].detail).toMatchObject({
			kind: 'generate',
			model: 'google',
			inputTokens: 10,
			outputTokens: 5,
			// Gemini's thoughtsTokenCount — the thinking A/B's discriminator, on every trace.
			reasoningTokens: 3,
			steps: 1,
			firstTokenMs: [expect.any(Number)],
			tools: [{ name: 'search_catalog', ms: 12 }],
			finalize: { persistMs: expect.any(Number), budgetMs: expect.any(Number) },
		});
		const detail = generateDone[0].detail as { preStreamMs: number; finalize: Record<string, number> };
		expect(detail.preStreamMs).toBeGreaterThanOrEqual(0);
		// Nothing was drilled or surfaced, so those stages did not run — absent, not zero.
		expect(detail.finalize).not.toHaveProperty('verifyMs');
		expect(detail.finalize).not.toHaveProperty('catalogMs');
		// The terminal is the last pipeline event: nothing is emitted after it but `finish`.
		expect(lastMeta.messageMetadata.pipeline.at(-1)).toBe(generateDone[0]);
	});
});

// 8. chatbot turn — the round trips a turn pays and the frames it sends

describe('chatbot turn persistence and framing', () => {
	const toolProvider = {
		id: 'google',
		modelId: 'gemini-2.5-flash',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};
	const chatbotInput = {
		userId: 'user-1',
		surface: 'chatbot' as const,
		registry,
		messages: [{ role: 'user' as const, content: 'Hello' }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveConversationStep.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockClear();
		streamRun.onWrite = undefined;
		streamRun.writes = [];
		streamRun.answer = 'Hi';
	});

	it('persists the user message and the assistant row in one insert, before any frame', async () => {
		let framesAtInsert = -1;
		saveMessages.mockImplementation(async () => {
			framesAtInsert = streamRun.writes.length;
		});

		await orchestrateChat(chatbotInput);
		await streamRun.done;

		expect(saveMessages).toHaveBeenCalledTimes(1);
		const [, , rows] = saveMessages.mock.calls[0] as [string, string, Array<Record<string, unknown>>];
		expect(rows).toEqual([
			{ id: expect.any(String), role: 'user', content: 'Hello', route: null },
			{ id: expect.any(String), role: 'assistant', content: '' },
		]);
		expect(framesAtInsert).toBe(0);
		// The client message and the persisted row share the id.
		expect(streamRun.writes[0]).toEqual({ type: 'start', messageId: rows[1].id });
	});

	it('writes step rows off the step boundary, but every write lands before finish', async () => {
		let stepLanded = false;
		saveConversationStep.mockImplementation(
			() =>
				new Promise<void>((resolve) =>
					setTimeout(() => {
						stepLanded = true;
						resolve();
					}, 20),
				),
		);
		let stepLandedAtRefresh: boolean | undefined;
		refreshConversationTokens.mockImplementation(async () => {
			stepLandedAtRefresh = stepLanded;
		});
		let stepLandedAtFinish: boolean | undefined;
		streamRun.onWrite = (frame) => {
			if (frame.type === 'finish') stepLandedAtFinish = stepLanded;
		};

		await orchestrateChat(chatbotInput);
		// The step boundary did not wait for the insert: onStepFinish resolved while it was in flight.
		await streamRun.stepFinish;
		expect(stepLanded).toBe(false);
		await streamRun.done;

		expect(saveConversationStep).toHaveBeenCalledTimes(1);
		// …but the totals were refreshed from a row that existed, and `finish` came after it.
		expect(stepLandedAtRefresh).toBe(true);
		expect(stepLandedAtFinish).toBe(true);
	});

	it('runs the three durable writes of finalize together and still writes finish when one fails', async () => {
		updateMessageContent.mockRejectedValueOnce(new Error('write failed') as never);

		await orchestrateChat(chatbotInput);
		await streamRun.done;

		expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Hi');
		expect(refreshConversationTokens).toHaveBeenCalledWith('conv-new');
		expect(chargeTokens).toHaveBeenCalledWith('user-1', 15);
		expect(streamRun.writes.at(-1)).toEqual({ type: 'finish' });
	});

	it('coalesces bursts of pipeline events into one metadata frame, the last carrying everything', async () => {
		await orchestrateChat(chatbotInput);
		await streamRun.done;

		const metaFrames = streamRun.writes.filter((f) => f.type === 'message-metadata') as Array<{
			messageMetadata: { pipeline: Array<{ type: string; step?: string; status?: string }> };
		}>;
		const pipeline = metaFrames.at(-1)?.messageMetadata.pipeline ?? [];
		// Every emit used to be its own frame; the assembly alone emits several per await.
		expect(pipeline.length).toBeGreaterThan(metaFrames.length);
		expect(metaFrames.length).toBeLessThanOrEqual(4);
		// Replace semantics: the final frame carries the whole turn, first event included.
		expect(pipeline[0]).toMatchObject({ type: 'pipeline:step', step: 'llmwiki:overview', status: 'active' });
		expect(pipeline.at(-1)).toMatchObject({ step: 'generate', status: 'done' });
		// The last frame precedes `finish`.
		expect(streamRun.writes.indexOf(metaFrames.at(-1) as Record<string, unknown>)).toBe(streamRun.writes.length - 2);
	});

	it('builds the tool set after the assembly, from what it established, over the registry’s connection', async () => {
		const tools = await import('$lib/server/ai/tools');
		const buildRetrievalTools = tools.buildRetrievalTools as ReturnType<typeof vi.fn>;
		buildRetrievalTools.mockClear();

		await orchestrateChat(chatbotInput);
		await streamRun.done;

		// An empty wiki (the mocked context block is '') mounts no drill-down pair; nothing was
		// retrieved or pre-searched, so the tools inherit no seed.
		expect(buildRetrievalTools).toHaveBeenCalledWith('user-1', 'en', null, {
			llmwiki: false,
			embeddingConnection: { apiKey: 'request-key' },
			docsSeed: undefined,
			catalogSeed: [],
		});
	});
});

// 9. chatbot turn — fewer model and tool steps

describe('chatbot turn steps', () => {
	const toolProvider = {
		id: 'google',
		modelId: 'gemini-2.5-flash',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};
	const authn = {
		id: 'showcase:en:/showcases/auth/authn',
		surface: 'showcase',
		locale: 'en',
		localeFallback: false,
		title: 'AuthN',
		path: '/showcases/auth/authn',
		anchor: null,
		breadcrumb: ['Identity & Access'],
		authScope: 'public',
	};

	beforeEach(async () => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveConversationStep.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockClear();
		streamRun.onWrite = undefined;
		streamRun.writes = [];
		streamRun.answer = 'Hi';
		const search = await import('$lib/server/search');
		(search.buildSearchIndex as ReturnType<typeof vi.fn>).mockReset().mockReturnValue([]);
	});

	it('runs the model with the last-step rule and the chatbot generation options', async () => {
		const ai = await import('ai');
		const streamText = ai.streamText as ReturnType<typeof vi.fn>;
		streamText.mockClear();
		const { CHATBOT_GENERATION_OPTIONS, CHATBOT_MAX_STEPS } = await import('$lib/server/ai/config');

		await orchestrateChat({
			userId: 'user-1',
			surface: 'chatbot',
			registry,
			messages: [{ role: 'user', content: 'Hello' }],
		});
		await streamRun.done;

		const opts = streamText.mock.calls[0][0] as {
			prepareStep: (o: { stepNumber: number }) => unknown;
			providerOptions: unknown;
		};
		expect(opts.providerOptions).toBe(CHATBOT_GENERATION_OPTIONS);
		expect(opts.prepareStep({ stepNumber: 0 })).toBeUndefined();
		expect(opts.prepareStep({ stepNumber: CHATBOT_MAX_STEPS - 1 })).toEqual({ activeTools: [] });
	});

	// A navigation question is answered from `<catalog-results>`: the assembly searched the
	// catalog before generation, the rows were surfaced through the tool factory, and the
	// path the model then cited verifies as `exists` — with no tool call in the turn.
	it('grounds a navigation question before generation, so the cited path verifies without a tool call', async () => {
		const search = await import('$lib/server/search');
		(search.buildSearchIndex as ReturnType<typeof vi.fn>).mockReturnValue([authn]);
		const tools = await import('$lib/server/ai/tools');
		const buildRetrievalTools = tools.buildRetrievalTools as ReturnType<typeof vi.fn>;
		buildRetrievalTools.mockClear();
		streamRun.answer = 'The auth showcase is at /showcases/auth/authn.';

		await orchestrateChat({
			userId: 'user-1',
			surface: 'chatbot',
			registry,
			authCeiling: 'user',
			messages: [{ role: 'user', content: 'Where is the auth showcase? Give me the link.' }],
		});
		await streamRun.done;

		const [, , ceiling, options] = buildRetrievalTools.mock.calls[0] as [
			string,
			string,
			string | null,
			{ catalogSeed: Array<{ path: string }> },
		];
		expect(ceiling).toBe('user');
		expect(options.catalogSeed.map((r) => r.path)).toEqual(['/showcases/auth/authn']);

		const lastMeta = streamRun.writes.filter((f) => f.type === 'message-metadata').at(-1) as {
			messageMetadata: {
				pipeline: Array<{ type: string; step?: string; status?: string; detail?: { tools?: unknown[] } }>;
				catalogSources: Array<{ path: string }>;
				catalogCitations: { verdicts: Array<{ path: string; status: string }> };
			};
		};
		expect(lastMeta.messageMetadata.catalogCitations.verdicts).toEqual([
			{ path: '/showcases/auth/authn', status: 'exists' },
		]);
		expect(lastMeta.messageMetadata.catalogSources.map((r) => r.path)).toEqual(['/showcases/auth/authn']);
		const catalogStep = lastMeta.messageMetadata.pipeline.filter((e) => e.step === 'catalog');
		expect(catalogStep.map((e) => e.status)).toEqual(['active', 'done']);
	});
});

// 10. chatbot turn — the failure path

describe('chatbot turn failure', () => {
	const toolProvider = {
		id: 'google',
		modelId: 'gemini-2.5-flash',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};
	const input = {
		userId: 'user-1',
		surface: 'chatbot' as const,
		registry,
		messages: [{ role: 'user' as const, content: 'Hello' }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveConversationStep.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		markCooldown.mockReset();
		streamRun.onWrite = undefined;
		streamRun.writes = [];
		streamRun.answer = 'Hi';
		streamRun.failure = undefined;
		streamRun.failOnce = false;
		streamRun.hold = false;
	});

	const pipelineOf = () =>
		(
			streamRun.writes.filter((f) => f.type === 'message-metadata').at(-1) as {
				messageMetadata: { pipeline: Array<{ step?: string; status?: string; error?: string }> };
			}
		).messageMetadata.pipeline;

	/**
	 * A tool-routed turn starts on Google while the registry's first connection (Groq) is the
	 * chat provider. When Google 429s before any token, the turn rotates onto Groq — the chat
	 * provider is not exempt from being a fallback — cools Google once, and ends in a normal
	 * finish attributed to Groq. Before this, Google + Groq had no fallback at all.
	 */
	it('rotates a pre-text 429 onto the other configured connection, the chat provider included', async () => {
		const groq = {
			id: 'groq',
			modelId: 'openai/gpt-oss-120b',
			configured: true,
			capabilities: { tools: true },
			getInstance: () => ({}),
		};
		streamRun.failure = Object.assign(new Error('You exceeded your current quota.'), { kind: 'rate_limit' });
		streamRun.failOnce = true;

		const response = await orchestrateChat({
			...input,
			registry: { ...registry, entries: [groq, toolProvider] } as never,
		});
		expect(response.status).toBe(200);
		await streamRun.done;

		const types = streamRun.writes.map((f) => f.type);
		expect(types).not.toContain('error');
		expect(types.filter((t) => t === 'finish')).toHaveLength(1);
		expect(markCooldown).toHaveBeenCalledTimes(1);
		expect(markCooldown).toHaveBeenCalledWith('google');
		const generate = pipelineOf().filter((e) => e.step === 'generate');
		expect(generate.at(-1)).toMatchObject({ status: 'done' });
		await streamRun.stepFinish;
		expect(saveConversationStep).toHaveBeenCalledWith(
			expect.objectContaining({ providerId: 'groq', modelId: 'openai/gpt-oss-120b' }),
		);
	});

	/**
	 * A provider 429 before any token: the turn ends in ONE classified error frame (never the
	 * provider's prose, never a raw `error` part), the generate step closes as `error` with the
	 * kind, and the provider is cooled exactly once — from the attempt failure, not again from
	 * the stream's error handler.
	 */
	it('ends a pre-text 429 in one classified error frame, cools the provider once, closes generate as error', async () => {
		streamRun.failure = Object.assign(new Error('You exceeded your current quota. Retry in 33.5s.'), {
			kind: 'rate_limit',
		});

		const response = await orchestrateChat(input);
		expect(response.status).toBe(200);
		await streamRun.done;

		const types = streamRun.writes.map((f) => f.type);
		expect(types.filter((t) => t === 'error')).toHaveLength(1);
		expect(types).not.toContain('finish');
		expect(streamRun.writes.at(-1)).toEqual({ type: 'error', errorText: '[rate_limit] frame' });
		expect(JSON.stringify(streamRun.writes)).not.toContain('quota');

		const generate = pipelineOf().filter((e) => e.step === 'generate');
		expect(generate.at(-1)).toMatchObject({ status: 'error', error: 'rate_limit' });

		expect(markCooldown).toHaveBeenCalledTimes(1);
		expect(markCooldown).toHaveBeenCalledWith('google');
	});

	it('does not cool the provider for a failure that is not a rate limit', async () => {
		streamRun.failure = new Error('No output generated. Check the stream for errors.');

		await orchestrateChat(input);
		await streamRun.done;

		expect(streamRun.writes.at(-1)).toEqual({ type: 'error', errorText: '[unknown] frame' });
		expect(
			pipelineOf()
				.filter((e) => e.step === 'generate')
				.at(-1),
		).toMatchObject({ status: 'error', error: 'unknown' });
		expect(markCooldown).not.toHaveBeenCalled();
	});
});

describe('chatbot turn cancellation', () => {
	const toolProvider = {
		id: 'google',
		modelId: 'gemini-2.5-flash',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};
	const input = {
		userId: 'user-1',
		surface: 'chatbot' as const,
		registry,
		messages: [{ role: 'user' as const, content: 'Hello' }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveConversationStep.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockReset();
		markCooldown.mockReset();
		streamRun.onWrite = undefined;
		streamRun.writes = [];
		streamRun.answer = 'Half an answer';
		streamRun.failure = undefined;
		streamRun.hold = true;
		streamRun.signal = undefined;
	});

	/**
	 * Stop mid-answer, through the door the Node bridge uses (cancelling the response body): the
	 * model call's signal fires, the partial text the client received is persisted and charged as
	 * nothing, the message closes without an error frame, and nothing is cooled.
	 */
	it('cancelling the response body aborts the model call and persists what streamed', async () => {
		const streamed = new Promise<void>((resolve) => {
			streamRun.held = resolve;
		});

		const response = await orchestrateChat(input);
		await streamed;
		expect(streamRun.signal?.aborted).toBe(false);

		await response.body?.cancel();
		await streamRun.done;

		expect(streamRun.signal?.aborted).toBe(true);
		const types = streamRun.writes.map((f) => f.type);
		expect(types).not.toContain('error');
		expect(types.at(-1)).toBe('finish');
		expect(JSON.stringify(streamRun.writes)).not.toContain('turnError');

		expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Half an answer');
		expect(chargeTokens).toHaveBeenCalledWith('user-1', 0);
		expect(markCooldown).not.toHaveBeenCalled();
	});

	it("the platform's request signal is the other door to the same cancellation", async () => {
		const request = new AbortController();
		const streamed = new Promise<void>((resolve) => {
			streamRun.held = resolve;
		});

		await orchestrateChat({ ...input, signal: request.signal });
		await streamed;

		request.abort();
		await streamRun.done;

		expect(streamRun.signal?.aborted).toBe(true);
		expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Half an answer');
		expect(streamRun.writes.at(-1)).toEqual({ type: 'finish' });
	});

	/**
	 * The desk branch streams through the same helper as the chatbot: the cut step's text is
	 * what the helper pumped, persisted through `afterText` and charged as nothing.
	 */
	it('a cut desk turn stores the text the client received, like a finished one would', async () => {
		const request = new AbortController();
		const streamed = new Promise<void>((resolve) => {
			streamRun.held = resolve;
		});

		const response = await orchestrateChat({ ...input, surface: 'deskbot', signal: request.signal });
		expect(response.status).toBe(200);
		await streamed;
		expect(updateMessageContent).not.toHaveBeenCalled();

		request.abort();
		await streamRun.done;
		await vi.waitFor(() => expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Half an answer'));

		expect(streamRun.signal?.aborted).toBe(true);
		expect(markCooldown).not.toHaveBeenCalled();
		expect(refreshConversationTokens).toHaveBeenCalled();
	});
});

/**
 * The desk turn on the shared streaming helper: one open message with the persisted row's id,
 * the proposal card written INSIDE it, the loop stopping at the approval boundary, the budget
 * charged, and a pre-content provider failure rotating onto the other connection.
 */
describe('desk turn streaming', () => {
	const toolProvider = {
		id: 'google',
		modelId: 'gemini-2.5-flash',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};
	const groq = {
		id: 'groq',
		modelId: 'openai/gpt-oss-120b',
		configured: true,
		capabilities: { tools: true },
		getInstance: () => ({}),
	};
	const target = {
		fileId: 'fil_a',
		fileType: 'spreadsheet' as const,
		name: 'Budget',
		version: 3,
		updatedAt: '2026-09-12T08:00:00.000Z',
	};
	const input = {
		userId: 'user-1',
		surface: 'deskbot' as const,
		registry: { ...registry, entries: [toolProvider, groq] } as never,
		messages: [{ role: 'user' as const, content: 'Set A1 to 1' }],
		toolScopes: ['desk:read', 'desk:write'] as never,
	};
	beforeEach(async () => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveConversationStep.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(mutations.saveToolCall as ReturnType<typeof vi.fn>).mockReset().mockResolvedValue({ id: 'tcl_1' } as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockReset();
		markCooldown.mockReset();
		const proposals = await import('$lib/server/db/ai/proposals');
		(proposals.createProposal as ReturnType<typeof vi.fn>)
			.mockReset()
			.mockResolvedValue({ id: 'prp_1', riskTier: 'medium' } as never);
		streamRun.onWrite = undefined;
		streamRun.writes = [];
		streamRun.answer = 'Done';
		streamRun.failure = undefined;
		streamRun.failOnce = false;
		streamRun.hold = false;
		streamRun.signal = undefined;
		streamRun.toolResults = [];
	});

	it('opens one message with the DB row id, closes it with one finish, and charges the budget', async () => {
		await orchestrateChat(input);
		await streamRun.done;

		const types = streamRun.writes.map((f) => f.type);
		expect(types[0]).toBe('start');
		expect(types.filter((t) => t === 'finish')).toHaveLength(1);
		expect(types).not.toContain('error');
		const start = streamRun.writes[0] as { messageId?: string };
		const [, , rows] = saveMessages.mock.calls[0] as [string, string, Array<{ id: string; role: string }>];
		expect(rows.find((r) => r.role === 'assistant')?.id).toBe(start.messageId);
		expect(updateMessageContent).toHaveBeenCalledWith(start.messageId, 'Done');
		expect(chargeTokens).toHaveBeenCalledWith('user-1', 15);
	});

	it('writes the proposal card inside the open message, from a gated sentinel, with server-derived risk', async () => {
		streamRun.toolResults = [
			{
				toolName: 'desk_update_cells',
				input: { file_id: 'fil_a', updates: [{ cell: 'A1', value: 1 }] },
				output: { requiresApproval: true, action: 'Update 1 cell in "Budget"', target },
			},
		];
		await orchestrateChat(input);
		await streamRun.done;

		const types = streamRun.writes.map((f) => f.type);
		const metadataAt = types.indexOf('message-metadata');
		expect(metadataAt).toBeGreaterThan(0);
		expect(metadataAt).toBeLessThan(types.lastIndexOf('finish'));
		const frame = streamRun.writes[metadataAt] as {
			messageMetadata: { harness: { proposal: Record<string, unknown> } };
		};
		expect(frame.messageMetadata.harness.proposal).toMatchObject({
			id: 'prp_1',
			status: 'pending',
			estimatedWrites: 1,
			steps: [
				{ tool: 'desk_update_cells', risk: 'write', recovery: 'revision', target: { fileId: 'fil_a', version: 3 } },
			],
		});
		const proposals = await import('$lib/server/db/ai/proposals');
		expect(proposals.createProposal).toHaveBeenCalledWith(
			expect.objectContaining({
				grantedScopes: ['desk:read', 'desk:write'],
				riskTier: 'medium',
				payload: [
					expect.objectContaining({ toolName: 'desk_update_cells', target, action: 'Update 1 cell in "Budget"' }),
				],
			}),
		);
	});

	it('shows no card when the proposal row could not be written, and marks the tool record', async () => {
		const proposals = await import('$lib/server/db/ai/proposals');
		(proposals.createProposal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db down'));
		streamRun.toolResults = [
			{
				toolName: 'desk_delete_file',
				input: { file_id: 'fil_a' },
				output: { requiresApproval: true, action: 'Delete "Budget"', target },
			},
		];
		await orchestrateChat(input);
		await streamRun.done;

		const frame = streamRun.writes.find((f) => f.type === 'message-metadata') as
			| { messageMetadata: { harness: { proposal?: unknown; proposalError?: { message: string } } } }
			| undefined;
		expect(frame?.messageMetadata.harness.proposal).toBeUndefined();
		expect(frame?.messageMetadata.harness.proposalError?.message).toContain('could not be saved');
		expect(mutations.saveToolCall).toHaveBeenCalledWith(
			expect.objectContaining({ status: 'error', errorMessage: expect.stringContaining('could not be persisted') }),
		);
	});

	it('rotates a pre-content 429 onto the other configured connection and finishes there', async () => {
		streamRun.failure = { kind: 'rate_limit', message: 'quota' };
		streamRun.failOnce = true;

		await orchestrateChat(input);
		await streamRun.done;

		const types = streamRun.writes.map((f) => f.type);
		expect(types).not.toContain('error');
		expect(types.filter((t) => t === 'finish')).toHaveLength(1);
		expect(markCooldown).toHaveBeenCalledTimes(1);
		expect(markCooldown).toHaveBeenCalledWith('google');
		await vi.waitFor(() => expect(saveConversationStep).toHaveBeenCalled());
		expect(saveConversationStep).toHaveBeenLastCalledWith(
			expect.objectContaining({ providerId: 'groq', modelId: 'openai/gpt-oss-120b', toolCallIds: undefined }),
		);
	});

	it('the step that asks for approval is the last one: the stop condition names it', async () => {
		const { stoppedAtApproval } = await import('./proposals/approval-boundary');
		expect(
			stoppedAtApproval({ steps: [{ toolResults: [{ output: { requiresApproval: true, action: 'x' } }] }] } as never),
		).toBe(true);
	});
});
