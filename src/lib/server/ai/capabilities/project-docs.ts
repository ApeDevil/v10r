/**
 * project-docs — the system-owned documentation corpus: a relevance-gated prefetch into
 * `<retrieval-context>` before generation, and `search_project_docs` for a different topic.
 *
 * The prefetch is what grounds the "v10r expert" in the documentation on every real
 * question. It is gated on relevance (not always-on): trivial turns — greetings,
 * acks, very short messages — spend no embedding and no retrieval. The candidate pool is
 * wider than the prompt's cutoff so the trace shows what ranked below it from the actual
 * run; rank order is the choice order, so the prefix the prompt takes is the same at any
 * pool size. The retrieval is handed to the tool as its seed, so a call that asks the
 * same question again is answered without a second embedding.
 */
import { contextChunkCut, formatContextForPrompt, type RetrievalResult, retrieve } from '$lib/server/retrieval';
import { SYSTEM_DOCS_USER_ID } from '$lib/server/retrieval/config';
import type { GroundingItem } from '$lib/types/turn-trace';
import {
	type AssistantCapability,
	catalogSink,
	describeError,
	type TurnInput,
	type TurnState,
} from '../profile/profile';
import { createSearchDocsTool } from '../tools/search-docs';
import { chunkPlace } from './chunk-place';
import { pageSeededQuery } from './site-awareness';

/** Production system-docs retrieval profile for a chatbot turn. */
export const SYSTEM_DOCS_TIERS: (1 | 2 | 3)[] = [1];
export const SYSTEM_DOCS_MAX_CHUNKS = 4;
/**
 * Candidates the docs retrieval returns per turn — wider than the prompt's cutoff so the
 * turn trace shows what ranked below it from the actual run, not from a second one.
 */
export const SYSTEM_DOCS_CANDIDATE_POOL = 12;

/**
 * Relevance gate for the chatbot's system-docs prefetch. The chatbot is always about v10r,
 * so the system-owned docs corpus is prefetched by default — but not on greetings, acks or
 * very short messages, where an embedding + retrieval round trip would ground nothing.
 */
export function shouldGroundFromSystemDocs(text: string): boolean {
	const t = text.trim();
	if (t.length < 12) return false;
	if (/^(hi|hey|hello|yo|thanks|thank you|ty|ok|okay|k|yes|no|sure|cool|nice|great|lol|hm+)\b[\s!.?]*$/i.test(t)) {
		return false;
	}
	return true;
}

/** The embed query: page-seeded when the deixis rule fired, the bare message otherwise. */
export function docsQueryOf(turn: TurnInput, state: TurnState): string {
	return turn.pageContext && state.activations.get('site-awareness')?.active
		? pageSeededQuery(turn.pageContext, turn.userMsgText)
		: turn.userMsgText;
}

export const projectDocs: AssistantCapability = {
	id: 'project-docs',
	when: 'always for the chatbot; the prefetch runs when the message is a real question, not a greeting or an acknowledgement',
	guidance: `Passages retrieved from the project's OWN documentation for the user's question arrive in a <retrieval-context> block — treat them as authoritative for how and why v10r is built. When that block is present, the documentation was already searched for this question: call \`search_project_docs\` only for a different topic. When you cite a /docs path or link, surface it via \`search_catalog\` first (never invent paths).`,
	sources: ['project-docs'],
	// The tool mounts on every tool-bearing turn; only a tool-less trivial turn has nothing here.
	activates: (turn) =>
		turn.hasTools || shouldGroundFromSystemDocs(turn.userMsgText)
			? { active: true }
			: { active: false, reason: 'trivial' },
	grounding: async (turn, state) => {
		const pool = SYSTEM_DOCS_CANDIDATE_POOL;
		const cutoff = SYSTEM_DOCS_MAX_CHUNKS;
		if (!shouldGroundFromSystemDocs(turn.userMsgText)) {
			return {
				source: { id: 'project-docs', ran: false, skippedReason: 'trivial', pool, cutoff, items: [] },
				blocks: [],
			};
		}
		const query = docsQueryOf(turn, state);
		const options = { userId: SYSTEM_DOCS_USER_ID, tiers: SYSTEM_DOCS_TIERS, maxChunks: pool };
		let result: RetrievalResult;
		try {
			// The bare question reuses the turn's shared vector; a page-seeded query embeds its own
			// (the rare deixis case — the same two-embed cost as before).
			result =
				query === turn.userMsgText
					? await retrieve(query, { ...options, queryEmbedding: await state.queryEmbedding() })
					: await retrieve(query, { ...options, embeddingConnection: turn.embeddingConnection });
		} catch (err) {
			return {
				source: { id: 'project-docs', ran: false, error: describeError(err), pool, cutoff, items: [] },
				blocks: [],
			};
		}
		// The prompt takes the top `cutoff` of the pool, then the size cap may cut further; every
		// candidate is recorded with why it stayed out.
		const ranked = { ...result, chunks: result.chunks.slice(0, cutoff) };
		const cut = contextChunkCut(ranked);
		const blocks =
			cut > 0
				? [
						{
							id: 'retrieval-context' as const,
							section: 'grounding' as const,
							text: `<retrieval-context>\n${formatContextForPrompt(ranked)}\n</retrieval-context>`,
							stable: false,
						},
					]
				: [];
		state.docsSeed = { query: turn.userMsgText, result };
		return {
			source: {
				id: 'project-docs',
				ran: true,
				pool,
				cutoff,
				retrievers: result.tierUsed.map((tier) => `tier-${tier}` as const),
				items: result.chunks.map((c, rank): GroundingItem => {
					const included = rank < cut;
					return {
						id: c.chunkId,
						kind: 'chunk',
						documentId: c.documentId,
						title: c.documentTitle,
						score: Math.round(c.score * 1000) / 1000,
						rank,
						state: included ? 'included' : 'considered',
						chars: c.content.length,
						...chunkPlace(c),
						...(included
							? { blockId: 'retrieval-context' as const }
							: { omittedReason: rank < cutoff ? ('size_cap' as const) : ('below_cutoff' as const) }),
					};
				}),
			},
			blocks,
		};
	},
	tools: (turn, state) =>
		createSearchDocsTool(turn.locale, catalogSink(state, 'project-docs'), {
			embeddingConnection: turn.embeddingConnection,
			seed: state.docsSeed,
		}),
};
