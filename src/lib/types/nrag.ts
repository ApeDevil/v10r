/**
 * nRAG store axis — the four corpora the chatbot retrieves from.
 *
 * This is the STORE axis (which corpus a chunk came from), orthogonal to the
 * STAGE axis (`NragPhase`) and the LANE axis (`RetrieverLane`) in `pipeline.ts`.
 * Homed here as client-safe pure constants so BOTH the admin nRAG diagram
 * (`components/admin/ai/nrag-pipeline.ts`) and the rag-chat observability surface
 * import one taxonomy and can't drift.
 */

export type NragLayerId = 'llmwiki' | 'rawrag' | 'catalog' | 'docs';

export interface NragLayer {
	id: NragLayerId;
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
