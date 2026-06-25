import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { env } from '$env/dynamic/private';
import { incrEmbeddingCalls } from '$lib/server/ai/provider-usage';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from './config';
import { RetrievalError } from './errors';

function getEmbeddingModel() {
	const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		throw new RetrievalError('embedding', 'GOOGLE_GENERATIVE_AI_API_KEY is not set for embeddings');
	}
	return createGoogleGenerativeAI({ apiKey }).embedding(EMBEDDING_MODEL);
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

/**
 * Retry an embedding call on transient quota / rate-limit (429) errors with exponential
 * backoff. Without this a single 429 silently ungrounds an entire chat turn (the only
 * embed call funnels both the llmwiki search and the system-docs retrieve). Only the
 * quota family is retried — anything else (e.g. a missing key) fails fast. Budgets are
 * asymmetric: the interactive query path uses a tight budget so a grounded turn can't
 * hang; the batch ingest path can afford to wait out a longer backoff.
 */
async function withEmbedRetry<T>(
	fn: () => Promise<T>,
	{ maxAttempts, baseDelayMs }: { maxAttempts: number; baseDelayMs: number },
): Promise<T> {
	let lastErr: unknown;
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastErr = err;
			if (attempt === maxAttempts - 1 || !RETRYABLE_EMBED_ERROR.test(String(err))) break;
			const delay = baseDelayMs * 2 ** attempt;
			console.warn(`[rawrag:embed] quota/rate error — retrying in ${delay}ms (attempt ${attempt + 1}/${maxAttempts})`);
			await sleep(delay);
		}
	}
	throw lastErr;
}

/** Generate a single embedding for a query string. */
export async function generateEmbedding(text: string): Promise<number[]> {
	try {
		const model = getEmbeddingModel();
		// Interactive path — tight retry budget so a grounded turn can't hang on backoff.
		const result = await withEmbedRetry(() => embed({ model, value: text, providerOptions: queryEmbeddingOptions }), {
			maxAttempts: 2,
			baseDelayMs: 1000,
		});
		// One Gemini API call against the shared GOOGLE_GENERATIVE_AI_API_KEY quota
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
		const model = getEmbeddingModel();
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
