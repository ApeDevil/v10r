/**
 * Unit tests for the llmwiki + rawrag AI tools.
 * Exercises: user-scoping (closure is respected, not forged),
 * drilled-chunk sink wiring, input validation, and pointer limits.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({ db: {} }));

const fetchChunksByIds = vi.fn();
vi.mock('$lib/server/rawrag/queries', () => ({
	fetchChunksByIds: (...args: unknown[]) => fetchChunksByIds(...args),
}));

const fetchPagesByIds = vi.fn();
vi.mock('$lib/server/llmwiki/queries', () => ({
	fetchPagesByIds: (...args: unknown[]) => fetchPagesByIds(...args),
	hydratePointers: vi.fn(async () => new Map()),
	computeCoverage: vi.fn(async () => new Map()),
	findRedirect: vi.fn(async () => null),
	getOverview: vi.fn(async () => null),
}));

const { createGetRawragChunksTool } = await import('./get-rawrag-chunks');
const { createGetLlmwikiPagesTool } = await import('./get-llmwiki-pages');

const USER = 'usr_aay';

function execCtx() {
	return { toolCallId: 'tc', messages: [], abortSignal: new AbortController().signal };
}

describe('get_rawrag_chunks tool', () => {
	it('rejects empty ids array', async () => {
		fetchChunksByIds.mockResolvedValueOnce(new Map());
		const tool = createGetRawragChunksTool(USER).get_rawrag_chunks;
		const result = await tool.execute!({ ids: [] }, execCtx());
		expect((result as { error?: string }).error).toBeDefined();
	});

	it('passes the closure userId to fetchChunksByIds (not a model-supplied one)', async () => {
		fetchChunksByIds.mockResolvedValueOnce(new Map([['chk_1', { chunkId: 'chk_1' }]]));
		const tool = createGetRawragChunksTool(USER).get_rawrag_chunks;
		await tool.execute!({ ids: ['chk_1'] }, execCtx());
		expect(fetchChunksByIds).toHaveBeenCalledWith(['chk_1'], USER);
	});

	it('records drilled chunk ids in the sink', async () => {
		fetchChunksByIds.mockResolvedValueOnce(
			new Map([
				['chk_a', { chunkId: 'chk_a', documentId: 'd', documentTitle: 'x', content: '' }],
				['chk_b', { chunkId: 'chk_b', documentId: 'd', documentTitle: 'x', content: '' }],
			]),
		);
		const recorded: string[] = [];
		const tool = createGetRawragChunksTool(USER, { record: (ids) => recorded.push(...ids) }).get_rawrag_chunks;
		await tool.execute!({ ids: ['chk_a', 'chk_b'] }, execCtx());
		expect(recorded.sort()).toEqual(['chk_a', 'chk_b']);
	});

	it('caps ids to MAX_RAWRAG_TOOL_IDS', async () => {
		fetchChunksByIds.mockResolvedValueOnce(new Map());
		const tool = createGetRawragChunksTool(USER).get_rawrag_chunks;
		const manyIds = Array.from({ length: 30 }, (_, i) => `chk_${i}`);
		await tool.execute!({ ids: manyIds }, execCtx());
		const [idsArg] = fetchChunksByIds.mock.calls[0];
		expect((idsArg as string[]).length).toBeLessThanOrEqual(20);
	});

	it('reports missing ids separately from returned chunks', async () => {
		fetchChunksByIds.mockResolvedValueOnce(
			new Map([['chk_a', { chunkId: 'chk_a', documentId: 'd', documentTitle: 'x', content: '' }]]),
		);
		const tool = createGetRawragChunksTool(USER).get_rawrag_chunks;
		const result = (await tool.execute!({ ids: ['chk_a', 'chk_missing'] }, execCtx())) as {
			chunks: unknown[];
			missing: string[];
		};
		expect(result.chunks.length).toBe(1);
		expect(result.missing).toEqual(['chk_missing']);
	});
});

describe('get_llmwiki_pages tool', () => {
	it('rejects empty ids array', async () => {
		fetchPagesByIds.mockResolvedValueOnce(new Map());
		const tool = createGetLlmwikiPagesTool(USER).get_llmwiki_pages;
		const result = await tool.execute!({ ids: [], include_body: false }, execCtx());
		expect((result as { error?: string }).error).toBeDefined();
	});

	it('forwards include_body flag to fetchPagesByIds', async () => {
		fetchPagesByIds.mockResolvedValueOnce(new Map());
		const tool = createGetLlmwikiPagesTool(USER).get_llmwiki_pages;
		await tool.execute!({ ids: ['lwp_1'], include_body: true }, execCtx());
		expect(fetchPagesByIds).toHaveBeenCalledWith(['lwp_1'], USER, { includeBody: true });
	});

	it('caps ids to MAX_LLMWIKI_TOOL_IDS', async () => {
		fetchPagesByIds.mockResolvedValueOnce(new Map());
		const tool = createGetLlmwikiPagesTool(USER).get_llmwiki_pages;
		const manyIds = Array.from({ length: 25 }, (_, i) => `lwp_${i}`);
		await tool.execute!({ ids: manyIds, include_body: false }, execCtx());
		const [idsArg] = fetchPagesByIds.mock.calls[0];
		expect((idsArg as string[]).length).toBeLessThanOrEqual(10);
	});
});
