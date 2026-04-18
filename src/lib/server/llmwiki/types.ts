/**
 * Shared types for the llmwiki layer.
 *
 * LlmwikiHit  — what search returns for a single page (TOON-encoded into
 *               the chat system prompt).
 * LlmwikiPointer — link back to a rawrag chunk, hydrated from
 *               llmwiki_page_source for each hit (capped at POINTER_CAP).
 * LlmwikiPage — full page with body; returned by get_llmwiki_pages when
 *               the model asks for detail.
 */

export interface LlmwikiPointer {
	chunkId: string;
	documentId: string;
	documentTitle: string;
	weight: number;
}

export interface LlmwikiCoverage {
	sourceCount: number;
	stale: boolean;
}

export interface LlmwikiHit {
	slug: string;
	title: string;
	tldr: string;
	tags: string[];
	coverage: LlmwikiCoverage;
	pointers: LlmwikiPointer[];
}

export interface LlmwikiPage extends LlmwikiHit {
	body: string;
	compiledAt: string;
	compiledByModel: string;
}

/** Options for llmwiki search. */
export interface LlmwikiSearchOptions {
	userId: string;
	collectionId?: string | null;
	limit?: number;
	pointerCap?: number;
}

/**
 * Result of post-hoc verification.
 *   'none'        — chunk was not drilled (no raw fetch happened)
 *   'uncited'     — drilled chunk is not cited by any wiki page (no row in llmwiki_page_source)
 *   'drifted'     — cited, but chunk.content_hash has changed since compile
 *   'paraphrase'  — cited, hash matches — answer paraphrases the source
 *   'quote'       — hash matches AND answer contains a verbatim snippet
 */
export type LlmwikiCitationVerification = 'none' | 'uncited' | 'drifted' | 'paraphrase' | 'quote';

export interface LlmwikiCitation {
	ordinal: number;
	pageSlug: string;
	chunkId: string | null;
	compiledAt: string;
	sourceUpdatedAt: string;
	verification: LlmwikiCitationVerification;
	tier: 'llmwiki' | 'rawrag';
}
