/**
 * plan — the pure, dependency-free chunk planner shared by the in-app retrieval ingest
 * (`chunk.ts`) and the standalone docs-ingestion Bun script (`scripts/db/ingest-docs.ts`).
 *
 * It MUST stay dependency-free — no `$lib`, no `$env`, no `import.meta` — because the
 * Bun script imports it by relative path and cannot resolve Vite aliases. All tuning
 * (section/paragraph targets, overlap) arrives via `PlanOptions`, never from a config
 * import — `./config` pulls the `$lib`-aliased retrieval policy, which is exactly what
 * would re-break the Bun import, so DO NOT add it. Mirrors `markdown-split.ts`;
 * `../db/content-hash` is reached the same way and is dependency-free for the same reason.
 */
import { contentHash } from '../db/content-hash';
import { splitMarkdown } from './markdown-split';
import type { RawChunk } from './types';

export interface PlanOptions {
	/** Section-level (parent) chunk target, approximate tokens. */
	sectionTarget: number;
	/** Paragraph-level (child) chunk target, approximate tokens. */
	paragraphTarget: number;
	/** Token overlap carried between adjacent child chunks. */
	overlap: number;
}

/** Rough token count estimate: ~4 chars per token for English text. */
function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

/** Generate a short unique ID. */
function generateId(prefix: string): string {
	return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
}

/**
 * Plan a document into hierarchical parent (section) and child (paragraph) chunks
 * with parent-child references. Pure: no I/O, no embeddings, no persistence.
 */
export async function planChunks(
	content: string,
	{ sectionTarget, paragraphTarget, overlap }: PlanOptions,
): Promise<{ parents: RawChunk[]; children: RawChunk[] }> {
	const parents: RawChunk[] = [];
	const children: RawChunk[] = [];

	// Split into section-level chunks (parents).
	const sections = splitMarkdown(content, { targetTokens: sectionTarget, overlapTokens: 0 });

	for (let si = 0; si < sections.length; si++) {
		const sectionText = sections[si];
		const parentId = generateId('chk');
		const parentHash = await contentHash(sectionText);

		parents.push({
			id: parentId,
			content: sectionText,
			level: 'section',
			position: si,
			tokenCount: estimateTokens(sectionText),
			contentHash: parentHash,
		});

		// Split each section into paragraph-level chunks (children).
		const paragraphs = splitMarkdown(sectionText, { targetTokens: paragraphTarget, overlapTokens: overlap });

		for (let pi = 0; pi < paragraphs.length; pi++) {
			const paraText = paragraphs[pi];
			const childHash = await contentHash(paraText);

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
