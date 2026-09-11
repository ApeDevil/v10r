/**
 * Executes a desk tool call against the desk domain — the proposal-approval
 * replay path (`POST /api/ai/proposals/[id]/approve`).
 *
 * The in-loop path is gated differently: `createDeskTools` only assembles the
 * tools whose scope was granted, so an ungranted tool is never callable. This
 * module is the replay equivalent and must enforce the same thing itself, or
 * approval becomes the weaker of the two doors for the identical mutation.
 *
 * A new mutating desk tool MUST get both a case in the switch and an entry in
 * `TOOL_SCOPE`, or the drift-guard test fails — so the replay path can never
 * silently fall behind the live tool set, nor execute something whose cost was
 * never declared.
 *
 * Returns a replay-shaped result: the raw outcome plus the desk effects the client
 * must dispatch. The in-loop tools carry their effects inside the tool output, but a
 * gated tool returns `requiresApproval` and never reaches the desk — so this is the
 * only place a replayed mutation can tell an open panel to refresh. Without it the
 * panel keeps showing the pre-AI sheet at a stale version, and the user's next edit
 * is refused as a conflict with a change made on their behalf.
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
import type { DeskEffect, DeskToolScope } from './_types';
import { applyCellUpdates, type CellUpdate } from './cell-updates';

export type DeskExecResult =
	| { ok: true; output: unknown; effects: DeskEffect[] }
	| { ok: false; output: unknown; errorMessage: string };

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

/**
 * The scope each executable tool costs.
 *
 * The drift-guard test asserts these keys equal DESK_EXECUTABLE_TOOLS, so a new
 * mutating tool cannot be added without declaring what it costs.
 */
export const TOOL_SCOPE: Record<DeskExecutableTool, DeskToolScope> = {
	desk_update_cells: 'desk:write',
	desk_rename_file: 'desk:write',
	desk_update_markdown: 'desk:write',
	desk_create_spreadsheet: 'desk:create',
	desk_create_markdown: 'desk:create',
	desk_delete_file: 'desk:delete',
};

/** Who is driving this execution. Recorded for audit; never widens authority. */
export type DeskActor = 'ai-inloop' | 'proposal-replay';

export interface DeskExecContext {
	userId: string;
	/** Scopes actually granted for this execution — server-derived, never client-supplied. */
	scopes: DeskToolScope[];
	actor: DeskActor;
}

/**
 * Execute a single desk tool call against the desk domain. Never throws.
 *
 * Scope enforcement lives HERE, not at the callers. A bare dispatcher would let
 * the proposal-replay door execute mutations without consulting scopes at all —
 * strictly weaker than the in-loop door for the identical operation. The gate at
 * this one shared door is what makes the two paths agree by construction.
 *
 * Note this is a consent/intent boundary, not a tenancy one: every underlying
 * mutation is already scoped by `userId`, so a scope failure cannot reach
 * another user's data either way.
 */
export async function executeDeskToolCall(
	ctx: DeskExecContext,
	toolName: string,
	args: Record<string, unknown>,
): Promise<DeskExecResult> {
	const { userId } = ctx;

	const required = TOOL_SCOPE[toolName as DeskExecutableTool];
	if (!required) {
		// Same wording as the switch default it front-runs — an unknown tool is
		// an unknown tool regardless of which check notices first.
		return { ok: false, output: null, errorMessage: `Unknown tool "${toolName}" in proposal payload.` };
	}
	if (!ctx.scopes.includes(required)) {
		return { ok: false, output: null, errorMessage: `Permission ${required} was not granted for this action.` };
	}

	try {
		switch (toolName) {
			case 'desk_update_cells': {
				const fileId = args.file_id as string;
				const updates = args.updates as CellUpdate[];
				const sheet = await getSpreadsheetByFileId(fileId, userId);
				if (!sheet) return { ok: false, output: null, errorMessage: 'Spreadsheet not found.' };
				const merged = applyCellUpdates(sheet.spreadsheet.cells, updates);
				if ('error' in merged) return { ok: false, output: null, errorMessage: merged.error };
				const result = await updateSpreadsheetByFileId(
					fileId,
					userId,
					{ cells: merged.cells, expectedVersion: sheet.spreadsheet.version },
					'ai',
				);
				if (!result) return { ok: false, output: null, errorMessage: 'Failed to update cells.' };
				if (result.status === 'conflict') {
					return {
						ok: false,
						output: null,
						errorMessage: 'Spreadsheet changed during the update. Read it again before retrying.',
					};
				}
				return {
					ok: true,
					output: { updated: true, fileId, cellsChanged: updates.length, fileName: result.file.name },
					effects: [
						{ type: 'desk:refresh_file', fileId },
						{ type: 'desk:tab_indicator', fileId, panelType: 'spreadsheet', variant: 'modified' },
					],
				};
			}
			case 'desk_rename_file': {
				const result = await renameFile(args.file_id as string, userId, args.name as string);
				if (!result) return { ok: false, output: null, errorMessage: 'File not found.' };
				return {
					ok: true,
					output: { renamed: true, fileId: result.id, name: result.name },
					effects: [{ type: 'desk:refresh_explorer' }],
				};
			}
			case 'desk_update_markdown': {
				const result = await updateMarkdownByFileId(args.file_id as string, userId, args.content as string, 'ai');
				if (!result) return { ok: false, output: null, errorMessage: 'Markdown file not found.' };
				return {
					ok: true,
					output: { updated: true, fileId: result.id, fileName: result.name },
					effects: [
						{ type: 'desk:refresh_file', fileId: result.id },
						{ type: 'desk:tab_indicator', fileId: result.id, panelType: 'markdown', variant: 'modified' },
					],
				};
			}
			case 'desk_create_spreadsheet': {
				const initial = applyCellUpdates({}, (args.cells as CellUpdate[]) ?? []);
				if ('error' in initial) return { ok: false, output: null, errorMessage: initial.error };
				const result = await createSpreadsheetFile(userId, args.name as string, initial.cells);
				return {
					ok: true,
					output: { created: true, fileId: result.file.id, name: result.file.name },
					effects: [
						{ type: 'desk:refresh_explorer' },
						{ type: 'desk:open_panel', panelType: 'spreadsheet', fileId: result.file.id, label: result.file.name },
						{ type: 'desk:tab_indicator', fileId: result.file.id, panelType: 'spreadsheet', variant: 'created' },
					],
				};
			}
			case 'desk_create_markdown': {
				const result = await createMarkdownFile(userId, args.name as string, args.content as string);
				return {
					ok: true,
					output: { created: true, fileId: result.file.id, name: result.file.name },
					effects: [
						{ type: 'desk:refresh_explorer' },
						{ type: 'desk:tab_indicator', fileId: result.file.id, panelType: 'markdown', variant: 'created' },
					],
				};
			}
			case 'desk_delete_file': {
				const result = await deleteFile(args.file_id as string, userId, 'ai');
				if (!result) return { ok: false, output: null, errorMessage: 'File not found.' };
				return {
					ok: true,
					output: { deleted: true, fileId: result.id, name: result.name },
					effects: [{ type: 'desk:refresh_explorer' }],
				};
			}
			default:
				return { ok: false, output: null, errorMessage: `Unknown tool "${toolName}" in proposal payload.` };
		}
	} catch (err) {
		return { ok: false, output: null, errorMessage: err instanceof Error ? err.message : 'Tool execution failed.' };
	}
}
