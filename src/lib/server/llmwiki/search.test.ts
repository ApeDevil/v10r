import { beforeEach, describe, expect, it, vi } from 'vitest';

const generateEmbedding = vi.fn();

vi.mock('$lib/server/retrieval/embed', () => ({ generateEmbedding }));
vi.mock('$lib/server/db', () => ({ db: { execute: vi.fn().mockResolvedValue({ rows: [] }) } }));

const { searchLlmwiki } = await import('./search');

/**
 * The second consumer in the `embed_calls_per_turn` budget.
 *
 * The chatbot embeds the user message once and hands the vector to both llmwiki search
 * and the system-docs retrieve (`ai/context-assembly.test.ts`). Sharing only pays if the
 * consumers honour it: an ignored vector costs a second Gemini call against a ~1000/day
 * ceiling, and nothing about the answer looks different when it happens.
 */
describe('searchLlmwiki query vector', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		generateEmbedding.mockResolvedValue(new Array(1536).fill(0));
	});

	it('reuses a caller-supplied embedding instead of computing its own', async () => {
		await searchLlmwiki('a real question about retrieval', {
			userId: 'u1',
			collectionId: null,
			queryEmbedding: new Array(1536).fill(0.5),
		});

		expect(generateEmbedding).not.toHaveBeenCalled();
	});

	it('embeds for itself when no vector is supplied', async () => {
		await searchLlmwiki('a real question about retrieval', { userId: 'u1', collectionId: null });

		expect(generateEmbedding).toHaveBeenCalledTimes(1);
	});

	it('embeds nothing for an empty query', async () => {
		expect(await searchLlmwiki('   ', { userId: 'u1', collectionId: null })).toEqual([]);
		expect(generateEmbedding).not.toHaveBeenCalled();
	});
});
