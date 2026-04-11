/**
 * Desk write tools — modify existing files.
 * Gated by 'desk:write' scope.
 */
import { jsonSchema, tool } from 'ai';
import { renameFile, updateMarkdownByFileId, updateSpreadsheetByFileId } from '$lib/server/db/desk/mutations';
import { getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import type { DeskEffect } from './_types';

export function createWriteTools(userId: string) {
	return {
		desk_update_cells: tool({
			description:
				'Update cells in a spreadsheet. Provide an array of cell updates — ' +
				'only the specified cells are changed. Other cells remain untouched.',
			inputSchema: jsonSchema<{
				file_id: string;
				updates: { cell: string; value: string | number | null }[];
			}>({
				type: 'object',
				properties: {
					file_id: {
						type: 'string',
						description: 'Spreadsheet file ID. Get from desk_list_files or desk_read_file.',
					},
					updates: {
						type: 'array',
						items: {
							type: 'object',
							properties: {
								cell: { type: 'string', description: 'Cell address like "A1", "B3", "C10".' },
								value: {
									description: 'Cell value. String for text, number for numeric, null to clear.',
								},
							},
							required: ['cell', 'value'],
						},
						description: 'Array of cell updates to apply.',
					},
				},
				required: ['file_id', 'updates'],
			}),
			execute: async ({ file_id, updates }, { abortSignal: _abortSignal }) => {
				try {
					const sheet = await getSpreadsheetByFileId(file_id, userId);
					if (!sheet) return { error: 'Spreadsheet not found or not accessible.' };

					const existingCells = (sheet.spreadsheet.cells ?? {}) as Record<string, unknown>;
					const mergedCells = { ...existingCells };

					for (const { cell, value } of updates) {
						if (value === null) {
							delete mergedCells[cell];
						} else {
							mergedCells[cell] = { v: value };
						}
					}

					const result = await updateSpreadsheetByFileId(file_id, userId, { cells: mergedCells });
					if (!result) return { error: 'Failed to save spreadsheet changes.' };

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_file', fileId: file_id },
						{ type: 'desk:tab_indicator', fileId: file_id, panelType: 'spreadsheet', variant: 'modified' },
					];

					return {
						updated: true,
						fileId: file_id,
						cellsChanged: updates.length,
						fileName: result.name,
						effects,
					};
				} catch {
					return { error: 'Failed to update cells.' };
				}
			},
		}),

		desk_rename_file: tool({
			description: "Rename a file on the user's desk.",
			inputSchema: jsonSchema<{ file_id: string; name: string }>({
				type: 'object',
				properties: {
					file_id: { type: 'string', description: 'The file ID to rename.' },
					name: { type: 'string', minLength: 1, maxLength: 200, description: 'New name for the file.' },
				},
				required: ['file_id', 'name'],
			}),
			execute: async ({ file_id, name }, { abortSignal: _abortSignal }) => {
				try {
					const result = await renameFile(file_id, userId, name);
					if (!result) return { error: 'File not found or not accessible.' };

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_file', fileId: file_id },
						{ type: 'desk:refresh_explorer' },
					];

					return { renamed: true, fileId: file_id, name, effects };
				} catch {
					return { error: 'Failed to rename file.' };
				}
			},
		}),

		desk_update_markdown: tool({
			description:
				'Replace the full content of a markdown document. ' +
				'Use desk_read_file first to see current content. ' +
				'Provide the complete new markdown (not a diff).',
			inputSchema: jsonSchema<{ file_id: string; content: string }>({
				type: 'object',
				properties: {
					file_id: {
						type: 'string',
						description: 'Markdown file ID. Get from desk_list_files or desk context.',
					},
					content: {
						type: 'string',
						maxLength: 50000,
						description: 'Complete new markdown content to replace the document.',
					},
				},
				required: ['file_id', 'content'],
			}),
			execute: async ({ file_id, content }) => {
				try {
					const result = await updateMarkdownByFileId(file_id, userId, content);
					if (!result) return { error: 'Markdown file not found or not accessible.' };

					const effects: DeskEffect[] = [
						{ type: 'desk:refresh_file', fileId: file_id },
						{ type: 'desk:tab_indicator', fileId: file_id, panelType: 'editor', variant: 'modified' },
					];

					return { updated: true, fileId: file_id, fileName: result.name, effects };
				} catch {
					return { error: 'Failed to update markdown.' };
				}
			},
		}),
	};
}
