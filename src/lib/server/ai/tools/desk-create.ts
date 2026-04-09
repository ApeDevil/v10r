/**
 * Desk create + delete tools.
 * Create: gated by 'desk:create' scope.
 * Delete: gated by 'desk:delete' scope, two-phase confirmation via `confirmed` parameter.
 */
import { jsonSchema, tool } from 'ai';
import { createMarkdownFile, createSpreadsheetFile, deleteFile } from '$lib/server/db/desk/mutations';
import { getFile } from '$lib/server/db/desk/queries';
import type { DeskEffect } from './_types';

/**
 * Tracks which (userId, fileId) pairs have had a deletion preview (dry-run).
 * Entries expire after PREVIEW_TTL_MS to prevent stale confirmations.
 */
const deletionPreviews = new Map<string, number>();
const PREVIEW_TTL_MS = 60_000;

function pruneExpiredPreviews(): void {
	const now = Date.now();
	for (const [key, ts] of deletionPreviews) {
		if (now - ts > PREVIEW_TTL_MS) deletionPreviews.delete(key);
	}
}

function previewKey(userId: string, fileId: string): string {
	return `${userId}:${fileId}`;
}

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
				"Delete a file from the user's desk. This is destructive. " +
				'First call with confirmed=false to preview what will be deleted. ' +
				'Then call again with confirmed=true only after the user explicitly agrees.',
			inputSchema: jsonSchema<{ file_id: string; confirmed: boolean }>({
				type: 'object',
				properties: {
					file_id: { type: 'string', description: 'The file ID to delete.' },
					confirmed: {
						type: 'boolean',
						description: 'Set to true only after the user has explicitly confirmed deletion.',
					},
				},
				required: ['file_id', 'confirmed'],
			}),
			execute: async ({ file_id, confirmed }, { abortSignal: _abortSignal }) => {
				try {
					pruneExpiredPreviews();
					const fileRow = await getFile(file_id, userId);
					if (!fileRow) return { error: 'File not found or not accessible.' };

					if (!confirmed) {
						// Record the preview so a subsequent confirmed=true is allowed
						deletionPreviews.set(previewKey(userId, file_id), Date.now());
						return {
							requiresConfirmation: true,
							description: `Delete "${fileRow.name}"? This cannot be undone.`,
							fileId: file_id,
							fileName: fileRow.name,
						};
					}

					// Server-side guard: reject unless a preview happened recently
					const key = previewKey(userId, file_id);
					const previewTs = deletionPreviews.get(key);
					if (!previewTs || Date.now() - previewTs > PREVIEW_TTL_MS) {
						return { error: 'Deletion preview expired or missing. Call with confirmed=false first.' };
					}
					deletionPreviews.delete(key); // One-time use

					const result = await deleteFile(file_id, userId);
					if (!result) return { error: 'File not found or already deleted.' };

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_explorer' },
						{ type: 'desk:notify', message: `Deleted "${fileRow.name}"`, level: 'info' },
					];

					return { deleted: true, fileId: file_id, name: fileRow.name, effects };
				} catch {
					return { error: 'Failed to delete file.' };
				}
			},
		}),
	};
}
