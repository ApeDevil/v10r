import { CHUNK_OVERLAP, PARAGRAPH_CHUNK_TARGET, SECTION_CHUNK_TARGET } from './config';
import { splitMarkdown } from './markdown-split';
import type { RawChunk } from './types';

/** Rough token count estimate: ~4 chars per token for English text */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Generate a content hash using Web Crypto API */
async function hashContent(content: string): Promise<string> {
	const data = new TextEncoder().encode(content);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Generate a short unique ID */
function generateId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Split text into chunks at natural boundaries. Delegates to the shared
 * heading-aware, fence-safe `splitMarkdown` (also used by the docs-ingestion
 * script) — headings become section boundaries and code fences stay atomic,
 * degrading to plain paragraph+size splitting for non-markdown sources.
 */
function splitAtBoundaries(text: string, targetTokens: number, overlapTokens: number): string[] {
	return splitMarkdown(text, { targetTokens, overlapTokens });
}

/**
 * Chunk a document into hierarchical parent (section) and child (paragraph) chunks.
 * Returns both levels with parent-child references.
 */
export async function chunkDocument(content: string): Promise<{
	parents: RawChunk[];
	children: RawChunk[];
}> {
	const parents: RawChunk[] = [];
	const children: RawChunk[] = [];

	// Split into section-level chunks (parents)
	const sections = splitAtBoundaries(content, SECTION_CHUNK_TARGET, 0);

	for (let si = 0; si < sections.length; si++) {
		const sectionText = sections[si];
		const parentId = generateId('chk');
		const parentHash = await hashContent(sectionText);

		parents.push({
			id: parentId,
			content: sectionText,
			level: 'section',
			position: si,
			tokenCount: estimateTokens(sectionText),
			contentHash: parentHash,
		});

		// Split section into paragraph-level chunks (children)
		const paragraphs = splitAtBoundaries(sectionText, PARAGRAPH_CHUNK_TARGET, CHUNK_OVERLAP);

		for (let pi = 0; pi < paragraphs.length; pi++) {
			const paraText = paragraphs[pi];
			const childHash = await hashContent(paraText);

			children.push({
				id: generateId('chk'),
				content: paraText,
				level: 'paragraph',
				position: pi,
				tokenCount: estimateTokens(paraText),
				contentHash: childHash,
				parentId,
			});
		}
	}

	return { parents, children };
}
