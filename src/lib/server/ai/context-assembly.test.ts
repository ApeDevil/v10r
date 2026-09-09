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

const generateEmbedding = vi.fn();
const searchLlmwiki = vi.fn();
const retrieve = vi.fn();

vi.mock('$lib/server/retrieval/embed', () => ({ generateEmbedding }));
vi.mock('$lib/server/llmwiki', () => ({
	searchLlmwiki,
	loadOverview: vi.fn().mockResolvedValue(null),
	formatLlmwikiContext: vi.fn().mockReturnValue(''),
}));
vi.mock('$lib/server/retrieval', () => ({
	retrieve,
	formatContextForPrompt: vi.fn().mockReturnValue(''),
}));
vi.mock('$lib/server/search', () => ({ formatCatalogMap: vi.fn().mockResolvedValue('') }));

const { assembleChatbotContext } = await import('./context-assembly');

const VECTOR = new Array(1536).fill(0.1);

/** Long enough to pass the triviality gate — a turn with a real question in it. */
const REAL_QUESTION = 'How does the retrieval pipeline decide which chunks enter the prompt?';

function turn(userMsgText: string, pageContext: Parameters<typeof assembleChatbotContext>[0]['pageContext'] = null) {
	return assembleChatbotContext({
		userId: 'user-1',
		userMsgText,
		baseSystemPrompt: 'You are Vely.',
		collectionId: null,
		pageContext,
		catalogLocale: 'en',
		hasTools: true,
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
});
