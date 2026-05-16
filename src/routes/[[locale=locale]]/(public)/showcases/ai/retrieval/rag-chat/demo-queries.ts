import type { RagMode } from './_components/ModeSelector.svelte';

export interface DemoQuery {
	query: string;
	why: string;
}

/**
 * 5 curated demo queries per mode. Each one is chosen to make the mode's
 * mechanism visibly win so a newcomer can form intuition.
 */
export const DEMO_QUERIES: Record<RagMode, DemoQuery[]> = {
	vector: [
		{ query: 'How do I avoid the model making things up?', why: 'paraphrases "hallucination mitigation"' },
		{ query: 'What is the setup for the database connection?', why: 'plain-language lookup' },
		{ query: 'Show me how to stream responses', why: 'keyword + semantic overlap' },
		{ query: 'What happens when rate limits kick in?', why: 'conceptual — benefits from embedding' },
		{ query: 'How is authentication handled?', why: 'BM25 catches exact terms' },
	],
	'small-to-big': [
		{ query: 'What is the default retry count?', why: 'precise fact inside a surrounding section' },
		{ query: 'Which config key controls chunk size?', why: 'one-line answer needs document context' },
		{ query: 'How are parents different from children?', why: 'payoff: small match, big context' },
		{ query: "What's the purpose of the context prefix?", why: 'narrow question, section-scoped answer' },
		{ query: 'Where is the embedding model defined?', why: 'code-reference style lookup' },
	],
	graph: [
		{ query: 'Who collaborated with whom on the Duck Society papers?', why: 'multi-hop relational walk' },
		{ query: 'What entities are related to SvelteKit?', why: 'entity neighborhood' },
		{ query: 'Show connections between Postgres and Neo4j', why: 'cross-entity relationships' },
		{ query: 'Which concepts mention retrieval and ranking together?', why: 'entity co-occurrence' },
		{ query: 'What links the ingestion pipeline to the graph store?', why: 'path-style query' },
	],
	fused: [
		{ query: 'How does RAG improve answer quality?', why: 'ambiguous — all three retrievers contribute' },
		{ query: 'Explain the difference between HNSW and BM25', why: 'needs vector + BM25 + conceptual context' },
		{ query: 'Walk me through a full query lifecycle', why: 'combines sequential facts with entity links' },
		{ query: 'What tradeoffs exist between tiers?', why: 'comparison benefits from fusion' },
		{ query: "Give me the high-level story of the project's data flow", why: 'broad, multi-source' },
	],
};
