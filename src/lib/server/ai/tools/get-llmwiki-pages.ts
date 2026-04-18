/**
 * get_llmwiki_pages — model expands selected llmwiki pages by ID.
 * The model discovers IDs from the overview + hits that arrive in the
 * system prompt; it can request full bodies when a TLDR isn't enough.
 *
 * User is captured in closure — the model cannot forge it.
 */

import { jsonSchema, tool } from 'ai';
import { MAX_LLMWIKI_TOOL_IDS } from '$lib/server/llmwiki/config';
import { fetchPagesByIds } from '$lib/server/llmwiki/queries';
import type { DeskToolMeta } from './_types';

export const llmwikiPagesToolMeta: Record<string, DeskToolMeta> = {
	get_llmwiki_pages: { risk: 'read', scope: 'desk:read' },
};

interface ToolInput {
	ids: string[];
	include_body: boolean;
}

export function createGetLlmwikiPagesTool(userId: string) {
	return {
		get_llmwiki_pages: tool({
			description:
				'Expand one or more llmwiki pages by slug. ' +
				'Use this when a TLDR in the llmwiki-hits block is not enough and you need the full page body. ' +
				'Do not use for drill-down into raw source — use get_rawrag_chunks for that.',
			inputSchema: jsonSchema<ToolInput>({
				type: 'object',
				properties: {
					ids: {
						type: 'array',
						items: { type: 'string', description: 'llmwiki page slug or id' },
						minItems: 1,
						maxItems: MAX_LLMWIKI_TOOL_IDS,
						description: 'Page ids or slugs to expand.',
					},
					include_body: {
						type: 'boolean',
						description: 'When true, return the full body; otherwise only TLDR and pointers.',
					},
				},
				required: ['ids', 'include_body'],
			}),
			execute: async ({ ids, include_body }) => {
				if (!Array.isArray(ids) || ids.length === 0) {
					return { pages: [], error: 'ids must be a non-empty array' };
				}
				const bounded = ids.slice(0, MAX_LLMWIKI_TOOL_IDS);
				const pages = await fetchPagesByIds(bounded, userId, { includeBody: Boolean(include_body) });
				return {
					pages: Array.from(pages.values()),
					missing: bounded.filter((id) => !pages.has(id)),
				};
			},
		}),
	};
}
