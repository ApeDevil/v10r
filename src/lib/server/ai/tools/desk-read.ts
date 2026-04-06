/**
 * Desk read tools — list, read, and search files.
 * No side effects, no mutations. Always safe to call.
 */
import { tool, jsonSchema } from 'ai';
import { listFiles, getFile, getSpreadsheetByFileId, getMarkdownByFileId } from '$lib/server/db/desk/queries';

/** Summarize spreadsheet cells to stay under ~400 tokens. */
function summarizeCells(cells: Record<string, unknown>): string {
	const entries = Object.entries(cells);
	if (entries.length === 0) return '(empty spreadsheet)';
	const preview = entries.slice(0, 20);
	const lines = preview.map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
	if (entries.length > 20) lines.push(`... and ${entries.length - 20} more cells`);
	return lines.join('\n');
}

export function createReadTools(userId: string) {
	return {
		desk_list_files: tool({
			description:
				"List files in the user's desk workspace. " +
				'Returns file names, IDs, types, and last-updated timestamps. ' +
				'Use this to discover what files exist before reading or editing.',
			inputSchema: jsonSchema<{ file_type: string | null }>({
				type: 'object',
				properties: {
					file_type: {
						type: ['string', 'null'],
						enum: ['spreadsheet', 'markdown', null],
						description: 'Filter by file type. Null returns all types.',
					},
				},
				required: ['file_type'],
			}),
			execute: async ({ file_type }) => {
				try {
					const files = await listFiles(userId, file_type ?? undefined);
					return {
						files: files.map((f) => ({
							id: f.id,
							name: f.name,
							type: f.type,
							updatedAt: f.updatedAt.toISOString(),
						})),
						total: files.length,
					};
				} catch {
					return { error: 'Failed to list files.' };
				}
			},
		}),

		desk_read_file: tool({
			description:
				'Read the full contents of a desk file by ID. ' +
				'For spreadsheets, returns cell data summary. ' +
				'Use desk_list_files first to find the file ID.',
			inputSchema: jsonSchema<{ file_id: string }>({
				type: 'object',
				properties: {
					file_id: {
						type: 'string',
						description: 'The file ID to read. Get IDs from desk_list_files.',
					},
				},
				required: ['file_id'],
			}),
			execute: async ({ file_id }) => {
				try {
					const fileRow = await getFile(file_id, userId);
					if (!fileRow) return { error: 'File not found or not accessible.' };

					if (fileRow.type === 'spreadsheet') {
						const sheet = await getSpreadsheetByFileId(file_id, userId);
						if (!sheet) return { error: 'Spreadsheet data not found.' };
						return {
							file: { id: fileRow.id, name: fileRow.name, type: fileRow.type },
							content: summarizeCells(sheet.spreadsheet.cells as Record<string, unknown>),
						};
					}

					if (fileRow.type === 'markdown') {
						const md = await getMarkdownByFileId(file_id, userId);
						if (!md) return { error: 'Markdown data not found.' };
						return {
							file: { id: fileRow.id, name: fileRow.name, type: fileRow.type },
							content: md.markdown.content.slice(0, 4000),
						};
					}

					return {
						file: { id: fileRow.id, name: fileRow.name, type: fileRow.type },
					};
				} catch {
					return { error: 'Failed to read file.' };
				}
			},
		}),

		desk_search_files: tool({
			description:
				'Search for files by name. Returns matching file names and IDs. ' +
				'Use when the user mentions a file by name.',
			inputSchema: jsonSchema<{ query: string }>({
				type: 'object',
				properties: {
					query: {
						type: 'string',
						minLength: 1,
						maxLength: 200,
						description: 'Search text to match against file names.',
					},
				},
				required: ['query'],
			}),
			execute: async ({ query }) => {
				try {
					const files = await listFiles(userId);
					const q = query.toLowerCase();
					const matches = files
						.filter((f) => f.name.toLowerCase().includes(q))
						.slice(0, 20);
					return {
						files: matches.map((f) => ({
							id: f.id,
							name: f.name,
							type: f.type,
						})),
						total: matches.length,
					};
				} catch {
					return { error: 'Search failed.' };
				}
			},
		}),
	};
}
