/**
 * Desk create + delete tools.
 * Create: gated by 'desk:create' scope. Creates are reversible (soft-delete) so
 *   they mutate in-loop and are auto-approved — through the same door as the replay
 *   (`executeDeskToolCall`), so the file they produce and the effects they return are
 *   exactly what an approved plan's create step would produce.
 * Delete: gated by 'desk:delete' scope. Destructive, so it does NOT delete in-loop —
 *   it returns a `requiresApproval` sentinel carrying the reviewed baseline, and the
 *   orchestrator routes it through the server-verified proposal flow
 *   (createProposal → PlanCard → POST /approve). The actual delete runs only via the
 *   approve replay, which records a genuine `approvedBy`/`approvedAt` — replacing the
 *   old self-serve `confirmed=false → confirmed=true` handshake the model could satisfy itself.
 */
import { tool } from 'ai';
import { cancelledBefore } from './cancelled';
import { executeDeskToolCall } from './desk-execute';
import { DESK_MUTATION_INPUTS, toolInputSchema } from './desk-mutation-inputs';
import { readProposedTarget } from './proposed-target';

// Tool metadata (name → risk/scope) lives in the declarative `TOOL_MANIFEST` in `tools/index.ts`.

export function createCreateTools(userId: string) {
	const inLoop = { userId, scopes: ['desk:create' as const] };
	return {
		desk_create_spreadsheet: tool({
			description:
				"Create a new spreadsheet on the user's desk. " +
				'Optionally provide initial cell data as an array of {cell, value} pairs.',
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_create_spreadsheet),
			execute: async (input, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				const result = await executeDeskToolCall(inLoop, 'desk_create_spreadsheet', input);
				if (!result.ok) return { error: result.errorMessage };
				return { ...result.output, effects: result.effects };
			},
		}),

		desk_create_markdown: tool({
			description:
				"Create a new markdown document on the user's desk. " + 'Provide the file name and initial markdown content.',
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_create_markdown),
			execute: async (input, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				const result = await executeDeskToolCall(inLoop, 'desk_create_markdown', input);
				if (!result.ok) return { error: result.errorMessage };
				return { ...result.output, effects: result.effects };
			},
		}),
	};
}

export function createDeleteTools(userId: string) {
	return {
		desk_delete_file: tool({
			description:
				"Delete a file from the user's desk. This is destructive and does NOT delete when you " +
				'call it — the deletion is queued for the user to approve first. Call it once with the ' +
				'target file id; the user then approves (or rejects) the deletion in the UI. Deleted files ' +
				'are kept in the trash for a retention window, not destroyed at once.',
			inputSchema: toolInputSchema(DESK_MUTATION_INPUTS.desk_delete_file),
			execute: async ({ file_id }, { abortSignal }) => {
				const gone = cancelledBefore(abortSignal);
				if (gone) return gone;
				try {
					const target = await readProposedTarget(userId, file_id);
					if (!target) return { error: 'File not found or not accessible.' };

					// HARD GATE: do not delete here. Signal the orchestrator to create a
					// pending proposal; the delete runs only via the approve replay
					// after a genuine, server-recorded user approval.
					return {
						requiresApproval: true,
						action: `Delete "${target.name}"`,
						target,
					};
				} catch {
					return { error: 'Failed to prepare deletion.' };
				}
			},
		}),
	};
}
