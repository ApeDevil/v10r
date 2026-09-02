/**
 * Retrieval CORPUS axis — the four corpora the chatbot retrieves from.
 *
 * Orthogonal to the STAGE axis (`RetrievalPhase`) and the PATH axis (`RetrieverId`) in
 * `retrieval-trace.ts`. Client-safe pure constants, so the admin pipeline diagram and the AI
 * showcase read one taxonomy and cannot drift.
 */

export type RetrievalCorpusId = 'llmwiki' | 'chunks' | 'catalog' | 'docs';

export interface RetrievalCorpus {
	id: RetrievalCorpusId;
	label: string;
	role: string;
	store: string;
}

/** The four stores the chatbot retrieves from. Counts are supplied live by the loader. */
export const RETRIEVAL_CORPORA: RetrievalCorpus[] = [
	{
		id: 'llmwiki',
		label: 'llmwiki',
		role: 'Primary answer surface — LLM-compiled wiki pages',
		store: 'retrieval.llmwiki_page',
	},
	{
		id: 'chunks',
		label: 'chunks',
		role: 'Immutable source chunks — drill-down & ground truth',
		store: 'retrieval.chunk · pgvector 1536 + BM25',
	},
	{
		id: 'catalog',
		label: 'catalog',
		role: 'In-process ⌘K search surface — canonical paths',
		store: 'in-memory index',
	},
	{
		id: 'docs',
		label: 'docs',
		role: 'System-owned project-docs corpus',
		store: "retrieval.document · source='docs'",
	},
];
