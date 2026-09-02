/**
 * Fixed reference corpus for the embedding showcase.
 *
 * The cosine-similarity bars compare the uploaded image's embedding to this tiny
 * set of concept captions, so a visitor sees WHERE the vector lands semantically
 * ("closest to: Portrait, City street, …"). The vectors are embedded lazily on
 * first use and cached per model (no build-time literals, no per-request cost):
 *
 *   - text modality  → corpus embedded with the text model (RETRIEVAL_DOCUMENT)
 *   - image modality → corpus embedded with the multimodal model (text inputs land
 *     in the SAME shared space as the image vector — that's the whole point)
 *
 * System-owned, never persisted, never per-user.
 */
export interface CorpusEntry {
	label: string;
	text: string;
}

export const IMAGE_KIT_CORPUS: CorpusEntry[] = [
	{ label: 'Portrait', text: 'a close-up portrait photograph of a person face' },
	{ label: 'Landscape', text: 'a wide outdoor landscape with mountains, trees and sky' },
	{ label: 'City street', text: 'a busy city street with buildings, cars and people' },
	{ label: 'Food', text: 'a plated meal of food on a table, photographed up close' },
	{ label: 'Animal', text: 'a photograph of an animal such as a cat, dog or bird' },
	{ label: 'Product', text: 'a product photograph of a single object on a plain background' },
	{ label: 'Screenshot', text: 'a screenshot of a software user interface with text and buttons' },
	{ label: 'Diagram', text: 'a chart, graph or diagram that visualizes data' },
];

export interface CorpusVector {
	label: string;
	vector: number[];
}

const caches = new Map<string, CorpusVector[]>();

/**
 * Embed (and cache) the corpus with a caller-supplied embedder. `cacheKey` keeps
 * one cache per embedding model so text/image modalities don't collide.
 */
export async function getCorpus(
	cacheKey: string,
	embedTexts: (texts: string[]) => Promise<number[][]>,
): Promise<CorpusVector[]> {
	const hit = caches.get(cacheKey);
	if (hit) return hit;
	const vectors = await embedTexts(IMAGE_KIT_CORPUS.map((e) => e.text));
	const built = IMAGE_KIT_CORPUS.map((e, i) => ({ label: e.label, vector: vectors[i] ?? [] }));
	caches.set(cacheKey, built);
	return built;
}
