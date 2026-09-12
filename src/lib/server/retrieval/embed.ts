import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { EMBEDDING_UNAVAILABLE_MESSAGES, type EmbeddingConnection, loadEmbeddingConnection } from '$lib/server/ai';
import { incrEmbeddingCalls } from '$lib/server/ai/provider-usage';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './config';
import { RetrievalError } from './errors';

/**
 * Embeddings ride the administrator's Google connection. A request that already opened
 * the provider registry passes that connection in (one row read per request); anything
 * else — ingest scripts, showcases, a bare `retrieve()` — reads the row fresh, so a key
 * replaced in the admin form reaches the next embed on every instance. The model stays
 * `EMBEDDING_MODEL`: stored vectors belong to it, and a different embedding model is a
 * re-embedding operation, not a setting.
 */
async function getEmbeddingModel(supplied?: EmbeddingConnection) {
	const connection = supplied ?? (await loadEmbeddingConnection());
	if ('unavailable' in connection) {
		throw new RetrievalError('embedding', EMBEDDING_UNAVAILABLE_MESSAGES[connection.unavailable]);
	}
	return createGoogleGenerativeAI({ apiKey: connection.apiKey }).embedding(EMBEDDING_MODEL);
}

export interface EmbedOptions {
	/** The request's already-opened Google connection; absent → read the provider row. */
	connection?: EmbeddingConnection;
}

// Gemini embeddings are task-type-aware. Queries and documents must be embedded
// with matching RETRIEVAL_* task types or cosine similarity between a query and a
// stored chunk degrades. Single = query, batch = documents (see callers).
const queryEmbeddingOptions = {
	google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_QUERY' },
};
const documentEmbeddingOptions = {
	google: { outputDimensionality: EMBEDDING_DIMENSIONS, taskType: 'RETRIEVAL_DOCUMENT' },
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** The transient Gemini-quota error family worth retrying (matches the ingest script). */
const RETRYABLE_EMBED_ERROR = /quota|rate|429|RESOURCE_EXHAUSTED/i;

/** Error class + HTTP status for a log line — never the message (it can echo the request). */
function describeEmbedError(err: unknown): string {
	if (!(err instanceof Error)) return typeof err;
	const status = (err as { statusCode?: unknown }).statusCode;
	return typeof status === 'number' ? `${err.name} ${status}` : err.name;
}

/**
 * Retry an embedding call on transient quota / rate-limit (429) errors with exponential
 * backoff. Without this a single 429 silently ungrounds an entire chat turn (the only
 * embed call funnels both the llmwiki search and the system-docs retrieve). Only the
 * quota family is retried — anything else (e.g. a missing key) fails fast. Budgets are
 * asymmetric: the interactive query path uses a tight budget so a grounded turn can't
 * hang; the batch ingest path can afford to wait out a longer backoff.
 *
 * Every failed attempt logs its own elapsed time and error class, so a slow grounded turn
 * can be read off the server log as "one 8 s attempt" or "two 1 s attempts + backoff".
 */
async function withEmbedRetry<T>(
	fn: () => Promise<T>,
	{ maxAttempts, baseDelayMs }: { maxAttempts: number; baseDelayMs: number },
): Promise<T> {
	let lastErr: unknown;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const started = performance.now();
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			const elapsed = Math.round(performance.now() - started);
			const attemptLabel = `attempt ${attempt + 1}/${maxAttempts} failed after ${elapsed}ms (${describeEmbedError(err)})`;
			if (attempt === maxAttempts - 1 || !RETRYABLE_EMBED_ERROR.test(String(err))) {
				console.warn(`[retrieval:embed] ${attemptLabel} — giving up`);
				break;
			}
			const delay = baseDelayMs * 2 ** attempt;
			console.warn(`[retrieval:embed] ${attemptLabel} — quota/rate error, retrying in ${delay}ms`);
			await sleep(delay);
		}
	}
	throw lastErr;
}

/** Generate a single embedding for a query string. */
export async function generateEmbedding(text: string, options?: EmbedOptions): Promise<number[]> {
	try {
		const model = await getEmbeddingModel(options?.connection);
		// Interactive path — tight retry budget so a grounded turn can't hang on backoff.
		// `maxRetries: 0`: the SDK would otherwise retry 429s itself (2 attempts, 2 s + 4 s
		// backoff) underneath this wrapper — invisible to the attempt log and to the turn's
		// embed timing, and up to 6 s of silent wait on the answer path. One retry layer.
		const result = await withEmbedRetry(
			() => embed({ model, value: text, providerOptions: queryEmbeddingOptions, maxRetries: 0 }),
			{ maxAttempts: 2, baseDelayMs: 1000 },
		);
		// One Gemini API call against the shared Google connection's quota
		// — invisible to conversation_step, so count it for the quota board. Counted
		// once per SUCCESSFUL call, never per retry attempt.
		void incrEmbeddingCalls(1);
		return result.embedding;
	} catch (err) {
		if (err instanceof RetrievalError) throw err;
		throw new RetrievalError(
			'embedding',
			`Failed to generate embedding: ${err instanceof Error ? err.message : 'Unknown error'}`,
			{ cause: err },
		);
	}
}

/** Generate embeddings for multiple texts in a single batch. */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];

	try {
		const model = await getEmbeddingModel();
		// Batch / ingest path — generous retry budget; it can afford to wait out a 429.
		const result = await withEmbedRetry(
			() => embedMany({ model, values: texts, providerOptions: documentEmbeddingOptions }),
			{ maxAttempts: 6, baseDelayMs: 4000 },
		);
		// One batch API call against the shared Google key (ingest path). Counted
		// as a single request — what the provider's RPD ceiling actually meters.
		void incrEmbeddingCalls(1);
		return result.embeddings;
	} catch (err) {
		if (err instanceof RetrievalError) throw err;
		throw new RetrievalError(
			'embedding',
			`Failed to generate embeddings: ${err instanceof Error ? err.message : 'Unknown error'}`,
			{ cause: err },
		);
	}
}
