/**
 * desk-ask — semantic search over the user's own AI-context desk files
 * (`desk_search_knowledge`): the deskbot's retrieval profile over the `desk` corpus.
 * Granted by `desk:ask`; read-only, so it never counts toward the mutation step budget
 * nor triggers the plan rule. The hits the tool put in front of the model join the trace
 * as the `desk` source's executed items once the answer is in, each naming the tool call
 * that surfaced it.
 */
import { DESK_SEARCH_MAX_CHUNKS } from '$lib/server/ai/deskbot-retrieval';
import type { GroundingItem } from '$lib/types/turn-trace';
import { type AssistantCapability, deskSink } from '../profile/profile';
import { createAskTools } from '../tools/desk-ask';
import { chunkPlace } from './chunk-place';
import { deskScopeActivation } from './desk-scope';

const askScope = deskScopeActivation('desk:ask');

export const deskAsk: AssistantCapability = {
	id: 'desk-ask',
	when: 'the desk:ask scope is granted and at least one AI-context desk file is indexed',
	scope: {
		id: 'desk:ask',
		description: 'ask: Semantic search over the user’s own AI-context desk files (read-only grounding)',
	},
	guidance:
		'When the user asks something that may be answered by their notes/files across the workspace (not just open panels), call desk_search_knowledge to ground your answer in their own AI-context files.',
	sources: ['desk'],
	// A search over nothing is not a capability: with no AI-context file the tool leaves the
	// list (`empty_corpus`), and while the desk sync is still embedding one it waits
	// (`indexing`) — both readable on the trace as the source's skip reason.
	activates: (turn) => {
		const scoped = askScope(turn);
		if (!scoped.active) return scoped;
		if (turn.deskCorpus === 'none') return { active: false, reason: 'empty_corpus' };
		if (turn.deskCorpus === 'indexing') return { active: false, reason: 'indexing' };
		return scoped;
	},
	tools: (turn, state) => createAskTools(turn.userId, deskSink(state)),
	// The tool is the lane: the model decides whether to search, so the source is written
	// after the answer, from what the tool actually surfaced. A tool never called leaves
	// the source unrecorded — nothing was considered.
	verify: async (_answer, _turn, state) => {
		if (state.surfacedDesk.size === 0) return { citations: [] };
		// The file id and the stale flag stay on the tool's output, where the model read them;
		// the item is the chunk the reader resolves by id.
		const items = [...state.surfacedDesk.values()].map(
			({ chunk, toolCallId }, rank): GroundingItem => ({
				id: chunk.chunkId,
				kind: 'chunk',
				documentId: chunk.documentId,
				title: chunk.documentTitle,
				score: chunk.score,
				rank,
				state: 'executed',
				chars: chunk.content.length,
				...chunkPlace(chunk),
				...(toolCallId ? { toolCallId } : {}),
			}),
		);
		return { citations: [], grounding: [{ id: 'desk', ran: true, cutoff: DESK_SEARCH_MAX_CHUNKS, items }] };
	},
};
