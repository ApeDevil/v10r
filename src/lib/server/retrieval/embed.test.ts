/**
 * Unit tests for the embedding retry/backoff added in the retrieval foundation overhaul.
 * A transient Gemini 429 must be retried (otherwise it silently ungrounds a chat turn);
 * a non-quota error or a missing key must fail fast. Mocks the `ai` SDK + env + usage
 * counter so nothing hits the network or Redis.
 */
import { describe, expect, it, vi } from 'vitest';

const { envHolder, embedFn, embedManyFn, incrFn } = vi.hoisted(() => ({
	envHolder: { GOOGLE_GENERATIVE_AI_API_KEY: 'test-key' as string | undefined },
	embedFn: vi.fn(),
	embedManyFn: vi.fn(),
	incrFn: vi.fn(),
}));

vi.mock('$env/dynamic/private', () => ({ env: envHolder }));
vi.mock('ai', () => ({ embed: embedFn, embedMany: embedManyFn }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => ({ embedding: () => ({}) }) }));
vi.mock('$lib/server/ai/provider-usage', () => ({ incrEmbeddingCalls: incrFn }));

const { generateEmbedding, generateEmbeddings } = await import('./embed');
const { RetrievalError } = await import('./errors');

function reset() {
	embedFn.mockReset();
	embedManyFn.mockReset();
	incrFn.mockReset();
	envHolder.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
	vi.useRealTimers();
}

describe('generateEmbedding (query path)', () => {
	it('returns the embedding and counts one call on success', async () => {
		reset();
		embedFn.mockResolvedValueOnce({ embedding: [0.1, 0.2] });
		expect(await generateEmbedding('q')).toEqual([0.1, 0.2]);
		expect(embedFn).toHaveBeenCalledTimes(1);
		expect(incrFn).toHaveBeenCalledTimes(1);
	});

	it('retries a transient 429, then succeeds (counts the call once, not per attempt)', async () => {
		reset();
		embedFn.mockRejectedValueOnce(new Error('429 RESOURCE_EXHAUSTED')).mockResolvedValueOnce({ embedding: [1] });
		vi.useFakeTimers();
		const p = generateEmbedding('q');
		await vi.advanceTimersByTimeAsync(2000);
		expect(await p).toEqual([1]);
		expect(embedFn).toHaveBeenCalledTimes(2);
		expect(incrFn).toHaveBeenCalledTimes(1);
	});

	it('throws RetrievalError after the (tight) retry budget is exhausted', async () => {
		reset();
		embedFn.mockRejectedValue(new Error('quota exceeded'));
		vi.useFakeTimers();
		const p = generateEmbedding('q');
		const assertion = expect(p).rejects.toThrow(RetrievalError);
		await vi.advanceTimersByTimeAsync(5000);
		await assertion;
		expect(embedFn).toHaveBeenCalledTimes(2); // maxAttempts = 2 for the interactive path
	});

	it('does NOT retry a non-quota error — fails fast', async () => {
		reset();
		embedFn.mockRejectedValueOnce(new TypeError('boom'));
		await expect(generateEmbedding('q')).rejects.toThrow(RetrievalError);
		expect(embedFn).toHaveBeenCalledTimes(1);
		expect(incrFn).not.toHaveBeenCalled();
	});

	it('fails fast (no embed call) when the API key is missing', async () => {
		reset();
		envHolder.GOOGLE_GENERATIVE_AI_API_KEY = undefined;
		await expect(generateEmbedding('q')).rejects.toThrow(RetrievalError);
		expect(embedFn).not.toHaveBeenCalled();
	});
});

describe('generateEmbeddings (batch path)', () => {
	it('returns embeddings and counts one call', async () => {
		reset();
		embedManyFn.mockResolvedValueOnce({ embeddings: [[1], [2]] });
		expect(await generateEmbeddings(['a', 'b'])).toEqual([[1], [2]]);
		expect(embedManyFn).toHaveBeenCalledTimes(1);
		expect(incrFn).toHaveBeenCalledTimes(1);
	});

	it('short-circuits an empty input without calling the SDK', async () => {
		reset();
		expect(await generateEmbeddings([])).toEqual([]);
		expect(embedManyFn).not.toHaveBeenCalled();
	});
});
