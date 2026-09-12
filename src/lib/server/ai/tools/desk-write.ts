/**
 * Desk write tools — modify existing files.
 * Gated by 'desk:write' scope.
 *
 * HARD GATE: these tools mutate an EXISTING entity, so they do NOT write in the
 * agent loop. Each `execute` validates the target and returns a `requiresApproval`
 * sentinel; the orchestrator turns that into a pending `agent_proposal` (PlanCard),
 * and the mutation runs only via the server-verified approve-route replay
 * (`executeDeskToolCall`), which records a genuine `approvedBy`/`approvedAt`.
 * This is why the tools import queries (to validate + label) but never mutations.
 *
 * The sentinel carries the REVIEWED BASELINE (`target`): the file's version at the moment
 * the change was proposed. The orchestrator persists it on the proposal step and the
 * replay refuses to run against a file that has moved on since — the user approved a
 * change to the document they saw, not to whatever it became.
 */
import { tool } from 'ai';
import { getMarkdownByFileId } from '$lib/server/db/desk/queries';
import { DESK_READ_MAX_CHARS } from '../config';
import { cancelledBefore } from './cancelled';
import { DESK_MUTATION_INPUTS, toolInputSchema } from './desk-mutation-inputs';
import { applyMarkdownEdits } from './markdown-edits';
import { readProposedTarget } from './proposed-target';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

export function createWriteTools(userId: string) {
	return {
		desk_update_cells: tool({
			description:
				'Update cells in a spreadsheet. Provide an array of cell updates — ' +
				'only the specified cells are changed. Other cells remain untouched. ' +
				'The change is queued for the user to approve before it is saved.',
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_update_cells),
			execute: async ({ file_id, updates }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const target = await readProposedTarget(userId, file_id);
					if (!target) return { error: 'Spreadsheet not found or not accessible.' };
					if (target.fileType !== 'spreadsheet') return { error: 'That file is not a spreadsheet.' };

					// HARD GATE: do not merge/write here. The approve-route replay merges against
					// the live cell map and persists (with a pre-image revision snapshot).
					return {
						requiresApproval: true,
						action: `Update ${updates.length} cell${updates.length === 1 ? '' : 's'} in "${target.name}"`,
						target,
					};
				} catch {
					return { error: 'Failed to prepare cell update.' };
				}
			},
		}),

		desk_rename_file: tool({
			description: "Rename a file on the user's desk. The rename is queued for the user to approve first.",
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_rename_file),
			execute: async ({ file_id, name }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const target = await readProposedTarget(userId, file_id);
					if (!target) return { error: 'File not found or not accessible.' };

					return {
						requiresApproval: true,
						action: `Rename "${target.name}" → "${name}"`,
						target,
					};
				} catch {
					return { error: 'Failed to prepare rename.' };
				}
			},
		}),

		desk_update_markdown: tool({
			description:
				'Replace the FULL content of a short markdown document (one that desk_read_file showed whole — ' +
				`at most ${DESK_READ_MAX_CHARS} characters). Provide the complete new markdown (not a diff). ` +
				'For a longer document, or for a small change, use desk_edit_markdown. ' +
				'The overwrite is queued for the user to approve before it is saved.',
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_update_markdown),
			execute: async ({ file_id, content }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const target = await readProposedTarget(userId, file_id);
					if (!target) return { error: 'Markdown file not found or not accessible.' };
					if (target.fileType !== 'markdown') return { error: 'That file is not a markdown document.' };
					const current = await getMarkdownByFileId(file_id, userId);
					if (current && current.markdown.content.length > DESK_READ_MAX_CHARS) {
						// The same rule the replay enforces, surfaced here so the model can change course.
						return {
							error: `"${target.name}" is ${current.markdown.content.length} characters — longer than one read shows, so a whole-document rewrite would drop text you never saw. Use desk_edit_markdown for targeted changes.`,
						};
					}

					// HARD GATE: do not overwrite here. The approve-route replay overwrites and
					// captures a pre-image revision so the old content stays recoverable.
					return {
						requiresApproval: true,
						action: `Overwrite "${target.name}" (${content.length} chars)`,
						target,
					};
				} catch {
					return { error: 'Failed to prepare markdown update.' };
				}
			},
		}),

		desk_edit_markdown: tool({
			description:
				'Make targeted edits to a markdown document: each edit replaces one exact passage (`find`, which ' +
				'must occur exactly once — quote enough surrounding text to be unique) with `replace`. Works on ' +
				'documents of any length and leaves everything else untouched. Read the passage with desk_read_file ' +
				'first. The edits are queued for the user to approve before they are saved.',
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_edit_markdown),
			execute: async ({ file_id, edits }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const target = await readProposedTarget(userId, file_id);
					if (!target) return { error: 'Markdown file not found or not accessible.' };
					if (target.fileType !== 'markdown') return { error: 'That file is not a markdown document.' };
					const current = await getMarkdownByFileId(file_id, userId);
					if (!current) return { error: 'Markdown file not found or not accessible.' };
					// Check the edits against the document NOW — a passage that is not there, or is there
					// twice, is the model's to fix before a card is shown, not the replay's to refuse.
					const edited = applyMarkdownEdits(current.markdown.content, edits);
					if ('error' in edited) return edited;

					// HARD GATE: do not write here. The approve-route replay applies the edits against
					// the reviewed version and captures a pre-image revision.
					return {
						requiresApproval: true,
						action: `Edit ${edits.length} passage${edits.length === 1 ? '' : 's'} in "${target.name}"`,
						target,
					};
				} catch {
					return { error: 'Failed to prepare markdown edit.' };
				}
			},
		}),
	};
}
