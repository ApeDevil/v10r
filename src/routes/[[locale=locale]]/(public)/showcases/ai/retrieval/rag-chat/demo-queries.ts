export interface DemoQuery {
	query: string;
	why: string;
}

/**
 * Curated starter queries per ENGINE (Hybrid tiers ⟷ LLM Wiki). Each is chosen to make the
 * engine's mechanism visibly win so a newcomer can form intuition. Copy is placeholder-grade
 * (→ cony refines + translates).
 */
export const DEMO_QUERIES: { hybrid: DemoQuery[]; llmwiki: DemoQuery[] } = {
	hybrid: [
		{ query: 'How do I avoid the model making things up?', why: 'paraphrases "hallucination mitigation"' },
		{ query: 'What is the setup for the database connection?', why: 'plain-language lookup' },
		{ query: 'How are parents different from children?', why: 'small-to-big: tiny match, big context' },
		{ query: 'What entities are related to SvelteKit?', why: 'entity-graph neighborhood' },
		{ query: 'Walk me through a full query lifecycle', why: 'ambiguous — all three lanes contribute' },
	],
	llmwiki: [
		{ query: 'Give me an overview of the retrieval system', why: 'answers straight from a compiled TLDR' },
		{ query: 'What does the ingestion pipeline do?', why: 'page-level summary, no drill needed' },
		{ query: 'Quote the exact default for chunk size', why: 'forces a drill-down to raw source' },
		{ query: 'How does citation verification work?', why: 'shows the verify pass + verdicts' },
		{ query: 'Compare hybrid retrieval to the wiki path', why: 'multi-page synthesis' },
	],
};
