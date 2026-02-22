import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { env } from '$env/dynamic/private';
import { EMBEDDING_MODEL } from './config';
import { RetrievalError } from './errors';

function getEmbeddingModel() {
	const apiKey = env.OPENAI_API_KEY;
	if (!apiKey) {
		throw new RetrievalError('embedding', 'OPENAI_API_KEY is not set for embeddings');
	}
	return createOpenAI({ apiKey }).embedding(EMBEDDING_MODEL);
}

/** Generate a single embedding for a query string. */
export async function generateEmbedding(text: string): Promise<number[]> {
	try {
		const model = getEmbeddingModel();
		const result = await embed({ model, value: text });
		return result.embedding;
	} catch (err) {
		if (err instanceof RetrievalError) throw err;
		throw new RetrievalError(
			'embedding',
			`Failed to generate embedding: ${err instanceof Error ? err.message : 'Unknown error'}`,
		);
	}
}

/** Generate embeddings for multiple texts in a single batch. */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];

	try {
		const model = getEmbeddingModel();
		const result = await embedMany({ model, values: texts });
		return result.embeddings;
	} catch (err) {
		if (err instanceof RetrievalError) throw err;
		throw new RetrievalError(
			'embedding',
			`Failed to generate embeddings: ${err instanceof Error ? err.message : 'Unknown error'}`,
		);
	}
}
