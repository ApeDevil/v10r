/**
 * Unit tests for the embedding retry/backoff added in the retrieval foundation overhaul.
 * A transient Gemini 429 must be retried (otherwise it silently ungrounds a chat turn);
 * a non-quota error or an unavailable Google connection must fail fast. Mocks the `ai`
 * SDK + the saved-connection loader + usage counter so nothing hits the network, the
 * database or Redis.
 */
import { describe, expect, it, vi } from 'vitest';

const { connectionHolder, embedFn, embedManyFn, incrFn, loadConnectionFn } = vi.hoisted(() => {
	const connectionHolder = { value: { apiKey: 'test-key' } as { apiKey: string } | { unavailable: 'no_key' } };
	return {
		connectionHolder,
		embedFn: vi.fn(),
		embedManyFn: vi.fn(),
		incrFn: vi.fn(),
		loadConnectionFn: vi.fn(async () => connectionHolder.value),
	};
});

vi.mock('$lib/server/ai', () => ({
	loadEmbeddingConnection: loadConnectionFn,
	EMBEDDING_UNAVAILABLE_MESSAGES: { no_key: 'no key', disabled: 'disabled', undecryptable: 'undecryptable' },
}));
vi.mock('ai', () => ({ embed: embedFn, embedMany: embedManyFn }));
vi.mock('@ai-sdk/google', () => ({ createGoogleGenerativeAI: () => ({ embedding: () => ({}) }) }));
vi.mock('$lib/server/ai/provider-usage', () => ({ incrEmbeddingCalls: incrFn }));

const { generateEmbedding, generateEmbeddings } = await import('./embed');
const { RetrievalError } = await import('./errors');

function reset() {
	embedFn.mockReset();
	embedManyFn.mockReset();
	incrFn.mockReset();
	loadConnectionFn.mockClear();
	connectionHolder.value = { apiKey: 'test-key' };
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

	it('is the only retry layer — the SDK call is made with maxRetries: 0', async () => {
		// The SDK defaults to two silent retries with 2 s + 4 s backoff. Underneath this
		// wrapper that is up to 6 s of invisible wait on the answer path and an attempt count
		// the log cannot see. One layer: what the wrapper counts is what the network did.
		reset();
		embedFn.mockResolvedValueOnce({ embedding: [1] });
		await generateEmbedding('q');
		expect(embedFn.mock.calls[0][0]).toMatchObject({ maxRetries: 0 });
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

	it('fails fast (no embed call) when the Google connection has no key', async () => {
		reset();
		connectionHolder.value = { unavailable: 'no_key' };
		await expect(generateEmbedding('q')).rejects.toThrow(RetrievalError);
		expect(embedFn).not.toHaveBeenCalled();
	});

	// A request that already opened the registry hands its connection in: no second row
	// read, no second decrypt — and the same refusal rules when that connection is unusable.
	it('embeds over a supplied connection without reading the provider row', async () => {
		reset();
		connectionHolder.value = { unavailable: 'no_key' }; // the row path would refuse
		embedFn.mockResolvedValueOnce({ embedding: [2] });
		expect(await generateEmbedding('q', { connection: { apiKey: 'request-key' } })).toEqual([2]);
		expect(loadConnectionFn).not.toHaveBeenCalled();
	});

	it('refuses a supplied connection that is unavailable, without an embed call', async () => {
		reset();
		await expect(generateEmbedding('q', { connection: { unavailable: 'disabled' } })).rejects.toThrow(/disabled/);
		expect(embedFn).not.toHaveBeenCalled();
		expect(loadConnectionFn).not.toHaveBeenCalled();
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
