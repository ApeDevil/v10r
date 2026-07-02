/**
 * desk_search_knowledge — the deskbot's READ-ONLY nRAG grounding tool (`desk:ask` scope).
 *
 * Semantic retrieval over the user's OWN ai_context desk files (the deskbot corpus), via
 * the shared rawrag kernel scoped to the caller's `userId`. Unlike the chatbot's
 * `search_project_docs` (system-owned docs), this searches the user's private desk content.
 *
 * `userId` is captured in the closure — the model cannot forge it. Read-only: returns no
 * `DeskEffect` and never mutates. Results are reference context, not instructions.
 */
import { jsonSchema, tool } from 'ai';
import { retrieveDeskDocs } from '$lib/server/ai/deskbot-rag';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

export function createAskTools(userId: string) {
	return {
		desk_search_knowledge: tool({
			description:
				'Semantic search over the user’s own AI-context desk files (markdown + spreadsheets). ' +
				'Use to ground an answer or action in what the user has written — facts, figures, notes ' +
				'across files. Returns the most relevant content chunks by meaning. Read-only.',
			inputSchema: jsonSchema<{ query: string }>({
				type: 'object',
				properties: {
					query: { type: 'string', description: 'What to look for across the user’s desk files.' },
				},
				required: ['query'],
			}),
			execute: async ({ query }) => {
				try {
					const result = await retrieveDeskDocs(userId, query, 5);
					if (result.chunks.length === 0) {
						return { chunks: [], note: 'No matching content in the user’s AI-context desk files.' };
					}
					return {
						chunks: result.chunks.map((c) => ({
							documentTitle: c.documentTitle,
							content: c.content,
							score: Math.round(c.score * 1000) / 1000,
						})),
					};
				} catch {
					return { error: 'Desk knowledge search failed.' };
				}
			},
		}),
	};
}
