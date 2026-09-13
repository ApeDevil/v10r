/**
 * Retrieval pipeline topology — a hand-authored mirror of the chatbot read path:
 * `CHATBOT_PROFILE` (`src/lib/server/ai/profile/chatbot.ts`) composed by `composeTurn`.
 * It depicts CONTROL FLOW, not a data structure, so it can't be derived from the
 * registry — keep it in sync when the profile's capabilities change.
 *
 * Client-safe: pure constants, no server imports.
 *
 * The CORPUS axis (`RetrievalCorpus`/`RETRIEVAL_CORPORA`) lives in the shared
 * `$lib/types/retrieval-corpora.ts` so this admin diagram and the AI showcase consume one
 * taxonomy. Re-exported here for existing call sites.
 */

export { RETRIEVAL_CORPORA, type RetrievalCorpus, type RetrievalCorpusId } from '$lib/types/retrieval-corpora';

export interface ReadStep {
	n: number;
	label: string;
	detail: string;
}

/** The chatbot read path — `CHATBOT_PROFILE`'s capabilities in the order a turn runs them. */
export const RETRIEVAL_READ_PATH: ReadStep[] = [
	{
		n: 1,
		label: 'Map',
		detail: 'Load the project docs corpus map (retrieval.corpus_map) into the system prompt as <project-overview>.',
	},
	{
		n: 2,
		label: 'Ground',
		detail:
			'Embed the question once; tier-1 retrieve() over the docs corpus in parallel with the catalog lane → <retrieval-context> and, on a "where is…" question, <catalog-results>.',
	},
	{
		n: 3,
		label: 'Generate',
		detail:
			'streamText with search_project_docs, search_catalog and search_pattern_library mounted; the last budgeted step answers tool-less.',
	},
	{
		n: 4,
		label: 'Verify',
		detail:
			'Each path the answer names is matched against the rows the turn surfaced — cited, or unsurfaced when nothing backed it.',
	},
	{
		n: 5,
		label: 'Record',
		detail: 'The turn trace persists blocks, grounding, model calls, tool executions and citations.',
	},
];
