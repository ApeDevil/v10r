/**
 * search_project_docs — what the tool reuses and what it spends. The request's embedding
 * connection reaches the retrieve call (no second provider-row read), and a query that is the
 * assembly's own question is answered from the assembly's retrieval (no second embedding).
 * `retrieve` and the database are mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RankedChunk, RetrievalResult } from '$lib/server/retrieval/types';

const mocks = vi.hoisted(() => ({
	retrieve: vi.fn(),
	/** Rows the `document` path lookup returns — one per doc id the chunks name. */
	docRows: [] as Array<{ id: string; sourceUri: string }>,
}));

vi.mock('$lib/server/retrieval', () => ({ retrieve: mocks.retrieve }));
vi.mock('$lib/server/db', () => ({
	db: { select: () => ({ from: () => ({ where: async () => mocks.docRows }) }) },
}));

const { createSearchDocsTool } = await import('./search-docs');
const { SYSTEM_DOCS_USER_ID } = await import('$lib/server/retrieval/config');

// biome-ignore lint/suspicious/noExplicitAny: invoking the AI SDK tool's execute directly in a unit test
const exec = (tool: any, args: { query: string; limit?: number }) =>
	tool.execute(args, { toolCallId: 't', messages: [] });

const EMPTY: RetrievalResult = { chunks: [], entities: [], tierUsed: [1], durationMs: 1 };

function chunk(id: string, documentId: string, score: number): RankedChunk {
	return {
		chunkId: id,
		documentId,
		documentTitle: `Doc ${documentId}`,
		content: `body of ${id}`,
		score,
		source: 'vector',
		tier: 1,
	};
}

beforeEach(() => {
	mocks.retrieve.mockReset();
	mocks.docRows = [];
});

describe('search_project_docs', () => {
	it('retrieves over the system docs corpus with the supplied embedding connection', async () => {
		mocks.retrieve.mockResolvedValueOnce(EMPTY);
		const embeddingConnection = { apiKey: 'request-key' };
		const { search_project_docs } = createSearchDocsTool('en', undefined, { embeddingConnection });

		expect(await exec(search_project_docs, { query: '  how does retrieval work ' })).toEqual({ results: [] });
		expect(mocks.retrieve).toHaveBeenCalledWith('how does retrieval work', {
			userId: SYSTEM_DOCS_USER_ID,
			maxChunks: 5,
			embeddingConnection,
		});
	});

	it('leaves the connection undefined when none was supplied (the row path)', async () => {
		mocks.retrieve.mockResolvedValueOnce(EMPTY);
		const { search_project_docs } = createSearchDocsTool('en');

		await exec(search_project_docs, { query: 'q', limit: 3 });
		expect(mocks.retrieve).toHaveBeenCalledWith('q', {
			userId: SYSTEM_DOCS_USER_ID,
			maxChunks: 3,
			embeddingConnection: undefined,
		});
	});

	// The prompt tells the model the docs were already searched for the user's question; when
	// it asks that question anyway, the answer is the assembly's pool — capped like a fresh
	// call, paths resolved and surfaced like a fresh call — and no embedding is spent.
	it('answers the assembly’s own question from its seed without retrieving again', async () => {
		const seed = {
			query: 'How does the retrieval pipeline work?',
			result: { ...EMPTY, chunks: [chunk('c1', 'd1', 0.9), chunk('c2', 'd2', 0.8), chunk('c3', 'd1', 0.7)] },
		};
		mocks.docRows = [
			{ id: 'd1', sourceUri: '/docs/blueprint/ai/layered-rag' },
			{ id: 'd2', sourceUri: '/docs/blueprint/ai/turn-trace' },
		];
		const surfaced: Array<{ path: string }> = [];
		const calls: Array<string | undefined> = [];
		const { search_project_docs } = createSearchDocsTool(
			'en',
			{
				record: (rows, toolCallId) => {
					surfaced.push(...rows);
					calls.push(toolCallId);
				},
			},
			{ seed },
		);

		const out = await exec(search_project_docs, { query: '  how does the retrieval pipeline work?', limit: 2 });

		expect(mocks.retrieve).not.toHaveBeenCalled();
		expect(out.results.map((r: { path: string | null }) => r.path)).toEqual([
			'/docs/blueprint/ai/layered-rag',
			'/docs/blueprint/ai/turn-trace',
		]);
		expect(surfaced.map((r) => r.path)).toEqual(['/docs/blueprint/ai/layered-rag', '/docs/blueprint/ai/turn-trace']);
		expect(calls).toEqual(['t']);
	});

	it('retrieves once — over the request connection — for a different question', async () => {
		mocks.retrieve.mockResolvedValueOnce(EMPTY);
		const embeddingConnection = { apiKey: 'request-key' };
		const seed = {
			query: 'How does the retrieval pipeline work?',
			result: { ...EMPTY, chunks: [chunk('c1', 'd1', 0.9)] },
		};
		const { search_project_docs } = createSearchDocsTool('en', undefined, { embeddingConnection, seed });

		await exec(search_project_docs, { query: 'why drizzle push-only' });

		expect(mocks.retrieve).toHaveBeenCalledTimes(1);
		expect(mocks.retrieve).toHaveBeenCalledWith('why drizzle push-only', {
			userId: SYSTEM_DOCS_USER_ID,
			maxChunks: 5,
			embeddingConnection,
		});
	});
});
