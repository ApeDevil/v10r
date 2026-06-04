/**
 * nRAG pipeline topology — a hand-authored mirror of the chatbot read path in
 * `src/lib/server/ai/chat-orchestrator.ts` (the `useLlmwiki` branch). It depicts
 * CONTROL FLOW, not a data structure, so it can't be derived from the registry —
 * keep it in sync when the orchestrator's retrieval flow changes.
 *
 * Client-safe: pure constants, no server imports.
 */

export type LayerId = 'llmwiki' | 'rawrag' | 'catalog' | 'docs';

export interface NragLayer {
	id: LayerId;
	label: string;
	role: string;
	store: string;
}

/** The four stores the chatbot retrieves from. Counts are supplied live by the loader. */
export const NRAG_LAYERS: NragLayer[] = [
	{
		id: 'llmwiki',
		label: 'llmwiki',
		role: 'Primary answer surface — LLM-compiled wiki pages',
		store: 'rag.llmwiki_page',
	},
	{
		id: 'rawrag',
		label: 'rawrag',
		role: 'Immutable source chunks — drill-down & ground truth',
		store: 'rag.chunk · pgvector 1536 + BM25',
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
		store: "rag.document · source='docs'",
	},
];

export interface ReadStep {
	n: number;
	label: string;
	detail: string;
}

/** The chat hot path, with the real constants from llmwiki/config.ts + the orchestrator. */
export const NRAG_READ_PATH: ReadStep[] = [
	{ n: 1, label: 'Overview', detail: 'Load the top-level llmwiki overview page (~500 tok) into the system prompt.' },
	{ n: 2, label: 'Wiki search', detail: 'Hybrid vector + BM25 over title / tldr / tags, fused with RRF → top hits.' },
	{ n: 3, label: 'Hydrate pointers', detail: 'JOIN each hit to its source chunks, capped at POINTER_CAP = 5.' },
	{ n: 4, label: 'Generate', detail: 'streamText answers from TLDRs; stopWhen stepCountIs(3).' },
	{
		n: 5,
		label: 'Drill (on demand)',
		detail: 'get_rawrag_chunks fetches exact source — verbatim-id rule, max 3 / turn.',
	},
	{ n: 6, label: 'Ground', detail: 'search_catalog + search_project_docs surface canonical paths → CatalogSink.' },
	{ n: 7, label: 'Verify', detail: 'verifyCitations tags each chunk quote / paraphrase / drifted / uncited.' },
];

export interface ScaffoldStage {
	label: string;
	detail: string;
}

/** Documented but not yet live (COMPILE_SCAFFOLD / LINT_SCAFFOLD). */
export const NRAG_SCAFFOLD: ScaffoldStage[] = [
	{ label: 'compile', detail: 'llmwiki page compilation jobs — not yet wired.' },
	{ label: 'lint', detail: 'wiki lint runner: broken links, stale TLDRs, compile drift — not yet wired.' },
];
