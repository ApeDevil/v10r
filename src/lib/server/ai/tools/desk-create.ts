/**
 * Desk create + delete tools.
 * Create: gated by 'desk:create' scope. Creates are reversible (soft-delete) so
 *   they mutate in-loop and are auto-approved.
 * Delete: gated by 'desk:delete' scope. Destructive, so it does NOT delete in-loop —
 *   it returns a `requiresApproval` sentinel and the orchestrator routes it through
 *   the server-verified proposal flow (createProposal → PlanCard → POST /approve).
 *   The actual delete runs only via the approve-route replay (`executeDeskToolCall`),
 *   which records a genuine `approvedBy`/`approvedAt` — replacing the old self-serve
 *   `confirmed=false → confirmed=true` handshake that the model could satisfy itself.
 */
import { jsonSchema, tool } from 'ai';
import { createMarkdownFile, createSpreadsheetFile } from '$lib/server/db/desk/mutations';
import { getFile } from '$lib/server/db/desk/queries';
import type { DeskEffect } from './_types';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

export function createCreateTools(userId: string) {
	return {
		desk_create_spreadsheet: tool({
			description:
				"Create a new spreadsheet on the user's desk. " +
				'Optionally provide initial cell data as an array of {cell, value} pairs.',
			inputSchema: jsonSchema<{
				name: string;
				cells: { cell: string; value: string | number | null }[];
			}>({
				type: 'object',
				properties: {
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 200,
						description: 'Name for the new spreadsheet.',
					},
					cells: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								cell: { type: 'string', description: 'Cell address like "A1".' },
								value: { description: 'Cell value.' },
							},
							required: ['cell', 'value'],
						},
						description: 'Initial cell data. Empty array for blank spreadsheet.',
					},
				},
				required: ['name', 'cells'],
			}),
			execute: async ({ name, cells }, { abortSignal: _abortSignal }) => {
				try {
					const cellMap: Record<string, unknown> = {};
					for (const { cell, value } of cells) {
						cellMap[cell] = { v: value };
					}

					const result = await createSpreadsheetFile(userId, name, cellMap);

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_explorer' },
						{
							type: 'desk:open_panel',
							panelType: 'spreadsheet',
							fileId: result.file.id,
							label: result.file.name,
						},
						{ type: 'desk:tab_indicator', fileId: result.file.id, panelType: 'spreadsheet', variant: 'created' },
					];

					return {
						created: true,
						fileId: result.file.id,
						name: result.file.name,
						effects,
					};
				} catch {
					return { error: 'Failed to create spreadsheet.' };
				}
			},
		}),

		desk_create_markdown: tool({
			description:
				"Create a new markdown document on the user's desk. " + 'Provide the file name and initial markdown content.',
			inputSchema: jsonSchema<{ name: string; content: string }>({
				type: 'object',
				properties: {
					name: {
						type: 'string',
						minLength: 1,
						maxLength: 200,
						description: 'Document name (e.g. "Meeting Notes", "Blog Draft").',
					},
					content: {
						type: 'string',
						maxLength: 50000,
						description: 'Initial markdown content.',
					},
				},
				required: ['name', 'content'],
			}),
			execute: async ({ name, content }, { abortSignal: _abortSignal }) => {
				try {
					const result = await createMarkdownFile(userId, name, content);

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_explorer' },
						{ type: 'desk:tab_indicator', fileId: result.file.id, panelType: 'markdown', variant: 'created' },
						{ type: 'desk:notify', message: `Created "${name}"`, level: 'success' },
					];

					return {
						created: true,
						fileId: result.file.id,
						name: result.file.name,
						effects,
					};
				} catch {
					return { error: 'Failed to create document.' };
				}
			},
		}),
	};
}

export function createDeleteTools(userId: string) {
	return {
		desk_delete_file: tool({
			description:
				"Delete a file from the user's desk. This is destructive and does NOT delete when you " +
				'call it — the deletion is queued for the user to approve first. Call it once with the ' +
				'target file id; the user then approves (or rejects) the deletion in the UI.',
			inputSchema: jsonSchema<{ file_id: string }>({
				type: 'object',
				properties: {
					file_id: { type: 'string', description: 'The file ID to delete.' },
				},
				required: ['file_id'],
			}),
			execute: async ({ file_id }, { abortSignal: _abortSignal }) => {
				try {
					const fileRow = await getFile(file_id, userId);
					if (!fileRow) return { error: 'File not found or not accessible.' };

					// HARD GATE: do not delete here. Signal the orchestrator to create a
					// pending proposal; the delete runs only via the approve-route replay
					// after a genuine, server-recorded user approval.
					return {
						requiresApproval: true,
						action: `Delete "${fileRow.name}"`,
						fileId: file_id,
						fileName: fileRow.name,
					};
				} catch {
					return { error: 'Failed to prepare deletion.' };
				}
			},
		}),
	};
}
