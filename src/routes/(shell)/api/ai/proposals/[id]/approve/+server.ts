/**
 * POST /api/ai/proposals/[id]/approve — execute an approved proposal.
 *
 * State machine:
 *   `pending → approved → executing → (executed | failed)`
 *
 * **Idempotency**: `proposalId` IS the idempotency key. The partial unique
 * index on `agent_proposal` (see `db/schema/ai/proposal.ts`) ensures at most
 * one row is simultaneously in `executing` or `executed` state. Concurrent
 * approvals find the existing row and return its cached result.
 *
 * Flow:
 *   1. Auth + ownership check (conversation must belong to caller).
 *   2. Transition `pending → approved`. If already approved/executed, read
 *      the existing row and return its state.
 *   3. Transition `approved → executing` (may collide if racing).
 *   4. Run the payload tool calls via the desk domain modules (same path
 *      the in-loop tool `execute` functions use — multi-client core rule).
 *   5. Transition `executing → executed` or `failed` with the cached result.
 *
 * DELETE on the same URL rejects a still-pending proposal.
 */
import { apiError, apiOk } from '$lib/server/api/response';
import { requireApiUser } from '$lib/server/auth/guards';
import {
	approveProposal,
	getProposal,
	markExecuted,
	markExecuting,
	markFailed,
	rejectProposal,
} from '$lib/server/db/ai/proposals';
import { getConversation } from '$lib/server/db/ai/queries';
import {
	createMarkdownFile,
	createSpreadsheetFile,
	deleteFile,
	renameFile,
	updateMarkdownByFileId,
	updateSpreadsheetByFileId,
} from '$lib/server/db/desk/mutations';
import { classifyDbError, safeDbMessage } from '$lib/server/db/errors';
import type { ProposalExecutionResult } from '$lib/server/db/schema/ai/proposal';
import type { RequestHandler } from './$types';

/**
 * Execute a single proposed tool call against the desk domain.
 * Mirrors the mapping in `src/lib/server/ai/tools/desk-*.ts` — they
 * share the same domain modules per the multi-client core rule.
 */
async function executeOne(
	userId: string,
	toolName: string,
	args: Record<string, unknown>,
): Promise<{ ok: true; output: unknown } | { ok: false; output: unknown; errorMessage: string }> {
	try {
		switch (toolName) {
			case 'desk_update_cells': {
				const fileId = args.file_id as string;
				const updates = args.updates as { cell: string; value: string | number | null }[];
				// Fetch the existing sheet to merge. Lookup via file id.
				const { getSpreadsheetByFileId } = await import('$lib/server/db/desk/queries');
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
				return { ok: true, output: { updated: true, fileId, cellsChanged: updates.length } };
			}
			case 'desk_rename_file': {
				const result = await renameFile(args.file_id as string, userId, args.name as string);
				if (!result) return { ok: false, output: null, errorMessage: 'File not found.' };
				return { ok: true, output: { renamed: true, fileId: result.id, name: result.name } };
			}
			case 'desk_update_markdown': {
				const result = await updateMarkdownByFileId(args.file_id as string, userId, args.content as string);
				if (!result) return { ok: false, output: null, errorMessage: 'Markdown file not found.' };
				return { ok: true, output: { updated: true, fileId: result.id } };
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
		return {
			ok: false,
			output: null,
			errorMessage: err instanceof Error ? err.message : 'Tool execution failed.',
		};
	}
}

export const POST: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	try {
		// 1. Load the proposal and verify ownership via the parent conversation.
		const proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		// 2. Idempotency: if the proposal has already been executed, return
		//    the cached result. If it's executing/failed/rejected/expired,
		//    surface the current state instead of re-running.
		if (proposal.status === 'executed') {
			return apiOk({
				id: proposal.id,
				status: 'executed',
				executionResult: proposal.executionResult,
				executedAt: proposal.executedAt,
			});
		}
		if (proposal.status === 'executing') {
			return apiError(
				409,
				'proposal_in_flight',
				'Proposal is already executing. Poll /api/ai/proposals/[id] for status.',
			);
		}
		if (proposal.status === 'rejected' || proposal.status === 'expired' || proposal.status === 'failed') {
			return apiError(409, `proposal_${proposal.status}`, `Proposal is ${proposal.status} and cannot be executed.`);
		}

		// 3. Transition pending → approved (no-op if already approved).
		if (proposal.status === 'pending') {
			const approved = await approveProposal(proposal.id, user.id);
			if (!approved) return apiError(409, 'proposal_state_changed', 'Proposal state changed — reload.');
		}

		// 4. Transition approved → executing. Partial unique index protects
		//    us from concurrent executors.
		const claimed = await markExecuting(proposal.id);
		if (!claimed) {
			// Someone else claimed it between our `approveProposal` and here.
			// Re-read and return the current state.
			const fresh = await getProposal(proposal.id);
			if (fresh?.status === 'executed') {
				return apiOk({
					id: fresh.id,
					status: 'executed',
					executionResult: fresh.executionResult,
					executedAt: fresh.executedAt,
				});
			}
			return apiError(409, 'proposal_in_flight', 'Proposal is already executing.');
		}

		// 5. Run the payload, collect results, transition executed / failed.
		const results: ProposalExecutionResult['results'] = [];
		for (const step of proposal.payload) {
			const outcome = await executeOne(user.id, step.toolName, step.args);
			if (outcome.ok) {
				results.push({ toolName: step.toolName, ok: true, output: outcome.output });
			} else {
				results.push({
					toolName: step.toolName,
					ok: false,
					output: outcome.output,
					errorMessage: outcome.errorMessage,
				});
				// Short-circuit on first failure — the plan is a sequence, not a batch.
				await markFailed(proposal.id, outcome.errorMessage);
				return apiOk({
					id: proposal.id,
					status: 'failed',
					executionResult: { toolCallIds: [], results },
					failureMessage: outcome.errorMessage,
				});
			}
		}

		const executionResult: ProposalExecutionResult = { toolCallIds: [], results };
		await markExecuted(proposal.id, executionResult);

		return apiOk({
			id: proposal.id,
			status: 'executed',
			executionResult,
			executedAt: new Date().toISOString(),
		});
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};

/** DELETE /api/ai/proposals/[id]/approve — reject a pending proposal. */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	const { user } = requireApiUser(locals);

	try {
		const proposal = await getProposal(params.id);
		if (!proposal) return apiError(404, 'not_found', 'Proposal not found.');

		const conv = await getConversation(proposal.conversationId, user.id);
		if (!conv) return apiError(404, 'not_found', 'Proposal not found.');

		if (proposal.status !== 'pending') {
			return apiError(409, `proposal_${proposal.status}`, `Proposal is ${proposal.status} — cannot reject.`);
		}

		const rejected = await rejectProposal(proposal.id, 'user_rejected');
		if (!rejected) return apiError(409, 'proposal_state_changed', 'Proposal state changed — reload.');

		return apiOk({ id: proposal.id, status: 'rejected' });
	} catch (err) {
		const dbErr = classifyDbError(err);
		return apiError(dbErr.toStatus(), dbErr.kind, safeDbMessage(dbErr.kind));
	}
};
