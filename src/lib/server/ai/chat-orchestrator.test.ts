/**
 * The orchestrator's own behaviour: the refusal paths it takes BEFORE streaming.
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
import type { TurnTrace, TurnTraceSnapshot } from '$lib/types/turn-trace';

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
	toolResults: [] as Array<{ toolCallId: string; toolName: string; input?: unknown; output?: unknown }>,
	/** Whether the mocked model's step runs the one `search_catalog` tool (the chatbot's shape). */
	toolFinish: true,
}));

vi.mock('$lib/server/db/ai/mutations', () => ({
	createConversation: vi.fn(() => ({ id: 'conv-new' })),
	saveMessages: vi.fn(),
	saveTurnTrace: vi.fn(),
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
	generateEmbedding: vi.fn(async () => []),
	retrieve: vi.fn(async () => ({ chunks: [], totalFound: 0 })),
	formatContextForPrompt: vi.fn(() => ''),
	contextChunkCut: (result: { chunks: unknown[] }) => result.chunks.length,
}));

// The profiles mount the real tool factories; their DB modules are mocked so the modules
// import without a connection — no tool's `execute` runs in these tests.
vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/db/desk/queries', () => ({
	listFiles: vi.fn(),
	getFile: vi.fn(),
	getSpreadsheetByFileId: vi.fn(),
	getMarkdownByFileId: vi.fn(),
}));
vi.mock('$lib/server/db/desk/mutations', () => ({
	updateSpreadsheetByFileId: vi.fn(),
	updateMarkdownByFileId: vi.fn(),
	renameFile: vi.fn(),
	createSpreadsheetFile: vi.fn(),
	createMarkdownFile: vi.fn(),
	deleteFile: vi.fn(),
}));

vi.mock('$lib/server/search', () => ({
	buildSearchIndex: vi.fn(() => []),
	formatCatalogMap: vi.fn(() => '<catalog-map></catalog-map>'),
	searchContent: vi.fn(async () => []),
}));

vi.mock('$lib/server/db/retrieval/queries', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/db/retrieval/queries')>()),
	getCorpusMap: vi.fn(async () => null),
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

vi.mock('ai', async (importOriginal) => ({
	// The real `tool()`/`jsonSchema()` for the factories the profiles mount; the streaming
	// surface below is the mock.
	...(await importOriginal<typeof import('ai')>()),
	// One text step with one tool execution: enough to drive every timing hook the chatbot
	// branch registers (step start, first chunk, tool finish, step finish) without a provider.
	streamText: vi.fn((opts: Record<string, (event: unknown) => unknown>) => {
		streamRun.signal = opts.abortSignal as unknown as AbortSignal | undefined;
		opts.experimental_onStepStart?.({ stepNumber: 0 });
		opts.onChunk?.({ chunk: { type: 'text-delta', id: 't1', text: streamRun.answer } });
		if (streamRun.toolFinish) {
			opts.experimental_onToolCallFinish?.({
				toolCall: { toolCallId: 'call_1', toolName: 'search_catalog', input: { query: 'auth' } },
				durationMs: 12.4,
				success: true,
				output: { results: [] },
			});
		}
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
	wrapLanguageModel: vi.fn(({ model }: { model: unknown }) => model),
}));

// Dynamic imports (resolved after vi.mock hoisting)

const { orchestrateChat } = await import('./chat-orchestrator');

const mutations = await import('$lib/server/db/ai/mutations');
const queries = await import('$lib/server/db/ai/queries');
const limits = await import('./conversation-quota');
const providers = await import('$lib/server/ai');
const providerRegistry = await import('$lib/server/ai/providers');
const { DbError } = await import('$lib/server/db/errors');

const saveMessages = mutations.saveMessages as ReturnType<typeof vi.fn>;
const saveTurnTrace = mutations.saveTurnTrace as ReturnType<typeof vi.fn>;

/** The trace snapshot on the last metadata frame written. */
const lastTrace = () =>
	(
		streamRun.writes.filter((f) => f.type === 'message-metadata').at(-1) as {
			messageMetadata: { trace: TurnTraceSnapshot };
		}
	).messageMetadata.trace;

/** The trace handed to `saveTurnTrace` on its last call. */
const persistedTrace = () => saveTurnTrace.mock.calls.at(-1)?.[0] as TurnTrace;
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

// 6. orchestrateChat (integration — error paths)

describe('orchestrateChat', () => {
	const baseInput = {
		userId: 'user-1',
		surface: 'deskbot' as const,
		registry,
		messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
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
		messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveTurnTrace.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockClear();
		streamRun.onWrite = undefined;
		streamRun.toolFinish = true;
	});

	/**
	 * The last metadata frame carries the turn's whole timing shape — what the client waited
	 * for before any frame, per-call first-token latency, tool execution cost, the post-text
	 * stages between the last token and `finish` — and the outcome. It precedes `finish`.
	 */
	it('stamps the trace with pre-stream, call and finalize timings, and closes it before finish', async () => {
		const response = await orchestrateChat(chatbotInput);
		expect(response.status).toBe(200);
		await streamRun.done;

		const frames = streamRun.writes;
		expect(frames[0]).toMatchObject({ type: 'start' });
		expect(frames.at(-1)).toEqual({ type: 'finish' });

		const trace = lastTrace();
		expect(trace.outcome).toBe('ok');
		expect(trace.timings.preStreamMs).toBeGreaterThanOrEqual(0);
		expect(trace.timings.generateMs).toBeGreaterThanOrEqual(0);
		expect(trace.timings.firstTokenMs).toEqual([expect.any(Number)]);
		expect(trace.timings.finalize).toEqual({
			catalogMs: expect.any(Number),
			persistMs: expect.any(Number),
			budgetMs: expect.any(Number),
		});
		// The catalog stage always runs: the answer's paths are checked even when nothing was surfaced.
		expect(trace.attempts).toEqual([
			{ attemptIndex: 0, providerId: 'google', modelId: 'gemini-2.5-flash', outcome: 'ok' },
		]);
		expect(trace.modelCalls).toEqual([
			expect.objectContaining({
				attemptIndex: 0,
				stepIndex: 0,
				providerId: 'google',
				inputTokens: 10,
				outputTokens: 5,
				outcome: 'ok',
			}),
		]);
		expect(trace.toolExecutions).toEqual([
			expect.objectContaining({ toolCallId: 'call_1', toolName: 'search_catalog', durationMs: 12, status: 'success' }),
		]);
		// Bodies never ride the wire: the snapshot withholds block text and tool I/O.
		expect(trace.bodies).toBe('persisted');
		expect(JSON.stringify(trace)).not.toContain('"text"');
		expect(JSON.stringify(trace)).not.toContain('"output"');
		// The last metadata frame is followed only by `finish`.
		expect(frames.indexOf(frames.filter((f) => f.type === 'message-metadata').at(-1) as Record<string, unknown>)).toBe(
			frames.length - 2,
		);
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
		messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveTurnTrace.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockClear();
		streamRun.onWrite = undefined;
		streamRun.toolFinish = true;
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

	it('writes the trace once, after the answer row, with the totals refreshed from it, all before finish', async () => {
		let traceLanded = false;
		saveTurnTrace.mockImplementation(
			() =>
				new Promise<void>((resolve) =>
					setTimeout(() => {
						traceLanded = true;
						resolve();
					}, 20),
				),
		);
		let answerRowAtTrace: boolean | undefined;
		saveTurnTrace.mockImplementation(async () => {
			answerRowAtTrace = updateMessageContent.mock.calls.length > 0;
			await new Promise<void>((resolve) => setTimeout(resolve, 20));
			traceLanded = true;
		});
		let traceLandedAtRefresh: boolean | undefined;
		refreshConversationTokens.mockImplementation(async () => {
			traceLandedAtRefresh = traceLanded;
		});
		let traceLandedAtFinish: boolean | undefined;
		streamRun.onWrite = (frame) => {
			if (frame.type === 'finish') traceLandedAtFinish = traceLanded;
		};

		await orchestrateChat(chatbotInput);
		// The step boundary never waits for a write: onStepFinish resolved with nothing in flight.
		await streamRun.stepFinish;
		expect(traceLanded).toBe(false);
		await streamRun.done;

		expect(saveTurnTrace).toHaveBeenCalledTimes(1);
		expect(saveTurnTrace).toHaveBeenCalledWith(expect.objectContaining({ conversationId: 'conv-new' }), 'user-1');
		expect(answerRowAtTrace).toBe(true);
		// …the totals were refreshed from rows that existed, and `finish` came after them.
		expect(traceLandedAtRefresh).toBe(true);
		expect(traceLandedAtFinish).toBe(true);
	});

	it('runs the durable writes of finalize together and still writes finish when one fails', async () => {
		updateMessageContent.mockRejectedValueOnce(new Error('write failed') as never);

		await orchestrateChat(chatbotInput);
		await streamRun.done;

		expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Hi', [
			expect.objectContaining({ type: 'tool-search_catalog', toolCallId: 'call_1', state: 'output-available' }),
			{ type: 'text', text: 'Hi' },
		]);
		expect(refreshConversationTokens).toHaveBeenCalledWith('conv-new');
		expect(chargeTokens).toHaveBeenCalledWith('user-1', 15);
		expect(streamRun.writes.at(-1)).toEqual({ type: 'finish' });
	});

	it('coalesces bursts of trace changes into one metadata frame, the last carrying everything', async () => {
		await orchestrateChat(chatbotInput);
		await streamRun.done;

		const metaFrames = streamRun.writes.filter((f) => f.type === 'message-metadata');
		// The assembly alone changes the recorder many times per await; each burst is one frame.
		expect(metaFrames.length).toBeLessThanOrEqual(4);
		// Replace semantics: the final frame carries the whole turn — every source, the attempt.
		const trace = lastTrace();
		expect(trace.grounding.map((g) => g.id).sort()).toEqual(['catalog', 'project-docs', 'project-map']);
		expect(trace.activations.find((a) => a.id === 'completion')).toEqual({ id: 'completion', active: true });
		expect(trace.attempts.at(-1)?.outcome).toBe('ok');
		// The last frame precedes `finish`.
		expect(streamRun.writes.indexOf(metaFrames.at(-1) as Record<string, unknown>)).toBe(streamRun.writes.length - 2);
	});

	it('mounts the chatbot profile’s tools from what the composition established', async () => {
		const ai = await import('ai');
		const streamText = ai.streamText as ReturnType<typeof vi.fn>;
		streamText.mockClear();

		await orchestrateChat(chatbotInput);
		await streamRun.done;

		const opts = streamText.mock.calls[0][0] as { tools: Record<string, unknown>; system: string };
		expect(Object.keys(opts.tools).sort()).toEqual(
			['resolve_ref', 'search_catalog', 'search_pattern_library', 'search_project_docs'].sort(),
		);
		expect(opts.system).toContain('You are Vely');
		expect(
			persistedTrace()
				.toolset.map((t) => t.name)
				.sort(),
		).toEqual(Object.keys(opts.tools).sort());
		expect(persistedTrace().blocks.map((b) => b.id)).toEqual([
			'role',
			'completion-guidance',
			'project-docs-guidance',
			'catalog-guidance',
			'pattern-library-guidance',
			'catalog-map',
		]);
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
		saveTurnTrace.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockClear();
		streamRun.onWrite = undefined;
		streamRun.toolFinish = true;
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
			messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
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
		streamRun.answer = 'The auth showcase is at /showcases/auth/authn.';
		streamRun.toolFinish = false;

		await orchestrateChat({
			userId: 'user-1',
			surface: 'chatbot',
			registry,
			authCeiling: 'user',
			messages: [
				{
					id: 'm1',
					role: 'user' as const,
					parts: [{ type: 'text' as const, text: 'Where is the auth showcase? Give me the link.' }],
				},
			],
		});
		await streamRun.done;

		const trace = lastTrace();
		expect(trace.awareness.authCeiling).toBe('user');
		expect(trace.activations).toContainEqual({ id: 'navigation', active: true });
		const catalog = trace.grounding.find((g) => g.id === 'catalog');
		expect(catalog).toMatchObject({ ran: true, ms: expect.any(Number) });
		// The row the assembly put in the prompt, and the answer named: included → cited.
		expect(catalog?.items).toEqual([
			expect.objectContaining({
				id: authn.id,
				state: 'cited',
				blockId: 'catalog-results',
				path: '/showcases/auth/authn',
			}),
		]);
		expect(trace.citations).toEqual([
			{ itemId: authn.id, source: 'catalog', match: 'path', path: '/showcases/auth/authn' },
		]);
		expect(trace.toolExecutions).toEqual([]);
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
		messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveTurnTrace.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		markCooldown.mockReset();
		streamRun.onWrite = undefined;
		streamRun.toolFinish = true;
		streamRun.writes = [];
		streamRun.answer = 'Hi';
		streamRun.failure = undefined;
		streamRun.failOnce = false;
		streamRun.hold = false;
	});

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
		const trace = lastTrace();
		expect(trace.outcome).toBe('ok');
		expect(trace.attempts).toEqual([
			expect.objectContaining({ attemptIndex: 0, providerId: 'google', outcome: 'rotated', errorKind: 'rate_limit' }),
			expect.objectContaining({ attemptIndex: 1, providerId: 'groq', modelId: 'openai/gpt-oss-120b', outcome: 'ok' }),
		]);
		await streamRun.stepFinish;
		expect(persistedTrace().modelCalls.at(-1)).toMatchObject({
			attemptIndex: 1,
			providerId: 'groq',
			modelId: 'openai/gpt-oss-120b',
		});
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

		const trace = lastTrace();
		expect(trace.outcome).toBe('error');
		expect(trace.errorKind).toBe('rate_limit');
		expect(trace.attempts.at(-1)).toMatchObject({ providerId: 'google', outcome: 'failed', errorKind: 'rate_limit' });
		// A failed turn is still a recorded turn.
		expect(persistedTrace()).toMatchObject({ outcome: 'error', errorKind: 'rate_limit' });

		expect(markCooldown).toHaveBeenCalledTimes(1);
		expect(markCooldown).toHaveBeenCalledWith('google');
	});

	it('does not cool the provider for a failure that is not a rate limit', async () => {
		streamRun.failure = new Error('No output generated. Check the stream for errors.');

		await orchestrateChat(input);
		await streamRun.done;

		expect(streamRun.writes.at(-1)).toEqual({ type: 'error', errorText: '[unknown] frame' });
		expect(lastTrace()).toMatchObject({ outcome: 'error', errorKind: 'unknown' });
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
		messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Hello' }] }],
	};

	beforeEach(() => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveTurnTrace.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockReset();
		markCooldown.mockReset();
		streamRun.onWrite = undefined;
		streamRun.toolFinish = true;
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

		expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Half an answer', expect.any(Array));
		expect(chargeTokens).toHaveBeenCalledWith('user-1', 0);
		expect(markCooldown).not.toHaveBeenCalled();
		expect(persistedTrace()).toMatchObject({ outcome: 'cancelled' });
		expect(persistedTrace().attempts.at(-1)).toMatchObject({ outcome: 'cancelled', contentParts: 1 });
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
		expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Half an answer', expect.any(Array));
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
		await vi.waitFor(() =>
			expect(updateMessageContent).toHaveBeenCalledWith(expect.any(String), 'Half an answer', expect.any(Array)),
		);

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
		messages: [{ id: 'm1', role: 'user' as const, parts: [{ type: 'text' as const, text: 'Set A1 to 1' }] }],
		toolScopes: ['desk:read', 'desk:write'] as never,
	};
	beforeEach(async () => {
		getActiveProvider.mockReset().mockReturnValue({ getInstance: () => ({}) } as never);
		getActiveProviderInfo.mockReset().mockReturnValue({ id: 'google', model: 'gemini-2.5-flash' } as never);
		getToolProvider.mockReset().mockReturnValue(toolProvider as never);
		checkConversationLimit.mockReset().mockResolvedValue(null as never);
		createConversation.mockReset().mockResolvedValue({ id: 'conv-new' } as never);
		saveMessages.mockReset().mockResolvedValue(undefined as never);
		saveTurnTrace.mockReset().mockResolvedValue(undefined as never);
		updateMessageContent.mockReset().mockResolvedValue(undefined as never);
		refreshConversationTokens.mockReset().mockResolvedValue(undefined as never);
		(chargeTokens as ReturnType<typeof vi.fn>).mockReset();
		markCooldown.mockReset();
		const proposals = await import('$lib/server/db/ai/proposals');
		(proposals.createProposal as ReturnType<typeof vi.fn>)
			.mockReset()
			.mockResolvedValue({ id: 'prp_1', riskTier: 'medium' } as never);
		streamRun.onWrite = undefined;
		streamRun.toolFinish = true;
		streamRun.writes = [];
		streamRun.answer = 'Done';
		streamRun.failure = undefined;
		streamRun.failOnce = false;
		streamRun.hold = false;
		streamRun.signal = undefined;
		streamRun.toolResults = [];
		// A desk turn runs the tools its step reports, never the chatbot's search.
		streamRun.toolFinish = false;
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
		expect(updateMessageContent).toHaveBeenCalledWith(start.messageId, 'Done', expect.any(Array));
		expect(chargeTokens).toHaveBeenCalledWith('user-1', 15);
		// The desk turn's trace carries the composed prompt blocks and every capability's verdict.
		const trace = persistedTrace();
		expect(trace.surface).toBe('deskbot');
		expect(trace.blocks.map((b) => b.id)).toEqual([
			'role',
			'completion-guidance',
			'desk-awareness-guidance',
			'desk-files-guidance',
			'desk-edit-guidance',
			'desk-plan-guidance',
			'permissions',
		]);
		expect(trace.activations).toContainEqual({ id: 'desk-plan', active: true });
		expect(trace.activations).toContainEqual({ id: 'desk-delete', active: false, reason: 'scope_off' });
		expect(trace.blocks.some((b) => b.id === 'planning')).toBe(false);
		expect(trace.toolset.map((t) => t.name)).toContain('desk_propose_plan');
		expect(trace.awareness.scopes).toEqual(['desk:read', 'desk:write']);
	});

	it('writes the proposal card inside the open message, from a gated sentinel, with server-derived risk', async () => {
		streamRun.toolResults = [
			{
				toolCallId: 'call_u1',
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
		// The proposal is a trace item: the turn stopped for a decision, on this proposal.
		expect(persistedTrace()).toMatchObject({ outcome: 'awaiting_decision', proposalId: 'prp_1' });
		expect(persistedTrace().toolExecutions).toEqual([
			expect.objectContaining({ toolCallId: 'call_u1', toolName: 'desk_update_cells', status: 'requires_approval' }),
		]);
	});

	it('shows no card when the proposal row could not be written, and marks the tool record', async () => {
		const proposals = await import('$lib/server/db/ai/proposals');
		(proposals.createProposal as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db down'));
		streamRun.toolResults = [
			{
				toolCallId: 'call_d1',
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
		expect(persistedTrace().toolExecutions).toEqual([
			expect.objectContaining({ status: 'error', errorMessage: expect.stringContaining('could not be persisted') }),
		]);
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
		await vi.waitFor(() => expect(saveTurnTrace).toHaveBeenCalled());
		expect(persistedTrace().modelCalls.at(-1)).toMatchObject({
			attemptIndex: 1,
			providerId: 'groq',
			modelId: 'openai/gpt-oss-120b',
		});
		expect(persistedTrace().toolExecutions).toEqual([]);
	});

	it('leaves a fallback out whose per-minute ceiling the turn exceeds — no fallback beats a predictable stop', async () => {
		streamRun.failure = { kind: 'rate_limit', message: 'quota' };
		streamRun.failOnce = true;
		// Groq's verified free tier carries 8K tokens a minute; a 20K-char history sent twice
		// (the tool step and the answer) is ~10K, so the rotation has nowhere honest to go.
		const { convertToModelMessages } = await import('ai');
		vi.mocked(convertToModelMessages).mockResolvedValueOnce([{ role: 'user', content: 'x'.repeat(20_000) }]);

		await orchestrateChat(input);
		await streamRun.done;

		const types = streamRun.writes.map((f) => f.type);
		expect(types).toContain('error');
		expect(markCooldown).toHaveBeenCalledWith('google');
		await vi.waitFor(() => expect(saveTurnTrace).toHaveBeenCalled());
		expect(persistedTrace().attempts.map((a) => a.providerId)).toEqual(['google']);
	});

	it('the step that asks for approval is the last one: the stop condition names it', async () => {
		const { stoppedAtApproval } = await import('./proposals/approval-boundary');
		expect(
			stoppedAtApproval({ steps: [{ toolResults: [{ output: { requiresApproval: true, action: 'x' } }] }] } as never),
		).toBe(true);
	});
});
