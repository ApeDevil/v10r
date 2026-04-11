/**
 * Desk read tools — list, read, search files, and introspect layout.
 * No side effects, no mutations. Always safe to call.
 */
import { jsonSchema, tool } from 'ai';
import { getFile, getMarkdownByFileId, getSpreadsheetByFileId, listFiles } from '$lib/server/db/desk/queries';
import { getFileTree, renderFileTreeWithIndex } from '$lib/server/desk/file-tree';
import type { DeskLayoutEntry } from './_types';

/** Max output size per tool call (characters). Prevents prompt injection exfiltration. */
const MAX_TOOL_OUTPUT_CHARS = 8_000;

/** Truncate tool output to budget with a notice. */
function truncateOutput(text: string): string {
	if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
	return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n... (truncated at ${MAX_TOOL_OUTPUT_CHARS} chars)`;
}

/** Summarize spreadsheet cells to stay under ~400 tokens. */
function summarizeCells(cells: Record<string, unknown>): string {
	const entries = Object.entries(cells);
	if (entries.length === 0) return '(empty spreadsheet)';
	const preview = entries.slice(0, 20);
	const lines = preview.map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
	if (entries.length > 20) lines.push(`... and ${entries.length - 20} more cells`);
	return truncateOutput(lines.join('\n'));
}

export function createReadTools(userId: string, deskLayout?: DeskLayoutEntry[]) {
	return {
		desk_list_files: tool({
			description:
				"List files in the user's desk workspace. " +
				'Returns file names, IDs, types, and last-updated timestamps. ' +
				'Use this to discover what files exist before reading or editing.',
			inputSchema: jsonSchema<{ file_type: string }>({
				type: 'object',
				properties: {
					file_type: {
						type: 'string',
						enum: ['spreadsheet', 'markdown', 'all'],
						description: 'Filter by file type. "all" returns all types.',
					},
				},
				required: ['file_type'],
			}),
			execute: async ({ file_type }, { abortSignal: _abortSignal }) => {
				try {
					const files = await listFiles(userId, file_type === 'all' ? undefined : file_type);
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
			execute: async ({ file_id }, { abortSignal: _abortSignal }) => {
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
							content: truncateOutput(md.markdown.content),
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

		desk_file_tree: tool({
			description:
				'Get the full file tree showing all folders, desk files, blog posts, and image assets. ' +
				'Returns a text tree with IDs for cross-referencing with desk_read_file. ' +
				'Use this first to understand what content exists.',
			inputSchema: jsonSchema<Record<string, never>>({
				type: 'object',
				properties: {},
			}),
			execute: async (_input, { abortSignal: _abortSignal }) => {
				try {
					const tree = await getFileTree(userId);
					return { tree: truncateOutput(renderFileTreeWithIndex(tree)) };
				} catch {
					return { error: 'Failed to load file tree.' };
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
			execute: async ({ query }, { abortSignal: _abortSignal }) => {
				try {
					const files = await listFiles(userId);
					const q = query.toLowerCase();
					const matches = files.filter((f) => f.name.toLowerCase().includes(q)).slice(0, 20);
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

		desk_get_open_panels: tool({
			description:
				"Get the list of currently open panels in the desk — their IDs, types, labels, and file associations. " +
				"Use this to understand the user's current workspace layout.",
			inputSchema: jsonSchema<Record<string, never>>({
				type: 'object',
				properties: {},
			}),
			execute: async () => {
				if (!deskLayout?.length) return { panels: [], total: 0 };
				return {
					panels: deskLayout.map((p) => ({
						panelId: p.panelId,
						fileId: p.fileId ?? null,
						fileType: p.fileType ?? null,
						label: p.label,
					})),
					total: deskLayout.length,
				};
			},
		}),
	};
}
