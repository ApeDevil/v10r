/**
 * `resolve_ref` — retrieve a full tool result previously compacted away.
 *
 * When a prior tool call returned an oversized result, the compactor
 * replaces it with `{ ref, summary, truncated, originalBytes, hint }` in
 * the model's view. This tool lets the model pull the full value back
 * on demand — a pressure-release valve for when the summary isn't enough.
 *
 * Always auto-registered; not gated by scope. See `loop/compact.ts`.
 */
import { jsonSchema, tool } from 'ai';
import { resolveRef } from '$lib/server/ai/loop/compact';

export function createResolveRefTool() {
	return {
		resolve_ref: tool({
			description:
				'Retrieve the full value behind a tool-result ref that was previously compacted. ' +
				'Use when a prior tool result returned { ref, summary, truncated: true } and you ' +
				'need the complete data that the summary elides. Pass the `ref` string verbatim.',
			inputSchema: jsonSchema<{ ref: string }>({
				type: 'object',
				properties: {
					ref: {
						type: 'string',
						description: 'The ref id from a prior compacted tool result (e.g. "tr_desk_read_file_0").',
					},
				},
				required: ['ref'],
			}),
			execute: async ({ ref }) => {
				const full = resolveRef(ref);
				if (full === undefined) {
					return {
						error: 'Unknown or expired ref. Refs only live for the current request.',
					};
				}
				return { ref, full };
			},
		}),
	};
}
