/**
 * Desk read tools — list, read, search files, and introspect layout.
 * No side effects, no mutations. Always safe to call.
 *
 * Bounded, and honest about the bound: every read says how much of the whole it returned
 * and where the rest starts. A cell beyond the first page and a section beyond the first
 * 8,000 characters are reachable through `range` / `offset` — the model does not have to
 * guess at content it was never shown, and a write tool can refuse to replace a document
 * the model has only seen the head of.
 */
import { tool } from 'ai';
import * as v from 'valibot';
import { cellLabel, parseCellRef } from '$lib/desk/formula';
import { DESK_READ_MAX_CHARS } from '$lib/server/ai/config';
import {
	getFile,
	getMarkdownByFileId,
	getSpreadsheetByFileId,
	listFiles,
	searchFiles,
} from '$lib/server/db/desk/queries';
import { getFileTree, renderFileTreeWithIndex } from '$lib/server/desk/file-tree';
import { DESK_FILE_TYPES } from '$lib/types/db-enums';
import type { DeskLayoutEntry } from './_types';
import { cancelledBefore } from './cancelled';
import { toolInputSchema } from './desk-mutation-inputs';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

/** Max output size per tool call (characters). Prevents prompt injection exfiltration. */
const MAX_TOOL_OUTPUT_CHARS = DESK_READ_MAX_CHARS;

/** Cells per read page. */
const CELL_PAGE = 20;

/** The most files one list or search call returns. */
const FILE_PAGE_MAX = 50;

/** Truncate tool output to budget with a notice. */
function truncateOutput(text: string): string {
	if (text.length <= MAX_TOOL_OUTPUT_CHARS) return text;
	return `${text.slice(0, MAX_TOOL_OUTPUT_CHARS)}\n... (truncated at ${MAX_TOOL_OUTPUT_CHARS} chars)`;
}

/** `A1:D20` → the labels inside it, in row-major order; null when it is not a range. */
function cellsInRange(range: string): string[] | null {
	const [from, to] = range.toUpperCase().split(':');
	const a = from ? parseCellRef(from) : null;
	const b = to ? parseCellRef(to) : a;
	if (!a || !b) return null;
	const labels: string[] = [];
	for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++) {
		for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++) labels.push(cellLabel(col, row));
	}
	return labels;
}

/** One page of a sheet as `A1: {json}` lines, with what the page did not cover. */
function summarizeCells(cells: Record<string, unknown>, range?: string) {
	const entries = Object.entries(cells);
	const totalCells = entries.length;
	if (totalCells === 0) return { content: '(empty spreadsheet)', totalCells, shownCells: 0, truncated: false };
	if (range) {
		const labels = cellsInRange(range);
		if (!labels) return { error: `"${range}" is not a cell range — use the form A1:D20.` };
		const shown = labels.filter((label) => label in cells).map((label) => `${label}: ${JSON.stringify(cells[label])}`);
		return {
			content: shown.length ? truncateOutput(shown.join('\n')) : `(no values in ${range.toUpperCase()})`,
			totalCells,
			shownCells: shown.length,
			truncated: false,
		};
	}
	const preview = entries.slice(0, CELL_PAGE);
	const lines = preview.map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
	if (totalCells > CELL_PAGE)
		lines.push(`... and ${totalCells - CELL_PAGE} more cells — read a range (e.g. A21:D40) for the rest`);
	return {
		content: truncateOutput(lines.join('\n')),
		totalCells,
		shownCells: preview.length,
		truncated: totalCells > CELL_PAGE,
	};
}

const FileTypeFilter = v.pipe(
	v.picklist([...DESK_FILE_TYPES, 'all']),
	v.description('Filter by file type. "all" returns all types.'),
);

export function createReadTools(userId: string, deskLayout?: DeskLayoutEntry[]) {
	return {
		desk_list_files: tool({
			description:
				"List files in the user's desk workspace, newest first. " +
				'Returns file names, IDs, types, versions and last-updated timestamps, plus the total and the ' +
				'offset of the next page. Use this to discover what files exist before reading or editing; ' +
				'use desk_search_files to find a file by name.',
			inputSchema: toolInputSchema(
				v.object({
					file_type: FileTypeFilter,
					offset: v.optional(
						v.pipe(v.number(), v.integer(), v.minValue(0), v.description('Skip this many files (paging).')),
						0,
					),
					limit: v.optional(
						v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(FILE_PAGE_MAX), v.description('Files per page.')),
						FILE_PAGE_MAX,
					),
				}),
			),
			execute: async ({ file_type, offset, limit }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const { items, total } = await listFiles(userId, file_type === 'all' ? undefined : file_type, offset, limit);
					const nextOffset = offset + items.length;
					return {
						files: items.map((f) => ({ id: f.id, name: f.name, type: f.type, updatedAt: f.updatedAt.toISOString() })),
						total,
						nextOffset: nextOffset < total ? nextOffset : null,
					};
				} catch {
					return { error: 'Failed to list files.' };
				}
			},
		}),

		desk_read_file: tool({
			description:
				'Read a desk file by ID. A spreadsheet returns its first cells or the `range` you ask for ' +
				'(e.g. "A21:D40"); a document returns 8,000 characters from `offset`. The result says how much ' +
				'of the whole it covers (totalCells / totalChars, truncated, nextOffset) and the file version. ' +
				'Desk files only — blog posts and image assets from desk_file_tree cannot be read here.',
			inputSchema: toolInputSchema(
				v.object({
					file_id: v.pipe(
						v.string(),
						v.minLength(1),
						v.description('The file ID to read. Get IDs from desk_list_files.'),
					),
					range: v.optional(
						v.pipe(v.string(), v.maxLength(20), v.description('Spreadsheets: a cell range like "A1:D20".')),
					),
					offset: v.optional(
						v.pipe(
							v.number(),
							v.integer(),
							v.minValue(0),
							v.description('Documents: start reading at this character.'),
						),
						0,
					),
				}),
			),
			execute: async ({ file_id, range, offset }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					if (file_id.startsWith('pst_'))
						return { error: 'That is a blog post, not a desk file. Desk tools read only desk files.' };
					if (file_id.startsWith('ast_'))
						return { error: 'That is an image asset, not a desk file. Desk tools read only desk files.' };
					const fileRow = await getFile(file_id, userId);
					if (!fileRow) return { error: 'File not found or not accessible.' };

					if (fileRow.type === 'spreadsheet') {
						const sheet = await getSpreadsheetByFileId(file_id, userId);
						if (!sheet) return { error: 'Spreadsheet data not found.' };
						const page = summarizeCells(sheet.spreadsheet.cells, range);
						if ('error' in page) return page;
						return {
							file: {
								id: fileRow.id,
								name: fileRow.name,
								type: fileRow.type,
								version: sheet.spreadsheet.version,
								updatedAt: fileRow.updatedAt.toISOString(),
							},
							...page,
						};
					}

					const md = await getMarkdownByFileId(file_id, userId);
					if (!md) return { error: 'Markdown data not found.' };
					const text = md.markdown.content;
					const start = Math.min(offset, text.length);
					const slice = text.slice(start, start + MAX_TOOL_OUTPUT_CHARS);
					const end = start + slice.length;
					return {
						file: {
							id: fileRow.id,
							name: fileRow.name,
							type: fileRow.type,
							version: md.markdown.version,
							updatedAt: fileRow.updatedAt.toISOString(),
						},
						content: slice,
						offset: start,
						totalChars: text.length,
						truncated: end < text.length || start > 0,
						nextOffset: end < text.length ? end : null,
					};
				} catch {
					return { error: 'Failed to read file.' };
				}
			},
		}),

		desk_file_tree: tool({
			description:
				'Get the full file tree: folders and desk files (spreadsheets and documents, readable with ' +
				'desk_read_file), plus blog posts and image assets for orientation only — those are not desk ' +
				'files and no desk tool reads or edits them. Use this first to understand what content exists.',
			inputSchema: toolInputSchema(v.object({})),
			execute: async (_input, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
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
				"Search the user's desk files by name — every file, not just the newest. Returns matching " +
				'names, IDs, types and timestamps. Use when the user mentions a file by name.',
			inputSchema: toolInputSchema(
				v.object({
					query: v.pipe(
						v.string(),
						v.minLength(1),
						v.maxLength(200),
						v.description('Text to match against file names.'),
					),
					file_type: v.optional(FileTypeFilter, 'all'),
					limit: v.optional(
						v.pipe(
							v.number(),
							v.integer(),
							v.minValue(1),
							v.maxValue(FILE_PAGE_MAX),
							v.description('Matches to return.'),
						),
						20,
					),
				}),
			),
			execute: async ({ query, file_type, limit }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const { items, total } = await searchFiles(userId, query, {
						type: file_type === 'all' ? undefined : file_type,
						limit,
					});
					return {
						files: items.map((f) => ({ id: f.id, name: f.name, type: f.type, updatedAt: f.updatedAt.toISOString() })),
						total,
					};
				} catch {
					return { error: 'Search failed.' };
				}
			},
		}),

		desk_get_open_panels: tool({
			description:
				'Get the list of currently open panels in the desk — their IDs, types, labels, and file associations. ' +
				"Use this to understand the user's current workspace layout.",
			inputSchema: toolInputSchema(v.object({})),
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
