/**
 * The chatbot profile composed against a turn: what its grounding lanes spend and record.
 *
 * EMBED BUDGET — `embed_calls_per_turn`, measured rather than asserted in a comment. The
 * budget in `perf/budgets.json` warns at 1 and fails at 2, because Gemini's free embedding
 * tier is ~1000 calls a day and a chatbot turn that embeds twice halves the number of
 * conversations the site can hold. The sharing that keeps it at one is the composer's
 * memoized `queryEmbedding()`; losing it is not an error but a quietly doubled bill.
 *
 * The count is proved in two halves, because no single seam sees both. Here: the turn
 * embeds ONCE and hands that vector to the docs lane (and, as the seed, to the search
 * tool). In `retrieval/index.test.ts`: a consumer handed a vector does not embed again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { budgets, scoreBudget } from '$lib/server/perf';

const generateEmbedding = vi.fn();
const retrieve = vi.fn();
const getCorpusMap = vi.fn();
const formatContextForPrompt = vi.fn().mockReturnValue('');
const searchCatalogRecords = vi.fn();

vi.mock('$lib/server/db', () => ({ db: {} }));
vi.mock('$lib/server/retrieval', () => ({
	generateEmbedding,
	retrieve,
	formatContextForPrompt,
	contextChunkCut: (result: { chunks: unknown[] }) => result.chunks.length,
}));
vi.mock('$lib/server/db/retrieval/queries', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/db/retrieval/queries')>()),
	getCorpusMap,
}));
vi.mock('$lib/server/search', () => ({
	formatCatalogMap: vi.fn(() => '<catalog-map></catalog-map>'),
	buildSearchIndex: vi.fn(() => []),
	searchContent: vi.fn(async () => []),
}));
vi.mock('../tools/search-catalog', async (importOriginal) => ({
	...(await importOriginal<typeof import('../tools/search-catalog')>()),
	searchCatalogRecords,
}));
vi.mock('$lib/server/db/ai/mutations', () => ({ saveTurnTrace: vi.fn() }));

const { CHATBOT_PROFILE } = await import('./chatbot');
const { composeTurn } = await import('./profile');
const { catalogQueryOf, wantsNavigation } = await import('../capabilities/navigation');
const { createTurnRecorder } = await import('../trace/recorder');

const VECTOR = new Array(1536).fill(0.1);

/** Long enough to pass the triviality gate — a turn with a real question in it. */
const REAL_QUESTION = 'How does the retrieval pipeline decide which chunks enter the prompt?';

type Turn = Parameters<typeof composeTurn>[1];

/** A recorder for one composition — what the orchestrator hands in on a real turn. */
const recorderFor = () =>
	createTurnRecorder({
		conversationId: 'conv-1',
		messageId: 'msg-1',
		surface: 'chatbot',
		requestId: 'req-1',
		userId: 'user-1',
		t0: performance.now(),
	});

function turn(
	userMsgText: string,
	pageContext: Turn['pageContext'] = null,
	extra: Partial<Turn> = {},
	recorder = recorderFor(),
) {
	return composeTurn(
		CHATBOT_PROFILE,
		{
			userId: 'user-1',
			userMsgText,
			locale: 'en',
			authCeiling: null,
			hasTools: true,
			toolsCooled: false,
			pageContext,
			scopes: [],
			...extra,
		},
		recorder,
	).then((composition) => ({ composition, trace: recorder.trace() }));
}

const page = {
	path: '/showcases/velocity/runtime',
	title: 'Velocity runtime',
	breadcrumb: ['Showcases', 'Velocity'],
	surface: 'showcase',
} as unknown as NonNullable<Turn['pageContext']>;

describe('embed calls per turn', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(VECTOR);
		getCorpusMap.mockResolvedValue(null);
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0, tierUsed: [1] });
	});

	it('embeds the user message once and hands the vector to the docs lane', async () => {
		await turn(REAL_QUESTION);

		expect(generateEmbedding).toHaveBeenCalledTimes(1);
		// Identity, not equality: two structurally identical vectors would mean two
		// provider calls, which is exactly the regression this exists to catch.
		expect(retrieve.mock.calls[0][1].queryEmbedding).toBe(VECTOR);
	});

	it('scores that count against the declared budget', () => {
		// The budget is consulted, not restated. A change to budgets.json that made one
		// embed per turn a failure should fail here rather than be quietly ignored.
		expect(scoreBudget('embed_calls_per_turn', 1)).toBe('pass');
		expect(budgets.embed_calls_per_turn.kind).toBe('lab');
	});

	it('embeds nothing at all on a trivial turn', async () => {
		await turn('hi');

		expect(generateEmbedding).not.toHaveBeenCalled();
		expect(retrieve).not.toHaveBeenCalled();
	});

	it('embeds the page-seeded query instead of the bare message on the page-grounding path', async () => {
		// When the message points at the current page, the docs query is page-seeded and is
		// therefore a DIFFERENT question, which cannot reuse a vector computed for the bare
		// message: the lane is handed no vector and `retrieve()` embeds its own query
		// downstream — still one call for the turn, none of them here.
		await turn('How does this page work?', page);

		expect(generateEmbedding).not.toHaveBeenCalled();
		expect(retrieve.mock.calls[0][1].queryEmbedding).toBeUndefined();
		expect(retrieve.mock.calls[0][0]).toBe('Velocity runtime. Showcases Velocity. How does this page work?');
	});

	it('hands the request connection to every embed of the turn, so no provider row is re-read', async () => {
		// The guard's registry already opened the Google key. Both places this turn can embed —
		// the shared query vector on a bare question, the page-seeded retrieve's own embed on
		// a page question — receive that connection; neither falls back to a second row read.
		const connection = { apiKey: 'request-key' } as never;
		await turn(REAL_QUESTION, null, { embeddingConnection: connection });
		expect(generateEmbedding.mock.calls[0][1]).toEqual({ connection });

		await turn('How does this page work?', page, { embeddingConnection: connection });
		expect(retrieve.mock.calls[1][1].embeddingConnection).toBe(connection);
	});
});

/**
 * LANE TIMINGS — each lane reports its own settle time, not the barrier's. Measured after
 * the barrier, a 10 s cold turn read as "every lane took 10 s" and the cost could not be
 * attributed — which is the difference between fixing one lane and rewriting four.
 */
describe('lane timings', () => {
	const resolveAfter = <T>(ms: number, value: T) => new Promise<T>((r) => setTimeout(() => r(value), ms));

	beforeEach(() => {
		vi.clearAllMocks();
		getCorpusMap.mockResolvedValue(null);
	});

	it('does not charge a slow docs lane to the fast map lane', async () => {
		generateEmbedding.mockResolvedValue(VECTOR);
		retrieve.mockImplementation(() => resolveAfter(200, { chunks: [], totalFound: 0, tierUsed: [1] }));

		const { composition, trace } = await turn(REAL_QUESTION);

		const ms = (id: string) => trace.grounding.find((g) => g.id === id)?.ms ?? -1;
		expect(ms('project-docs')).toBeGreaterThanOrEqual(190);
		expect(ms('project-map')).toBeLessThan(100);
		expect(composition.embedMs).toBeLessThan(100);
	});

	it('records the embed wait on a grounded turn, with no query text anywhere in the trace', async () => {
		generateEmbedding.mockImplementation(() => resolveAfter(60, VECTOR));
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0, tierUsed: [1] });

		const { trace } = await turn(REAL_QUESTION);

		expect(trace.timings.embedMs).toBeGreaterThanOrEqual(50);
		expect(trace.activations).toContainEqual({ id: 'project-docs', active: true });
		expect(JSON.stringify({ ...trace, blocks: [] })).not.toContain(REAL_QUESTION);
	});

	it('records no embed and the retrieval sources skipped as trivial on a greeting', async () => {
		const { trace } = await turn('hi');
		expect(trace.timings.embedMs).toBeUndefined();
		// The tool still mounts, so the capability is in play; its lane says why it did not run.
		expect(trace.activations).toContainEqual({ id: 'project-docs', active: true });
		expect(trace.grounding.find((g) => g.id === 'project-docs')).toMatchObject({
			ran: false,
			skippedReason: 'trivial',
		});
	});

	it('records the embed failure on the docs lane when the provider call rejects', async () => {
		generateEmbedding.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));

		const { composition, trace } = await turn(REAL_QUESTION);

		// The lane degrades — the turn proceeds without its context, the failure on record.
		expect(trace.grounding.find((g) => g.id === 'project-docs')?.error).toContain('429');
		expect(composition.systemPrompt).toContain('<catalog-map>');
	});
});

/**
 * NAVIGATION GROUNDING — a "where is…" question gets its verified catalog rows before the
 * model runs, in the prompt, instead of one model step spent asking `search_catalog`.
 */
describe('navigation grounding', () => {
	const authn = {
		id: 'showcase:en:/showcases/auth/authn',
		surface: 'showcase' as const,
		title: 'AuthN',
		path: '/showcases/auth/authn',
		anchor: null,
		breadcrumb: ['Identity & Access'],
		snippet: null,
		highlight: [],
		locale: 'en' as const,
		badge: null,
		score: 6,
	};

	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(VECTOR);
		getCorpusMap.mockResolvedValue(null);
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0, tierUsed: [1] });
		searchCatalogRecords.mockResolvedValue([authn]);
	});

	it('recognises a navigation question in three languages and not a how-question', () => {
		expect(wantsNavigation('Where is the auth showcase? Give me the link.')).toBe(true);
		expect(wantsNavigation('Wo ist die Auth-Showcase?')).toBe(true);
		expect(wantsNavigation('Дай ссылку на showcase про auth')).toBe(true);
		expect(wantsNavigation('How does the auth showcase work?')).toBe(false);
		expect(wantsNavigation('What is Velociraptor?')).toBe(false);
	});

	it('distils the subject and the named surface, and gives up when only the asking is left', () => {
		expect(catalogQueryOf('Where is the auth showcase? Give me the link.')).toEqual({
			query: 'auth',
			surface: 'showcase',
		});
		expect(catalogQueryOf('Wo finde ich die Doku zu rate limiting?')).toEqual({
			query: 'rate limiting',
			surface: 'doc',
		});
		expect(catalogQueryOf('Где страница чатбота?')).toEqual({ query: 'чатбота', surface: null });
		expect(catalogQueryOf('Where is the page?')).toBeNull();
	});

	it('searches the catalog with the distilled query, in the caller’s visibility ceiling, and puts the rows in the prompt', async () => {
		const { composition, trace } = await turn('Where is the auth showcase? Give me the link.', null, {
			authCeiling: 'admin',
		});

		expect(searchCatalogRecords).toHaveBeenCalledWith('auth', {
			locale: 'en',
			authCeiling: 'admin',
			surface: 'showcase',
			limit: 5,
		});
		expect(trace.activations).toContainEqual({ id: 'navigation', active: true });
		// The path verbatim, the block dynamic, the rule in the stable prefix — and the map before it.
		expect(composition.systemPrompt).toContain('- [showcase] AuthN — /showcases/auth/authn (Identity & Access)');
		expect(composition.systemPrompt).toContain('cite their paths exactly as written');
		const results = composition.blocks.find((b) => b.id === 'catalog-results');
		expect(results).toMatchObject({ stable: false, section: 'grounding', capability: 'navigation' });
		expect(results?.text).toContain('/showcases/auth/authn');
		const ids = composition.blocks.map((b) => b.id);
		expect(ids.indexOf('navigation-guidance')).toBeLessThan(ids.indexOf('catalog-map'));
		expect(ids.indexOf('catalog-map')).toBeLessThan(ids.indexOf('catalog-results'));
		// The rows are surfaced before the model runs — citable, verifiable, like tool output.
		expect(composition.state.surfacedCatalog.get(authn.id)).toEqual({ row: authn, source: 'catalog' });
	});

	it('spends nothing on the catalog for a question that names its own topic', async () => {
		const { composition, trace } = await turn(REAL_QUESTION);

		expect(searchCatalogRecords).not.toHaveBeenCalled();
		expect(trace.activations).toContainEqual({ id: 'navigation', active: false, reason: 'no_intent' });
		expect(composition.blocks.some((b) => b.id === 'catalog-results')).toBe(false);
		expect(composition.blocks.some((b) => b.id === 'navigation-guidance')).toBe(false);
	});

	it('proceeds without the block when the catalog lane fails, and says so', async () => {
		searchCatalogRecords.mockRejectedValue(new Error('neon down'));

		const { composition, trace } = await turn('Where is the auth showcase?');

		expect(trace.grounding.find((g) => g.id === 'catalog')?.error).toContain('neon down');
		expect(composition.blocks.some((b) => b.id === 'catalog-results')).toBe(false);
		expect(composition.systemPrompt).toContain('Project catalog rules');
	});

	it('records the catalog source with its rows as included items carrying the path', async () => {
		const { trace } = await turn('Where is the auth showcase?');
		const catalog = trace.grounding.find((g) => g.id === 'catalog');
		expect(catalog).toMatchObject({ ran: true, cutoff: 5, ms: expect.any(Number) });
		expect(catalog?.items).toEqual([
			expect.objectContaining({
				id: authn.id,
				kind: 'catalog',
				state: 'included',
				blockId: 'catalog-results',
				path: '/showcases/auth/authn',
			}),
		]);
	});

	it('verifies the answer: a surfaced path is cited, an unsurfaced one is recorded as the answer’s claim', async () => {
		const { composition } = await turn('Where is the auth showcase?');
		const verified = await composition.verify('See /showcases/auth/authn and /docs/nowhere.');
		expect(verified.citations).toEqual([
			{ itemId: authn.id, source: 'catalog', match: 'path', path: '/showcases/auth/authn' },
			{ itemId: '/docs/nowhere', source: 'catalog', match: 'unsurfaced', path: '/docs/nowhere', known: false },
		]);
		expect(verified.stages.catalog).toBeGreaterThanOrEqual(0);
	});
});

/**
 * WHAT THE TRACE SAYS ABOUT THE DOCS POOL — every candidate is recorded, and the ones the
 * prompt did not take say why: ranked past the cutoff, or cut by the size cap.
 */
describe('docs candidates in the trace', () => {
	const chunk = (n: number) => ({
		chunkId: `c${n}`,
		documentId: `d${n}`,
		documentTitle: `Doc ${n}`,
		content: `body ${n}`,
		score: 1 - n / 10,
		source: 'vector' as const,
		tier: 1 as const,
	});

	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(VECTOR);
		getCorpusMap.mockResolvedValue(null);
		formatContextForPrompt.mockReturnValue('[Doc] body');
	});

	it('marks the top of the pool included with its block, the rest considered below the cutoff', async () => {
		retrieve.mockResolvedValue({ chunks: [0, 1, 2, 3, 4, 5].map(chunk), totalFound: 6, tierUsed: [1] });

		const { trace } = await turn(REAL_QUESTION);

		const docs = trace.grounding.find((g) => g.id === 'project-docs');
		expect(docs).toMatchObject({ ran: true, pool: 12, cutoff: 4, retrievers: ['tier-1'] });
		expect(docs?.items.map((i) => [i.id, i.state, i.blockId ?? i.omittedReason])).toEqual([
			['c0', 'included', 'retrieval-context'],
			['c1', 'included', 'retrieval-context'],
			['c2', 'included', 'retrieval-context'],
			['c3', 'included', 'retrieval-context'],
			['c4', 'considered', 'below_cutoff'],
			['c5', 'considered', 'below_cutoff'],
		]);
		const block = trace.blocks.find((b) => b.id === 'retrieval-context');
		expect(block).toMatchObject({ capability: 'project-docs', section: 'grounding', stable: false });
		expect(block?.text).toContain('[Doc] body');
	});

	it('records each chunk’s place — parent, level, position, hash, path, retriever — as the kernel returned it', async () => {
		retrieve.mockResolvedValue({
			chunks: [
				{ ...chunk(0), parentId: 'p0', level: 'paragraph', position: 3, contentHash: 'h0', sourceUri: '/docs/a' },
				{ ...chunk(1), parentId: null, level: 'section', position: 0, contentHash: 'h1', sourceUri: 'desk_file_1' },
				chunk(2),
			],
			totalFound: 3,
			tierUsed: [1],
		});

		const { trace } = await turn(REAL_QUESTION);

		const items = trace.grounding.find((g) => g.id === 'project-docs')?.items ?? [];
		expect(items[0]).toMatchObject({
			parentId: 'p0',
			level: 'paragraph',
			position: 3,
			contentHash: 'h0',
			path: '/docs/a',
			retriever: 'tier-1',
		});
		// A root chunk has no parent; a non-path source uri is not a citable path.
		expect(items[1]).toMatchObject({ level: 'section', position: 0, contentHash: 'h1', retriever: 'tier-1' });
		expect(items[1]).not.toHaveProperty('parentId');
		expect(items[1]).not.toHaveProperty('path');
		// A chunk the kernel returned bare (a tier that does not carry its place yet) records only its retriever.
		expect(items[2]).toMatchObject({ retriever: 'tier-1' });
		for (const key of ['parentId', 'level', 'position', 'contentHash', 'path'])
			expect(items[2]).not.toHaveProperty(key);
	});
});

/**
 * WHAT THE TOOLS INHERIT — the lanes report what they established so the tools reuse it:
 * `search_project_docs` starts with the docs retrieval this turn already paid for.
 */
describe('what the tools inherit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(VECTOR);
		getCorpusMap.mockResolvedValue(null);
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0, tierUsed: [1] });
		formatContextForPrompt.mockReturnValue('');
	});

	it('hands the docs retrieval on as the seed for the user’s question, and tells the model it already ran', async () => {
		const docsResult = {
			chunks: [
				{
					chunkId: 'c1',
					documentId: 'd1',
					documentTitle: 'Doc',
					content: 'body',
					score: 0.9,
					source: 'vector',
					tier: 1,
				},
			],
			totalFound: 1,
			tierUsed: [1],
		};
		retrieve.mockResolvedValue(docsResult);
		formatContextForPrompt.mockReturnValue('[Doc] body');

		const { composition } = await turn(REAL_QUESTION);

		expect(composition.state.docsSeed).toEqual({ query: REAL_QUESTION, result: docsResult });
		expect(composition.systemPrompt).toContain('the documentation was already searched for this question');
	});

	it('hands an empty retrieval on too, so the tool never re-embeds a question that found nothing', async () => {
		const { composition } = await turn(REAL_QUESTION);
		expect(composition.state.docsSeed).toEqual({
			query: REAL_QUESTION,
			result: { chunks: [], totalFound: 0, tierUsed: [1] },
		});
	});
});
