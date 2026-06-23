/**
 * Single source of truth for executing a desk tool call against the desk domain.
 *
 * One-door rule: BOTH the in-loop tool `execute` paths and the proposal-approval
 * replay (`POST /api/ai/proposals/[id]/approve`) route their mutations through this
 * map. A new mutating desk tool added to the harness MUST get a case here, or the
 * `desk-execute` drift-guard test fails — so the replay path can never silently
 * fall behind the live tool set (the failure mode this module exists to prevent).
 *
 * Returns a replay-shaped result. The in-loop tools layer their own `DeskEffect[]`
 * and display fields on top; the replay path uses the raw outcome as-is.
 */
import {
	createMarkdownFile,
	createSpreadsheetFile,
	deleteFile,
	renameFile,
	updateMarkdownByFileId,
	updateSpreadsheetByFileId,
} from '$lib/server/db/desk/mutations';
import { getSpreadsheetByFileId } from '$lib/server/db/desk/queries';

export type DeskExecResult = { ok: true; output: unknown } | { ok: false; output: unknown; errorMessage: string };

/**
 * Tool names this executor can run. The drift-guard test asserts this set equals
 * the mutating tools in `deskbotToolMeta` (risk write/create/destructive).
 */
export const DESK_EXECUTABLE_TOOLS = [
	'desk_update_cells',
	'desk_rename_file',
	'desk_update_markdown',
	'desk_create_spreadsheet',
	'desk_create_markdown',
	'desk_delete_file',
] as const;

export type DeskExecutableTool = (typeof DESK_EXECUTABLE_TOOLS)[number];

/** Execute a single desk tool call against the desk domain. Never throws. */
export async function executeDeskToolCall(
	userId: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<DeskExecResult> {
	try {
		switch (toolName) {
			case 'desk_update_cells': {
				const fileId = args.file_id as string;
				const updates = args.updates as { cell: string; value: string | number | null }[];
				const sheet = await getSpreadsheetByFileId(fileId, userId);
				if (!sheet) return { ok: false, output: null, errorMessage: 'Spreadsheet not found.' };
				const existingCells = (sheet.spreadsheet.cells ?? {}) as Record<string, unknown>;
				const mergedCells = { ...existingCells };
				for (const { cell, value } of updates) {
					if (value === null) delete mergedCells[cell];
					else mergedCells[cell] = { v: value };
				}
				const result = await updateSpreadsheetByFileId(fileId, userId, { cells: mergedCells });
				if (!result) return { ok: false, output: null, errorMessage: 'Failed to update cells.' };
				return { ok: true, output: { updated: true, fileId, cellsChanged: updates.length, fileName: result.name } };
			}
			case 'desk_rename_file': {
				const result = await renameFile(args.file_id as string, userId, args.name as string);
				if (!result) return { ok: false, output: null, errorMessage: 'File not found.' };
				return { ok: true, output: { renamed: true, fileId: result.id, name: result.name } };
			}
			case 'desk_update_markdown': {
				const result = await updateMarkdownByFileId(args.file_id as string, userId, args.content as string);
				if (!result) return { ok: false, output: null, errorMessage: 'Markdown file not found.' };
				return { ok: true, output: { updated: true, fileId: result.id, fileName: result.name } };
			}
			case 'desk_create_spreadsheet': {
				const cells = (args.cells as { cell: string; value: string | number | null }[]) ?? [];
				const cellMap: Record<string, unknown> = {};
				for (const { cell, value } of cells) cellMap[cell] = { v: value };
				const result = await createSpreadsheetFile(userId, args.name as string, cellMap);
				return { ok: true, output: { created: true, fileId: result.file.id, name: result.file.name } };
			}
			case 'desk_create_markdown': {
				const result = await createMarkdownFile(userId, args.name as string, args.content as string);
				return { ok: true, output: { created: true, fileId: result.file.id, name: result.file.name } };
			}
			case 'desk_delete_file': {
				const result = await deleteFile(args.file_id as string, userId);
				if (!result) return { ok: false, output: null, errorMessage: 'File not found.' };
				return { ok: true, output: { deleted: true, fileId: result.id, name: result.name } };
			}
			default:
				return { ok: false, output: null, errorMessage: `Unknown tool "${toolName}" in proposal payload.` };
		}
	} catch (err) {
		return { ok: false, output: null, errorMessage: err instanceof Error ? err.message : 'Tool execution failed.' };
	}
}
