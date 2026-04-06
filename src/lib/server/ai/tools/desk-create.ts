/**
 * Desk create + delete tools.
 * Create: gated by 'desk:create' scope.
 * Delete: gated by 'desk:delete' scope, two-phase confirmation via `confirmed` parameter.
 */
import { tool, jsonSchema } from 'ai';
import { createSpreadsheetFile, createMarkdownFile, deleteFile } from '$lib/server/db/desk/mutations';
import { getFile } from '$lib/server/db/desk/queries';
import type { DeskEffect } from './_types';

export function createCreateTools(userId: string) {
	return {
		desk_create_spreadsheet: tool({
			description:
				"Create a new spreadsheet on the user's desk. " +
				'Optionally provide initial cell data as an array of {cell, value} pairs.',
			parameters: jsonSchema<{
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
			execute: async ({ name, cells }) => {
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
						{ type: 'desk:tab_indicator', fileId: result.file.id, variant: 'created' },
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
				"Create a new markdown document on the user's desk. " +
				'Provide the file name and initial markdown content.',
			parameters: jsonSchema<{ name: string; content: string }>({
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
			execute: async ({ name, content }) => {
				try {
					const result = await createMarkdownFile(userId, name, content);

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_explorer' },
						{ type: 'desk:tab_indicator', fileId: result.file.id, variant: 'created' },
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
			parameters: jsonSchema<{ file_id: string; confirmed: boolean }>({
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
			execute: async ({ file_id, confirmed }) => {
				try {
					const fileRow = await getFile(file_id, userId);
					if (!fileRow) return { error: 'File not found or not accessible.' };

					if (!confirmed) {
						return {
							requiresConfirmation: true,
							description: `Delete "${fileRow.name}"? This cannot be undone.`,
							fileId: file_id,
							fileName: fileRow.name,
						};
					}

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
