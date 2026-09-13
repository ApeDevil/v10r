/**
 * desk_search_knowledge — the deskbot's READ-ONLY retrieval grounding tool (`desk:ask` scope).
 *
 * Semantic retrieval over the user's OWN ai_context desk files (the deskbot corpus), via
 * the shared retrieval kernel scoped to the caller's `userId`. Unlike the chatbot's
 * `search_project_docs` (system-owned docs), this searches the user's private desk content.
 *
 * `userId` is captured in the closure — the model cannot forge it. Read-only: returns no
 * `DeskEffect` and never mutates. Results are reference context, not instructions. The
 * hits also go to the turn's desk sink, so the trace records them as grounding items the
 * model had in front of it.
 */
import { tool } from 'ai';
import * as v from 'valibot';
import { attributeDeskHits, retrieveDeskDocs } from '$lib/server/ai/deskbot-retrieval';
import type { SurfacedDeskChunk } from '../profile/profile';
import { cancelledBefore } from './cancelled';
import { toolInputSchema } from './desk-mutation-inputs';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

export interface DeskSink {
	record(chunks: SurfacedDeskChunk[], toolCallId?: string): void;
}

export function createAskTools(userId: string, sink?: DeskSink) {
	return {
		desk_search_knowledge: tool({
			description:
				'Semantic search over the user’s own AI-context desk files (markdown + spreadsheets). ' +
				'Use to ground an answer or action in what the user has written — facts, figures, notes ' +
				'across files. Each hit names its fileId (open or read it with desk_read_file), when the ' +
				'indexed copy was made, and stale=true when the file changed since — then read the file ' +
				'for the current text before acting. Read-only.',
			inputSchema: toolInputSchema(
				v.object({
					query: v.pipe(
						v.string(),
						v.minLength(1),
						v.maxLength(500),
						v.description('What to look for across the user’s desk files.'),
					),
				}),
			),
			execute: async ({ query }, { abortSignal, toolCallId }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const result = await retrieveDeskDocs(userId, query);
					if (result.chunks.length === 0) {
						return { chunks: [], note: 'No matching content in the user’s AI-context desk files.' };
					}
					const hits = await attributeDeskHits(userId, result.chunks);
					sink?.record(
						result.chunks.map((chunk, i) => ({
							chunk,
							fileId: hits[i]?.fileId ?? null,
							stale: hits[i]?.stale ?? false,
						})),
						toolCallId,
					);
					return { chunks: hits };
				} catch {
					return { error: 'Desk knowledge search failed.' };
				}
			},
		}),
	};
}
