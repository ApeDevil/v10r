/**
 * project-map — the corpus map of the project docs, injected on every chatbot turn.
 *
 * The one `retrieval.corpus_map` row `scripts/db/ingest-docs.ts` writes for the system
 * corpus: the model's (and the inspector's) representation of what the documentation covers
 * without loading it — a DB read that grounds broad questions ("what is v10r?") with the
 * embedding quota exhausted. Static per locale, so it sits in the cache-stable prefix.
 */
import { getCorpusMap } from '$lib/server/db/retrieval/queries';
import { PROJECT_DOCS_COLLECTION_ID, SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import { PROJECT_MAP_MAX_CHARS } from '../config';
import type { AssistantCapability } from '../profile/profile';

/** The map as loaded for a prompt, and where the budget cut its body (null = whole). */
export interface LoadedProjectMap {
	id: string;
	title: string;
	body: string;
	truncatedAt: number | null;
}

/** Load the project docs corpus map, cut to the prompt budget; null when no map exists. */
export async function loadProjectMap(): Promise<LoadedProjectMap | null> {
	const map = await getCorpusMap([SYSTEM_DOCS_USER_ID], PROJECT_DOCS_COLLECTION_ID);
	if (!map) return null;
	if (map.body.length > PROJECT_MAP_MAX_CHARS) {
		return {
			id: map.id,
			title: map.title,
			body: `${map.body.slice(0, PROJECT_MAP_MAX_CHARS)}…`,
			truncatedAt: PROJECT_MAP_MAX_CHARS,
		};
	}
	return { id: map.id, title: map.title, body: map.body, truncatedAt: null };
}

export const projectMap: AssistantCapability = {
	id: 'project-map',
	when: 'always — the system corpus has a map',
	guidance:
		'A <project-overview> block is the canonical high-level map of v10r (a full-stack reference & test-sandbox). Use it to orient broad questions like "what is v10r" or "how do I use it"; ground specifics from the retrieved documentation and the catalog.',
	sources: ['project-map'],
	activates: () => ({ active: true }),
	grounding: async () => {
		const map = await loadProjectMap();
		if (!map) {
			return {
				source: { id: 'project-map', ran: false, skippedReason: 'empty_corpus', items: [] },
				blocks: [],
				activation: { active: false, reason: 'empty_corpus' },
			};
		}
		return {
			source: {
				id: 'project-map',
				ran: true,
				items: [
					{
						id: map.id,
						kind: 'map',
						title: map.title,
						rank: 0,
						state: 'included',
						chars: map.body.length,
						blockId: 'project-overview',
					},
				],
				...(map.truncatedAt !== null ? { truncatedAt: map.truncatedAt } : {}),
			},
			blocks: [
				{
					id: 'project-overview',
					section: 'grounding',
					text: `<project-overview>\n${map.title}\n\n${map.body}\n</project-overview>`,
					stable: true,
				},
			],
		};
	},
};
