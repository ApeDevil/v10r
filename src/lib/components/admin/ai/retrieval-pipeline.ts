/**
 * Retrieval pipeline topology — a hand-authored mirror of the chatbot read path in
 * `src/lib/server/ai/chat-orchestrator.ts` (the `chatbot` surface branch). It depicts
 * CONTROL FLOW, not a data structure, so it can't be derived from the registry —
 * keep it in sync when the orchestrator's retrieval flow changes.
 *
 * Client-safe: pure constants, no server imports.
 *
 * The CORPUS axis (`RetrievalCorpus`/`RETRIEVAL_CORPORA`) lives in the shared
 * `$lib/types/retrieval-corpora.ts` so this admin diagram and the rag-chat observability
 * surface consume one taxonomy. Re-exported here for existing call sites.
 */

export { RETRIEVAL_CORPORA, type RetrievalCorpus, type RetrievalCorpusId } from '$lib/types/retrieval-corpora';

export interface ReadStep {
	n: number;
	label: string;
	detail: string;
}

/** The chat hot path, with the real constants from llmwiki/config.ts + the orchestrator. */
export const RETRIEVAL_READ_PATH: ReadStep[] = [
	{ n: 1, label: 'Overview', detail: 'Load the top-level llmwiki overview page (~500 tok) into the system prompt.' },
	{ n: 2, label: 'Wiki search', detail: 'Hybrid vector + BM25 over title / tldr / tags, fused with RRF → top hits.' },
	{ n: 3, label: 'Hydrate pointers', detail: 'JOIN each hit to its source chunks, capped at POINTER_CAP = 5.' },
	{ n: 4, label: 'Generate', detail: 'streamText answers from TLDRs; stopWhen stepCountIs(3).' },
	{
		n: 5,
		label: 'Drill (on demand)',
		detail: 'get_source_chunks fetches exact source — verbatim-id rule, max 3 / turn.',
	},
	{
		n: 6,
		label: 'Ground',
		detail: 'search_catalog + search_project_docs + search_pattern_library surface canonical paths → CatalogSink.',
	},
	{ n: 7, label: 'Verify', detail: 'verifyCitations tags each chunk quote / paraphrase / drifted / uncited.' },
];
