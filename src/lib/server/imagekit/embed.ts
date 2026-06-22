/**
 * Embedding showcase core.
 *
 * Default (text modality): embed the AI-generated caption with the SAME text model
 * the RAG pipeline uses (`gemini-embedding-001`, 1536-dim) — the honest "this is how
 * RAG indexes an image: via its description" story. Reuses `generateEmbedding`.
 *
 * Optional (image modality, off by default): embed the actual IMAGE with the
 * multimodal `gemini-embedding-2-preview`. VIZ-ONLY — never written anywhere
 * (dimension-incompatible with the 1536-d text index, and the whole page persists
 * nothing). The corpus is re-embedded with the same model so cosine is comparable.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { embed, embedMany } from 'ai';
import { env } from '$env/dynamic/private';
import type { EmbedNeighbor } from '$lib/schemas/showcase/image-kit';
import { incrEmbeddingCalls } from '$lib/server/ai/provider-usage';
import { EMBEDDING_MODEL } from '$lib/server/rawrag/config';
import { generateEmbedding, generateEmbeddings } from '$lib/server/rawrag/embed';
import { type CorpusVector, getCorpus } from './corpus';

const MULTIMODAL_MODEL = 'gemini-embedding-2-preview';

export function l2Norm(vec: number[]): number {
	let sum = 0;
	for (const x of vec) sum += x * x;
	return Math.sqrt(sum);
}

export function cosineSimilarity(a: number[], b: number[]): number {
	if (a.length !== b.length || a.length === 0) return 0;
	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		na += a[i] * a[i];
		nb += b[i] * b[i];
	}
	const denom = Math.sqrt(na) * Math.sqrt(nb);
	return denom === 0 ? 0 : dot / denom;
}

/** Cosine similarity of a query vector to each corpus entry, sorted desc. */
export function neighborsFrom(query: number[], corpus: CorpusVector[]): EmbedNeighbor[] {
	return corpus
		.map((c) => ({ label: c.label, similarity: cosineSimilarity(query, c.vector) }))
		.sort((a, b) => b.similarity - a.similarity);
}

export interface EmbedRun {
	vector: number[];
	dimensions: number;
	model: string;
	modality: 'text' | 'image';
	neighbors: EmbedNeighbor[];
}

/** Embed the AI caption (text). Throws on provider/quota failure; the RPC maps it. */
export async function embedCaptionText(text: string): Promise<EmbedRun> {
	const vector = await generateEmbedding(text); // gemini-embedding-001, RETRIEVAL_QUERY
	const corpus = await getCorpus('text', generateEmbeddings); // RETRIEVAL_DOCUMENT
	return {
		vector,
		dimensions: vector.length,
		model: EMBEDDING_MODEL,
		modality: 'text',
		neighbors: neighborsFrom(vector, corpus),
	};
}

/** Embed the actual image (multimodal, off by default). Throws on failure; the RPC isolates it. */
export async function embedImage(bytes: Uint8Array, mimeType: string): Promise<EmbedRun> {
	const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) throw new Error('no_provider');

	const model = createGoogleGenerativeAI({ apiKey }).embedding(MULTIMODAL_MODEL);
	const base64 = Buffer.from(bytes).toString('base64');
	const result = await embed({
		model,
		value: '',
		providerOptions: { google: { content: [[{ inlineData: { mimeType, data: base64 } }]] } },
	});
	void incrEmbeddingCalls(1);
	const vector = result.embedding;

	// Corpus embedded with the SAME multimodal model (text inputs land in the shared space).
	const corpus = await getCorpus('image', async (texts) => {
		const r = await embedMany({ model, values: texts });
		void incrEmbeddingCalls(1);
		return r.embeddings;
	});

	return {
		vector,
		dimensions: vector.length,
		model: MULTIMODAL_MODEL,
		modality: 'image',
		neighbors: neighborsFrom(vector, corpus),
	};
}
