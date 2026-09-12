/**
 * EMBED BUDGET — `embed_calls_per_turn`, measured rather than asserted in a comment.
 *
 * The budget in `perf/budgets.json` warns at 1 and fails at 2, because Gemini's free
 * embedding tier is ~1000 calls a day and a chatbot turn that embeds twice halves the
 * number of conversations the site can hold. Nothing measured it: the sharing that keeps
 * it at one lives in a single `?? :` in this module, and the failure mode of losing it
 * is not an error but a quietly doubled bill.
 *
 * The count is proved in two halves, because no single seam sees both. Here: the turn
 * embeds ONCE and hands the same vector to both consumers. In `retrieval/index.test.ts`
 * and `llmwiki/search.test.ts`: a consumer handed a vector does not embed again. Neither
 * half is sufficient on its own — a turn could share one vector with a consumer that
 * ignores it, or a consumer could honour a vector nobody shares.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { budgets, scoreBudget } from '$lib/server/perf';
import type { AssemblyTelemetry } from './context-assembly';

const generateEmbedding = vi.fn();
const searchLlmwiki = vi.fn();
const retrieve = vi.fn();
const formatLlmwikiContext = vi.fn().mockReturnValue('');
const formatContextForPrompt = vi.fn().mockReturnValue('');
const searchCatalogRecords = vi.fn();

vi.mock('$lib/server/retrieval/embed', () => ({ generateEmbedding }));
vi.mock('$lib/server/llmwiki', () => ({
	searchLlmwiki,
	loadOverview: vi.fn().mockResolvedValue(null),
	formatLlmwikiContext,
}));
vi.mock('$lib/server/retrieval', () => ({ retrieve, formatContextForPrompt }));
vi.mock('$lib/server/search', () => ({ formatCatalogMap: vi.fn().mockResolvedValue('') }));
vi.mock('./tools/search-catalog', () => ({ searchCatalogRecords }));

const { assembleChatbotContext, catalogQueryOf, wantsNavigation } = await import('./context-assembly');

const VECTOR = new Array(1536).fill(0.1);

/** Long enough to pass the triviality gate — a turn with a real question in it. */
const REAL_QUESTION = 'How does the retrieval pipeline decide which chunks enter the prompt?';

type AssemblyInput = Parameters<typeof assembleChatbotContext>[0];

function turn(
	userMsgText: string,
	pageContext: AssemblyInput['pageContext'] = null,
	extra: Partial<AssemblyInput> = {},
) {
	return assembleChatbotContext({
		userId: 'user-1',
		userMsgText,
		baseSystemPrompt: 'You are Vely.',
		collectionId: null,
		pageContext,
		catalogLocale: 'en',
		hasTools: true,
		...extra,
	});
}

describe('embed calls per turn', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(VECTOR);
		searchLlmwiki.mockResolvedValue([]);
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0 });
	});

	it('embeds the user message once and shares the vector with both consumers', async () => {
		await turn(REAL_QUESTION);

		expect(generateEmbedding).toHaveBeenCalledTimes(1);
		// Identity, not equality: two structurally identical vectors would mean two
		// provider calls, which is exactly the regression this exists to catch.
		expect(searchLlmwiki.mock.calls[0][1].queryEmbedding).toBe(VECTOR);
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
		expect(searchLlmwiki).not.toHaveBeenCalled();
		expect(retrieve).not.toHaveBeenCalled();
	});

	it('accepts a second embed only on the page-grounding path, and says so', async () => {
		// The documented exception: when the message points at the current page, the
		// system-docs query is page-seeded and is therefore a DIFFERENT question, which
		// cannot reuse a vector computed for the bare message. That is two embeds on a
		// rare path and it is a choice, not a leak — pinned here so it stays rare.
		await turn('How does this page work?', {
			path: '/showcases/velocity/runtime',
			title: 'Velocity runtime',
			breadcrumb: ['Showcases', 'Velocity'],
			surface: 'showcase',
		});

		expect(generateEmbedding).toHaveBeenCalledTimes(1);
		// The shared vector went to llmwiki; system-docs was handed no vector and embeds
		// its own page-seeded query downstream. Two calls for the turn, one of them here.
		expect(searchLlmwiki.mock.calls[0][1].queryEmbedding).toBe(VECTOR);
		expect(retrieve.mock.calls[0][1].queryEmbedding).toBeUndefined();
		expect(scoreBudget('embed_calls_per_turn', 2)).toBe('warn');
	});

	it('hands the request connection to every embed of the turn, so no provider row is re-read', async () => {
		// The guard's registry already opened the Google key. Both places this turn can embed —
		// the shared query vector and the page-seeded retrieve, which embeds its own query —
		// receive that connection; neither falls back to a second row read.
		const connection = { apiKey: 'request-key' };
		await turn(
			'How does this page work?',
			{
				path: '/showcases/velocity/runtime',
				title: 'Velocity runtime',
				breadcrumb: ['Showcases'],
				surface: 'showcase',
			},
			{ embeddingConnection: connection },
		);

		expect(generateEmbedding.mock.calls[0][1]).toEqual({ connection });
		expect(retrieve.mock.calls[0][1].embeddingConnection).toBe(connection);
	});
});

/**
 * LANE TIMINGS — each lane reports its own settle time, not the barrier's.
 *
 * The four retrieval lanes join at one `Promise.allSettled`. Measured after the barrier,
 * a 10 s cold turn read as "every lane took 10 s" and the cost could not be attributed —
 * which is the difference between fixing one lane and rewriting four.
 */
describe('lane timings', () => {
	type StepEvent = Extract<Parameters<AssemblyTelemetry['emit']>[0], { type: 'pipeline:step' }>;
	const steps = () => {
		const events: StepEvent[] = [];
		const telemetry: AssemblyTelemetry = {
			emit: (e) => {
				if (e.type === 'pipeline:step') events.push(e);
			},
			t0: performance.now(),
		};
		return { events, telemetry };
	};
	const timedTurn = (text: string, telemetry: AssemblyTelemetry) =>
		assembleChatbotContext(
			{
				userId: 'user-1',
				userMsgText: text,
				baseSystemPrompt: 'You are Vely.',
				collectionId: null,
				pageContext: null,
				catalogLocale: 'en',
				hasTools: true,
			},
			telemetry,
		);
	const resolveAfter = <T>(ms: number, value: T) => new Promise<T>((r) => setTimeout(() => r(value), ms));

	beforeEach(() => {
		vi.clearAllMocks();
		searchLlmwiki.mockResolvedValue([]);
	});

	it('does not charge a slow docs lane to the fast wiki lane', async () => {
		generateEmbedding.mockResolvedValue(VECTOR);
		retrieve.mockImplementation(() => resolveAfter(200, { chunks: [], totalFound: 0 }));

		const { timings } = await timedTurn(REAL_QUESTION, steps().telemetry);

		expect(timings.docsMs).toBeGreaterThanOrEqual(190);
		expect(timings.llmwikiMs).toBeLessThan(100);
		expect(timings.embedMs).toBeLessThan(100);
		expect(timings.overviewMs).toBeLessThan(100);
	});

	it('emits one embed step on a grounded turn, with its own duration and no query text', async () => {
		generateEmbedding.mockImplementation(() => resolveAfter(60, VECTOR));
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0 });
		const { events, telemetry } = steps();

		await timedTurn(REAL_QUESTION, telemetry);

		const embed = events.filter((e) => e.step === 'embed');
		expect(embed.map((e) => e.status)).toEqual(['active', 'done']);
		expect(embed[1].durationMs).toBeGreaterThanOrEqual(50);
		expect(embed[1].detail).toEqual({ kind: 'embed', dimensions: 1536, reused: false });
		expect(JSON.stringify(embed)).not.toContain(REAL_QUESTION);
	});

	it('emits no embed step on a trivial turn', async () => {
		const { events, telemetry } = steps();
		await timedTurn('hi', telemetry);
		expect(events.some((e) => e.step === 'embed')).toBe(false);
	});

	it('closes the embed lane as an error when the provider call rejects', async () => {
		generateEmbedding.mockRejectedValue(new Error('429 RESOURCE_EXHAUSTED'));
		const { events, telemetry } = steps();

		const result = await timedTurn(REAL_QUESTION, telemetry);

		const done = events.find((e) => e.step === 'embed' && e.status !== 'active');
		expect(done?.status).toBe('error');
		expect(done?.error).toContain('429');
		// Both consumers still degrade exactly as before — the turn proceeds without context.
		expect(result.errors.llmwiki).toContain('429');
		expect(result.errors.docs).toContain('429');
	});
});

/**
 * NAVIGATION GROUNDING — a "where is…" question gets its verified catalog rows before the
 * model runs, in the prompt, instead of one model step spent asking `search_catalog` (and,
 * with the raw sentence as the query, often finding nothing).
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
		searchLlmwiki.mockResolvedValue([]);
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0 });
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
		const result = await turn('Where is the auth showcase? Give me the link.', null, { authCeiling: 'admin' });

		expect(searchCatalogRecords).toHaveBeenCalledWith('auth', {
			locale: 'en',
			authCeiling: 'admin',
			surface: 'showcase',
			limit: 5,
		});
		expect(result.gates.wantsNavigation).toBe(true);
		expect(result.catalogResults).toEqual([authn]);
		// The path verbatim, the block dynamic, the rule that makes it citable — and the map after it.
		expect(result.systemPrompt).toContain('- [showcase] AuthN — /showcases/auth/authn (Identity & Access)');
		expect(result.systemPrompt).toContain('verified catalog results for this turn');
		expect(result.blocks.find((b) => b.id === 'catalog-results')).toMatchObject({ dynamic: true });
		const ids = result.blocks.map((b) => b.id);
		expect(ids.indexOf('catalog-results')).toBeLessThan(ids.indexOf('catalog-map'));
		expect(result.timings.catalogMs).toBeGreaterThanOrEqual(0);
	});

	it('spends nothing on the catalog for a question that names its own topic', async () => {
		const result = await turn(REAL_QUESTION);

		expect(searchCatalogRecords).not.toHaveBeenCalled();
		expect(result.gates.wantsNavigation).toBe(false);
		expect(result.catalogResults).toEqual([]);
		expect(result.blocks.some((b) => b.id === 'catalog-results')).toBe(false);
	});

	it('proceeds without the block when the catalog lane fails, and says so', async () => {
		searchCatalogRecords.mockRejectedValue(new Error('neon down'));

		const result = await turn('Where is the auth showcase?');

		expect(result.errors.catalog).toContain('neon down');
		expect(result.catalogResults).toEqual([]);
		expect(result.blocks.some((b) => b.id === 'catalog-results')).toBe(false);
		expect(result.systemPrompt).toContain('Project catalog rules');
	});

	it('emits one catalog step, active then done with the hit count', async () => {
		const events: Array<{ step: string; status: string; detail?: unknown }> = [];
		await assembleChatbotContext(
			{
				userId: 'user-1',
				userMsgText: 'Where is the auth showcase?',
				baseSystemPrompt: 'You are Vely.',
				collectionId: null,
				pageContext: null,
				catalogLocale: 'en',
				hasTools: true,
			},
			{
				emit: (e) => {
					if (e.type === 'pipeline:step') events.push(e);
				},
				t0: performance.now(),
			},
		);
		const catalog = events.filter((e) => e.step === 'catalog');
		expect(catalog.map((e) => e.status)).toEqual(['active', 'done']);
		expect(catalog[1].detail).toEqual({ kind: 'catalog', hits: 1, surface: 'showcase' });
	});
});

/**
 * WHAT THE TOOL SET FOLLOWS — the assembly reports what it established so the tools mount
 * and reuse accordingly: the llmwiki drill-down pair exists only behind an llmwiki context
 * block, and `search_project_docs` starts with the docs retrieval this turn already paid for.
 */
describe('what the tools inherit', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(VECTOR);
		searchLlmwiki.mockResolvedValue([]);
		retrieve.mockResolvedValue({ chunks: [], totalFound: 0 });
		formatLlmwikiContext.mockReturnValue('');
		formatContextForPrompt.mockReturnValue('');
	});

	it('reports llmwiki grounding exactly when the context block (and its retrieval rules) entered the prompt', async () => {
		const bare = await turn(REAL_QUESTION);
		expect(bare.llmwikiGrounded).toBe(false);
		expect(bare.systemPrompt).not.toContain('get_source_chunks');

		formatLlmwikiContext.mockReturnValue('<llmwiki-hits>page</llmwiki-hits>');
		const grounded = await turn(REAL_QUESTION);
		expect(grounded.llmwikiGrounded).toBe(true);
		expect(grounded.systemPrompt).toContain('get_source_chunks');
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
		};
		retrieve.mockResolvedValue(docsResult);
		formatContextForPrompt.mockReturnValue('[Doc] body');

		const result = await turn(REAL_QUESTION);

		expect(result.docsSeed).toEqual({ query: REAL_QUESTION, result: docsResult });
		expect(result.systemPrompt).toContain("The documentation was already searched for the user's question");
	});

	it('has no seed to hand on when the docs lane found nothing', async () => {
		const result = await turn(REAL_QUESTION);
		expect(result.docsSeed).toBeUndefined();
	});
});
