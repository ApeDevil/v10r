/**
 * How a proposal reads back once it is no longer running — the one place the approve, revert
 * and status doors build their answer from, so a live response and a later status read agree
 * by construction. Pure derivations over the stored receipts; no step runs here.
 */
import { listProposalSteps, listRevertSteps } from '$lib/server/db/ai/proposals';
import type { agentProposal } from '$lib/server/db/schema/ai/proposal';
import type { agentProposalStep, StepRecoveryPoint } from '$lib/server/db/schema/ai/proposal-step';
import type { ProposalOutcome, ProposalRevert, ProposalStepReceipt } from '$lib/types/ai-proposal';
import type { DeskEffect } from '../tools/_types';
import { effectsForStep } from '../tools/desk-execute';

type ProposalRow = typeof agentProposal.$inferSelect;
type StepRow = typeof agentProposalStep.$inferSelect;

export function toStepReceipt(row: StepRow): ProposalStepReceipt {
	return {
		stepIndex: row.stepIndex,
		toolName: row.toolName,
		kind: row.kind,
		output: (row.output as Record<string, unknown> | null) ?? null,
		errorMessage: row.errorMessage,
	};
}

/** The effects the completed steps imply — the same derivation the live run used. */
export function effectsOfReceipts(steps: readonly ProposalStepReceipt[]) {
	return steps.filter((s) => s.kind === 'ok' && s.output).flatMap((s) => effectsForStep(s.toolName, s.output ?? {}));
}

/**
 * The desk effects of undoing one step, from nothing but its recovery point — so the live
 * revert response and a later status read agree, as `effectsForStep` does for the run.
 */
function revertStepEffects(point: StepRecoveryPoint): DeskEffect[] {
	if (point.kind !== 'revision') return [{ type: 'desk:refresh_explorer' }];
	if (point.revisionId === null) return [];
	return [
		{ type: 'desk:refresh_file', fileId: point.fileId },
		{ type: 'desk:tab_indicator', fileId: point.fileId, panelType: point.fileType, variant: 'modified' },
	];
}

/** The effects of the steps the revert actually undid, in the order they were undone. */
function revertEffects(rows: readonly StepRow[], revert: ProposalRevert): DeskEffect[] {
	const undone = new Set(revert.steps.filter((step) => step.kind === 'ok').map((step) => step.stepIndex));
	return rows
		.filter((row) => undone.has(row.stepIndex) && row.recovery !== null)
		.reverse()
		.flatMap((row) => revertStepEffects(row.recovery as StepRecoveryPoint));
}

/** The undo as the client reads it — null until one was claimed. */
async function revertOf(proposal: ProposalRow): Promise<ProposalRevert | null> {
	if (proposal.revertStatus === null) return null;
	const steps = await listRevertSteps(proposal.id);
	return {
		status: proposal.revertStatus,
		steps: steps.map((row) => ({ stepIndex: row.stepIndex, kind: row.kind, errorMessage: row.errorMessage })),
	};
}

/**
 * The outcome of a proposal that is no longer running, rebuilt from its receipts — what
 * the status route and a repeated approval answer with. The receipt message is not
 * rebuilt: it is a row of the conversation already.
 */
export async function proposalOutcome(proposal: ProposalRow): Promise<ProposalOutcome> {
	const rows = await listProposalSteps(proposal.id);
	const steps = rows.map(toStepReceipt);
	const revert = await revertOf(proposal);
	return {
		id: proposal.id,
		status: proposal.status,
		steps,
		failureMessage: proposal.failureMessage,
		// Once undone, the panels must reflect the undo, not the run it reversed.
		effects: revert ? revertEffects(rows, revert) : effectsOfReceipts(steps),
		receiptMessage: null,
		expiresAt: proposal.expiresAt.toISOString(),
		revert,
	};
}
