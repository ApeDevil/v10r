/**
 * Undoes a plan that ran — the business half of `POST /api/ai/proposals/[id]/revert`.
 *
 * A revert is compensation, not a rollback. Every forward `ok` step recorded, in its own
 * receipt, what undoing it needs (`StepRecoveryPoint`): the state it left the file in and
 * what to put back. The revert walks those receipts in reverse and runs one compensating
 * desk mutation per step, each in its own transaction with its own receipt
 * (`agent_proposal_revert_step`), behind the same fence and heartbeat as the forward run.
 *
 * Each undo is a compare-and-swap against the state the plan left the file in, so it never
 * overwrites what the user did afterwards: a file touched since is a `conflict`, reported and
 * left alone, while the other files are still undone. Expectations are CHAINED per file.
 * Undoing the later of two edits to one file moves that file on, and the earlier edit's
 * undo is checked against that new state, not against what the plan recorded. Otherwise a
 * plan that touched a file twice would conflict with its own revert.
 *
 * The compensating mutations go to the desk domain directly, attributed to the user who
 * asked (`source: 'user'`). They never pass through `executeDeskToolCall`, so nothing here
 * widens the model's tool surface or depends on the scopes the plan was granted.
 */

import type { DbHandle } from '$lib/server/db';
import { db } from '$lib/server/db';
import { saveMessages } from '$lib/server/db/ai/mutations';
import {
	claimRevert,
	finishRevert,
	getProposal,
	hasRecoveryPoints,
	listProposalSteps,
	lockReverting,
	recordRevertStep,
	touchReverting,
} from '$lib/server/db/ai/proposals';
import {
	deleteFile,
	lockFileIfUnchanged,
	renameFile,
	restoreFile,
	updateMarkdownByFileId,
	updateSpreadsheetByFileId,
} from '$lib/server/db/desk/mutations';
import { getRevision } from '$lib/server/db/desk/queries';
import type { agentProposal } from '$lib/server/db/schema/ai/proposal';
import type { StepRecoveryPoint } from '$lib/server/db/schema/ai/proposal-step';
import type { ProposalOutcome, ProposalRevertReceipt } from '$lib/types/ai-proposal';
import type { ProposalStepKind } from '$lib/types/db-enums';
import { followAiContextChange } from '../deskbot-retrieval';
import { proposalOutcome } from './proposal-outcome';

type ProposalRow = typeof agentProposal.$inferSelect;

/** What the plan (or an undo already run) left a file at: the undo's compare-and-swap baseline. */
interface FileState {
	updatedAt: Date;
	/** The content version; null until a content step touched the file in this plan. */
	version: number | null;
}

type RevertStepResult =
	| { kind: 'ok'; state: FileState; afterCommit?: () => void }
	| { kind: Exclude<ProposalStepKind, 'ok'>; errorMessage: string };

const CHANGED_SINCE = 'The file changed after the plan ran; it was left as it is.';
const NOT_FOUND = 'The file no longer exists.';

/** Thrown inside a step's transaction when the revert no longer owns the proposal. */
class RevertFenced extends Error {}

/**
 * Seed one expectation per file from the forward receipts, in execution order: the last
 * step to touch a file sets its `updatedAt`, the last CONTENT step its version.
 */
export function seedFileStates(points: readonly StepRecoveryPoint[]): Map<string, FileState> {
	const states = new Map<string, FileState>();
	for (const point of points) {
		const previous = states.get(point.fileId);
		states.set(point.fileId, {
			updatedAt: new Date(point.fileUpdatedAt),
			version: point.kind === 'revision' ? point.version : (previous?.version ?? null),
		});
	}
	return states;
}

async function revertStep(
	tx: DbHandle,
	userId: string,
	point: StepRecoveryPoint,
	before: FileState,
): Promise<RevertStepResult> {
	const changed = (): RevertStepResult => ({ kind: 'conflict', errorMessage: CHANGED_SINCE });
	switch (point.kind) {
		case 'revision': {
			// A write that changed no content left no pre-image and needs no undo.
			if (point.revisionId === null) return { kind: 'ok', state: before };
			const revision = await getRevision(point.revisionId, userId, tx);
			if (!revision) return { kind: 'failed', errorMessage: 'The previous version is no longer kept.' };
			const lock = await lockFileIfUnchanged(tx, point.fileId, userId, before.updatedAt);
			if (!lock) return { kind: 'failed', errorMessage: NOT_FOUND };
			if (lock.status === 'changed') return changed();
			// seedFileStates sets a version for every file a content step touched.
			if (before.version === null) throw new Error(`No content version recorded for ${point.fileId}.`);
			const result =
				point.fileType === 'spreadsheet'
					? await updateSpreadsheetByFileId(
							point.fileId,
							userId,
							{
								cells: (revision.cells ?? {}) as Parameters<typeof updateSpreadsheetByFileId>[2]['cells'],
								columnMeta: (revision.columnMeta as Record<string, unknown> | null) ?? null,
								expectedVersion: before.version,
							},
							'user',
							tx,
						)
					: await updateMarkdownByFileId(
							point.fileId,
							userId,
							{ content: revision.content ?? '', expectedVersion: before.version },
							'user',
							tx,
						);
			if (!result) return { kind: 'failed', errorMessage: NOT_FOUND };
			if (result.status === 'conflict') return changed();
			return {
				kind: 'ok',
				state: { updatedAt: result.file.updatedAt, version: result.version },
			};
		}
		case 'rename_back': {
			const lock = await lockFileIfUnchanged(tx, point.fileId, userId, before.updatedAt);
			if (!lock) return { kind: 'failed', errorMessage: NOT_FOUND };
			if (lock.status === 'changed') return changed();
			const renamed = await renameFile(point.fileId, userId, point.previousName, tx);
			if (!renamed) return { kind: 'failed', errorMessage: NOT_FOUND };
			return {
				kind: 'ok',
				state: { updatedAt: renamed.updatedAt, version: before.version },
			};
		}
		case 'soft_delete': {
			const restored = await restoreFile(point.fileId, userId, before.updatedAt, tx);
			if (!restored) return { kind: 'failed', errorMessage: 'The deleted file is no longer kept.' };
			if (restored.status === 'changed') return changed();
			const { file } = restored;
			return {
				kind: 'ok',
				state: { updatedAt: file.updatedAt, version: before.version },
				// A file that was in AI context goes back into the index — after the commit.
				afterCommit: file.aiContext
					? () => followAiContextChange(userId, file.id, file.type as 'markdown' | 'spreadsheet', true)
					: undefined,
			};
		}
		case 'created': {
			const lock = await lockFileIfUnchanged(tx, point.fileId, userId, before.updatedAt);
			if (!lock) return { kind: 'failed', errorMessage: NOT_FOUND };
			if (lock.status === 'changed') return changed();
			const deleted = await deleteFile(point.fileId, userId, 'user', tx);
			if (!deleted) return { kind: 'failed', errorMessage: NOT_FOUND };
			return {
				kind: 'ok',
				state: { updatedAt: deleted.updatedAt, version: before.version },
				afterCommit: deleted.aiContext
					? () => followAiContextChange(userId, deleted.id, deleted.type as 'markdown' | 'spreadsheet', false)
					: undefined,
			};
		}
	}
}

/**
 * The deterministic account of an undo: one line per step that ran. Stored as an assistant
 * message, so the user and the model learn what was undone the same way.
 */
function revertText(proposal: ProposalRow, receipts: readonly ProposalRevertReceipt[]): string {
	const undone = receipts.filter((r) => r.kind === 'ok').length;
	const head =
		undone === receipts.length
			? `Undid the plan (${undone} of ${receipts.length} step${receipts.length === 1 ? '' : 's'}).`
			: `Undid ${undone} of ${receipts.length} step${receipts.length === 1 ? '' : 's'}; the rest were left as they are.`;
	const lines = [...receipts]
		.sort((a, b) => a.stepIndex - b.stepIndex)
		.map((r) => {
			const label = `${r.stepIndex + 1}. ${proposal.payload[r.stepIndex]?.action ?? 'step'}`;
			return r.kind === 'ok' ? `${label} — undone` : `${label} — not undone: ${r.errorMessage ?? 'unknown error'}`;
		});
	return [head, ...lines].join('\n');
}

/**
 * Claim and run the undo of `proposal` for `userId`. Returns null when there is nothing this
 * caller may undo: the plan is not undoable (still pending, rejected, ran before recovery
 * points existed), `userId` does not own its conversation, or another request already
 * claimed the revert. The caller answers from the stored state either way.
 */
export async function revertProposal(proposal: ProposalRow, userId: string): Promise<ProposalOutcome | null> {
	if (!(await hasRecoveryPoints(proposal.id))) return null;
	const claimed = await claimRevert(proposal.id, userId);
	if (!claimed) return null;

	const forward = (await listProposalSteps(proposal.id)).filter(
		(step): step is typeof step & { recovery: StepRecoveryPoint } => step.kind === 'ok' && step.recovery !== null,
	);
	const states = seedFileStates(forward.map((step) => step.recovery));
	const receipts: ProposalRevertReceipt[] = [];
	let fenced = false;

	for (const step of [...forward].reverse()) {
		const point = step.recovery;
		const before = states.get(point.fileId);
		// seedFileStates was built from these same steps.
		if (!before) throw new Error(`No expected state for ${point.fileId}.`);
		let result: RevertStepResult;
		try {
			result = await db.transaction(async (tx) => {
				if (!(await lockReverting(tx, proposal.id))) throw new RevertFenced();
				const undone = await revertStep(tx, userId, point, before);
				await recordRevertStep(tx, {
					proposalId: proposal.id,
					stepIndex: step.stepIndex,
					kind: undone.kind,
					errorMessage: undone.kind === 'ok' ? undefined : undone.errorMessage,
				});
				return undone;
			});
		} catch (err) {
			if (err instanceof RevertFenced) {
				fenced = true;
				break;
			}
			// The compensating mutation rolled back with its receipt; record the failure alone.
			const errorMessage = err instanceof Error ? err.message : 'Undo failed.';
			result = { kind: 'failed', errorMessage };
			try {
				await recordRevertStep(db, {
					proposalId: proposal.id,
					stepIndex: step.stepIndex,
					kind: 'failed',
					errorMessage,
				});
			} catch (recordErr) {
				// The step stays without a receipt; the response and message below still name it.
				console.error('[ai:proposal] Failed to record a failed undo step:', recordErr);
			}
		}

		receipts.push({
			stepIndex: step.stepIndex,
			kind: result.kind,
			errorMessage: result.kind === 'ok' ? null : result.errorMessage,
		});
		if (result.kind === 'ok') {
			// Chain: an earlier step's undo on this file checks against the state just written.
			states.set(point.fileId, result.state);
			result.afterCommit?.();
		}
		await touchReverting(proposal.id);
	}

	if (!fenced) {
		await finishRevert(proposal.id, receipts.every((r) => r.kind === 'ok') ? 'reverted' : 'revert_failed');
	}

	const text = revertText(proposal, receipts);
	const messageId = crypto.randomUUID();
	let receiptMessage: ProposalOutcome['receiptMessage'] = null;
	try {
		await saveMessages(proposal.conversationId, userId, [{ id: messageId, role: 'assistant', content: text }]);
		receiptMessage = { id: messageId, text };
	} catch (err) {
		// The revert receipts already hold the truth; a lost message only costs the transcript a line.
		console.error('[ai:proposal] Failed to persist the revert message:', err);
	}

	const fresh = (await getProposal(proposal.id)) ?? proposal;
	// `proposalOutcome` derives the undo's effects from the revert receipts, exactly as a
	// later status read will — the panels the undo touched reload either way.
	return { ...(await proposalOutcome(fresh)), receiptMessage };
}
