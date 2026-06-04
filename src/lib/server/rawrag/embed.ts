import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { env } from '$env/dynamic/private';
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

/** Generate a single embedding for a query string. */
export async function generateEmbedding(text: string): Promise<number[]> {
	try {
		const model = getEmbeddingModel();
		const result = await embed({ model, value: text, providerOptions: queryEmbeddingOptions });
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
		const result = await embedMany({ model, values: texts, providerOptions: documentEmbeddingOptions });
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
