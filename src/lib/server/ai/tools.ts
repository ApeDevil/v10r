/**
 * AI tool definitions for Desk operations.
 *
 * Client-executed tools have NO execute() function — when the LLM calls them,
 * the AI SDK streams the tool call to the client, which handles it via onToolCall
 * and resumes with addToolResult().
 *
 * Uses jsonSchema() from the ai package to define parameters without requiring zod.
 */

import { jsonSchema, tool } from 'ai';

// ── Tool definitions (client-executed — no execute function) ─────────

export const DESK_TOOLS = {
	spreadsheet_setCell: tool({
		description:
			'Set a single spreadsheet cell value. Use A1 notation for the cell reference.',
		parameters: jsonSchema({
			type: 'object' as const,
			properties: {
				cell: {
					type: 'string',
					pattern: '^[A-Z]{1,2}[1-9]\\d{0,3}$',
					description: 'Cell reference in A1 notation, e.g. "A1", "B12"',
				},
				value: {
					oneOf: [{ type: 'string' }, { type: 'number' }],
					description: 'The value to set',
				},
			},
			required: ['cell', 'value'],
			additionalProperties: false,
		}),
		// No execute — client-side execution via onToolCall
	}),

	spreadsheet_setRange: tool({
		description:
			'Set multiple spreadsheet cells at once. Provide an array of cell-value pairs.',
		parameters: jsonSchema({
			type: 'object' as const,
			properties: {
				cells: {
					type: 'array',
					items: {
						type: 'object',
						properties: {
							cell: {
								type: 'string',
								pattern: '^[A-Z]{1,2}[1-9]\\d{0,3}$',
								description: 'Cell reference in A1 notation',
							},
							value: {
								oneOf: [{ type: 'string' }, { type: 'number' }],
								description: 'The value to set',
							},
						},
						required: ['cell', 'value'],
						additionalProperties: false,
					},
					maxItems: 50,
					description: 'Array of {cell, value} pairs',
				},
			},
			required: ['cells'],
			additionalProperties: false,
		}),
	}),
} as const;

// ── Tool resolution ─────────────────────────────────────────────────

/** All valid tool names */
export const TOOL_ALLOWLIST = new Set(Object.keys(DESK_TOOLS));

/** Given a list of requested tool names, return the matching tool definitions.
 *  Returns undefined if no valid tools match. */
export function resolveTools(
	requestedNames: string[],
): Record<string, (typeof DESK_TOOLS)[keyof typeof DESK_TOOLS]> | undefined {
	const resolved: Record<string, (typeof DESK_TOOLS)[keyof typeof DESK_TOOLS]> = {};
	for (const name of requestedNames) {
		if (name in DESK_TOOLS) {
			resolved[name] = DESK_TOOLS[name as keyof typeof DESK_TOOLS];
		}
	}
	return Object.keys(resolved).length > 0 ? resolved : undefined;
}
