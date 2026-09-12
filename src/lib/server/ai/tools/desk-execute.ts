/**
 * Executes a desk tool call against the desk domain — the ONE door every desk
 * mutation goes through: the in-loop creates and the proposal-approval replay
 * (`executeProposal`) alike.
 *
 * The in-loop path is gated differently: `createDeskTools` only assembles the
 * tools whose scope was granted, so an ungranted tool is never callable. This
 * module is the replay equivalent and must enforce the same thing itself, or
 * approval becomes the weaker of the two doors for the identical mutation.
 *
 * Three things are checked here and nowhere else, in this order: the scope the tool
 * costs; the args against the tool's contract (`DESK_MUTATION_INPUTS` — the door trusts
 * no payload, not even one it persisted itself); and, for a step that changes an
 * existing file, the REVIEWED BASELINE: the version or `updatedAt` the user saw on the
 * PlanCard. A file that moved on since review is a `conflict`, never a silent overwrite,
 * and never something a fresh read inside the replay could paper over.
 *
 * A new mutating desk tool MUST get a case in the switch, an entry in `TOOL_SCOPE` and a
 * schema in `DESK_MUTATION_INPUTS`, or the drift-guard tests fail — so the replay path
 * can never silently fall behind the live tool set.
 *
 * The result carries the desk effects the client must dispatch, derived from the
 * persisted output by `effectsForStep` so a receipt read back later yields the same
 * effects the live response did. A gated tool never reaches the desk in the loop, so
 * this is the only place a replayed mutation can tell an open panel to refresh.
 */
import { type DbHandle, db } from '$lib/server/db';
import {
	createMarkdownFile,
	createSpreadsheetFile,
	deleteFile,
	lockFileIfUnchanged,
	renameFile,
	updateMarkdownByFileId,
	updateSpreadsheetByFileId,
} from '$lib/server/db/desk/mutations';
import { getMarkdownByFileId, getSpreadsheetByFileId } from '$lib/server/db/desk/queries';
import type { ProposedTarget } from '$lib/server/db/schema/ai/proposal';
import type { ProposalStepRecovery } from '$lib/types/ai-proposal';
import { DESK_READ_MAX_CHARS } from '../config';
import { followAiContextChange } from '../deskbot-retrieval';
import type { DeskEffect, DeskToolScope } from './_types';
import { applyCellUpdates } from './cell-updates';
import { type DeskMutationInput, describeIssues, parseMutationInput } from './desk-mutation-inputs';
import { applyMarkdownEdits } from './markdown-edits';

export type DeskExecResult =
	| { ok: true; output: Record<string, unknown>; effects: DeskEffect[] }
	| { ok: false; kind: 'failed' | 'conflict'; output: null; errorMessage: string };

/**
 * Tool names this executor can run. The drift-guard test asserts this set equals
 * the mutating tools in `deskbotToolMeta` (risk write/create/destructive).
 */
export const DESK_EXECUTABLE_TOOLS = [
	'desk_update_cells',
	'desk_rename_file',
	'desk_update_markdown',
	'desk_edit_markdown',
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
	desk_edit_markdown: 'desk:write',
	desk_create_spreadsheet: 'desk:create',
	desk_create_markdown: 'desk:create',
	desk_delete_file: 'desk:delete',
};

/**
 * How each executable tool's change is undone — what the PlanCard tells the user instead
 * of model-authored "rollback" prose. Server-derived from the tool, like the scope above.
 */
export const TOOL_RECOVERY: Record<DeskExecutableTool, ProposalStepRecovery> = {
	desk_update_cells: 'revision',
	desk_rename_file: 'rename_back',
	desk_update_markdown: 'revision',
	desk_edit_markdown: 'revision',
	desk_create_spreadsheet: 'none',
	desk_create_markdown: 'none',
	desk_delete_file: 'soft_delete',
};

/** Who is driving this execution. Recorded for audit; never widens authority. */
export type DeskActor = 'ai-inloop' | 'proposal-replay';

export interface DeskExecContext {
	userId: string;
	/** Scopes actually granted for this execution — server-derived, never client-supplied. */
	scopes: DeskToolScope[];
	actor: DeskActor;
	/**
	 * The transaction the caller already holds, when the mutation must commit together
	 * with something else — the proposal replay writes the step's receipt on it.
	 */
	handle?: DbHandle;
}

const CONFLICT_MESSAGE =
	'The file changed after you reviewed this plan. Ask again to get a plan for the current version.';

const failed = (errorMessage: string): DeskExecResult => ({ ok: false, kind: 'failed', output: null, errorMessage });
const conflict = (): DeskExecResult => ({ ok: false, kind: 'conflict', output: null, errorMessage: CONFLICT_MESSAGE });

/**
 * The desk effects a completed step implies, from nothing but its tool and persisted
 * output — so the live approve response and a later receipt read agree by construction.
 */
export function effectsForStep(toolName: string, output: Record<string, unknown>): DeskEffect[] {
	const fileId = typeof output.fileId === 'string' ? output.fileId : null;
	if (!fileId) return [];
	const name = typeof output.name === 'string' ? output.name : undefined;
	switch (toolName as DeskExecutableTool) {
		case 'desk_update_cells':
			return [
				{ type: 'desk:refresh_file', fileId },
				{ type: 'desk:tab_indicator', fileId, panelType: 'spreadsheet', variant: 'modified' },
			];
		case 'desk_update_markdown':
		case 'desk_edit_markdown':
			return [
				{ type: 'desk:refresh_file', fileId },
				{ type: 'desk:tab_indicator', fileId, panelType: 'markdown', variant: 'modified' },
			];
		case 'desk_create_spreadsheet':
			return [
				{ type: 'desk:refresh_explorer' },
				{ type: 'desk:open_panel', panelType: 'spreadsheet', fileId, label: name ?? 'Spreadsheet' },
				{ type: 'desk:tab_indicator', fileId, panelType: 'spreadsheet', variant: 'created' },
			];
		case 'desk_create_markdown':
			return [
				{ type: 'desk:refresh_explorer' },
				{ type: 'desk:open_panel', panelType: 'markdown', fileId, label: name ?? 'Document' },
				{ type: 'desk:tab_indicator', fileId, panelType: 'markdown', variant: 'created' },
			];
		case 'desk_rename_file':
		case 'desk_delete_file':
			return [{ type: 'desk:refresh_explorer' }];
		default:
			return [];
	}
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
 *
 * `target` is the reviewed baseline. Required for every tool that changes an existing
 * file (update, rename, delete): a step that arrives without one was never reviewed
 * against a version and is refused rather than run against whatever is stored now.
 */
export async function executeDeskToolCall(
	ctx: DeskExecContext,
	toolName: string,
	args: Record<string, unknown>,
	target?: ProposedTarget,
): Promise<DeskExecResult> {
	const { userId } = ctx;
	const handle = ctx.handle ?? db;

	const required = TOOL_SCOPE[toolName as DeskExecutableTool];
	if (!required) return failed(`Unknown tool "${toolName}" in proposal payload.`);
	if (!ctx.scopes.includes(required)) return failed(`Permission ${required} was not granted for this action.`);

	const parsed = parseMutationInput(toolName, args);
	if (!parsed) return failed(`Unknown tool "${toolName}" in proposal payload.`);
	if (!parsed.success) return failed(`Invalid arguments for ${toolName}: ${describeIssues(parsed.issues)}`);

	const changesExistingFile = required !== 'desk:create';
	if (changesExistingFile && !target) return failed(`No reviewed baseline for ${toolName} — propose the change again.`);

	try {
		switch (toolName as DeskExecutableTool) {
			case 'desk_update_cells': {
				const { file_id, updates } = parsed.output as DeskMutationInput<'desk_update_cells'>;
				if (target?.version == null) return failed('No reviewed spreadsheet version — propose the change again.');
				const sheet = await getSpreadsheetByFileId(file_id, userId, handle);
				if (!sheet) return failed('Spreadsheet not found.');
				const merged = applyCellUpdates(sheet.spreadsheet.cells, updates);
				if ('error' in merged) return failed(merged.error);
				const result = await updateSpreadsheetByFileId(
					file_id,
					userId,
					{ cells: merged.cells, expectedVersion: target.version },
					'ai',
					handle,
				);
				if (!result) return failed('Failed to update cells.');
				if (result.status === 'conflict') return conflict();
				return done(toolName, {
					updated: true,
					fileId: file_id,
					name: result.file.name,
					cellsChanged: updates.length,
					version: result.version,
				});
			}
			case 'desk_rename_file': {
				const { file_id, name } = parsed.output as DeskMutationInput<'desk_rename_file'>;
				// `await`, not a bare return: a rejection must land in the catch below.
				return await handle.transaction(async (tx) => {
					const lock = await lockFileIfUnchanged(tx, file_id, userId, new Date(target?.updatedAt ?? 0));
					if (!lock) return failed('File not found.');
					if (lock.status === 'changed') return conflict();
					const result = await renameFile(file_id, userId, name, tx);
					if (!result) return failed('File not found.');
					return done(toolName, { renamed: true, fileId: result.id, name: result.name });
				});
			}
			case 'desk_update_markdown': {
				const { file_id, content } = parsed.output as DeskMutationInput<'desk_update_markdown'>;
				if (target?.version == null) return failed('No reviewed document version — propose the change again.');
				const current = await getMarkdownByFileId(file_id, userId, handle);
				if (!current) return failed('Markdown file not found.');
				// The model reads at most DESK_READ_MAX_CHARS of a document per call; a whole-document
				// rewrite of a longer one would replace text the model never saw. Targeted edits do not.
				if (current.markdown.content.length > DESK_READ_MAX_CHARS) {
					return failed(
						`"${current.file.name}" is ${current.markdown.content.length} characters — longer than one read shows. Use desk_edit_markdown for targeted changes instead of replacing the whole document.`,
					);
				}
				const result = await updateMarkdownByFileId(
					file_id,
					userId,
					{ content, expectedVersion: target.version },
					'ai',
					handle,
				);
				if (!result) return failed('Markdown file not found.');
				if (result.status === 'conflict') return conflict();
				return done(toolName, {
					updated: true,
					fileId: result.file.id,
					name: result.file.name,
					version: result.version,
				});
			}
			case 'desk_edit_markdown': {
				const { file_id, edits } = parsed.output as DeskMutationInput<'desk_edit_markdown'>;
				if (target?.version == null) return failed('No reviewed document version — propose the change again.');
				const current = await getMarkdownByFileId(file_id, userId, handle);
				if (!current) return failed('Markdown file not found.');
				// The edits were reviewed against `target.version`; a document that moved on since is a
				// conflict before any text is touched — the CAS below would say the same, later.
				if (current.markdown.version !== target.version) return conflict();
				const edited = applyMarkdownEdits(current.markdown.content, edits);
				if ('error' in edited) return failed(edited.error);
				const result = await updateMarkdownByFileId(
					file_id,
					userId,
					{ content: edited.content, expectedVersion: target.version },
					'ai',
					handle,
				);
				if (!result) return failed('Markdown file not found.');
				if (result.status === 'conflict') return conflict();
				return done(toolName, {
					updated: true,
					fileId: result.file.id,
					name: result.file.name,
					version: result.version,
					editsApplied: edits.length,
				});
			}
			case 'desk_create_spreadsheet': {
				const { name, cells } = parsed.output as DeskMutationInput<'desk_create_spreadsheet'>;
				const initial = applyCellUpdates({}, cells);
				if ('error' in initial) return failed(initial.error);
				const result = await createSpreadsheetFile(userId, name, initial.cells, null, null, handle);
				return done(toolName, { created: true, fileId: result.file.id, name: result.file.name });
			}
			case 'desk_create_markdown': {
				const { name, content } = parsed.output as DeskMutationInput<'desk_create_markdown'>;
				const result = await createMarkdownFile(userId, name, content, null, null, handle);
				return done(toolName, { created: true, fileId: result.file.id, name: result.file.name });
			}
			case 'desk_delete_file': {
				const { file_id } = parsed.output as DeskMutationInput<'desk_delete_file'>;
				// `await`, not a bare return: a rejection must land in the catch below.
				return await handle.transaction(async (tx) => {
					const lock = await lockFileIfUnchanged(tx, file_id, userId, new Date(target?.updatedAt ?? 0));
					if (!lock) return failed('File not found.');
					if (lock.status === 'changed') return conflict();
					const result = await deleteFile(file_id, userId, 'ai', tx);
					if (!result) return failed('File not found.');
					if (result.aiContext) followAiContextChange(userId, result.id, result.type, false);
					return done(toolName, { deleted: true, fileId: result.id, name: result.name });
				});
			}
			default:
				return failed(`Unknown tool "${toolName}" in proposal payload.`);
		}
	} catch (err) {
		return failed(err instanceof Error ? err.message : 'Tool execution failed.');
	}
}

function done(toolName: string, output: Record<string, unknown>): DeskExecResult {
	return { ok: true, output, effects: effectsForStep(toolName, output) };
}
