/**
 * Runs an approved proposal — the business half of `POST /api/ai/proposals/[id]/approve`.
 *
 * Each step's desk mutation and its receipt (`agent_proposal_step`) commit in ONE
 * transaction, so after any crash the receipts are exactly the set of mutations that
 * happened; the receipts' primary key refuses a second execution of a step. The plan is a
 * sequence, not a batch: it stops at the first step that is not `ok` and the earlier
 * steps stay — there is no rollback, and the receipts say so.
 *
 * What the user reads afterwards is deterministic: the receipt message is written here,
 * from the receipts, as an assistant row of the conversation. The desk client shows it
 * under the card and carries it in the history it sends, so the model learns what ran the
 * same way it learns everything else — no acknowledgement model call, nothing to fall
 * through into a mutating turn if the plan failed.
 */
import { db } from '$lib/server/db';
import { saveMessages } from '$lib/server/db/ai/mutations';
import {
	listProposalSteps,
	markExecuted,
	markFailed,
	recordProposalStep,
	touchExecuting,
} from '$lib/server/db/ai/proposals';
import type { agentProposal } from '$lib/server/db/schema/ai/proposal';
import type { agentProposalStep } from '$lib/server/db/schema/ai/proposal-step';
import type { ProposalOutcome, ProposalReceiptMessage, ProposalStepReceipt } from '$lib/types/ai-proposal';
import type { ProposalStatus } from '$lib/types/db-enums';
import type { DeskToolScope } from '../tools/_types';
import { effectsForStep, executeDeskToolCall } from '../tools/desk-execute';

type ProposalRow = typeof agentProposal.$inferSelect;
type StepRow = typeof agentProposalStep.$inferSelect;

/**
 * The terminal reason the client tells apart from a step's own error text. Its sibling,
 * `'interrupted'`, is written by `markInterruptedIfStale` when a run outlives its lease.
 */
const FAILURE_CONFLICT = 'conflict';

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
 * The deterministic account of a run: one line per planned step — done, failed, or never
 * reached. Plain prose, because it is stored as an assistant message and read by both the
 * user and the model.
 */
export function receiptText(
	proposal: ProposalRow,
	steps: readonly ProposalStepReceipt[],
	status: ProposalStatus,
): string {
	const byIndex = new Map(steps.map((s) => [s.stepIndex, s]));
	const done = steps.filter((s) => s.kind === 'ok').length;
	const total = proposal.payload.length;
	const head =
		status === 'executed'
			? `Ran the approved plan (${done} of ${total} step${total === 1 ? '' : 's'}).`
			: `The approved plan stopped after ${done} of ${total} step${total === 1 ? '' : 's'}; nothing was rolled back.`;
	const lines = proposal.payload.map((step, index) => {
		const receipt = byIndex.get(index);
		const label = `${index + 1}. ${step.action}`;
		if (!receipt) return `${label} — not run`;
		if (receipt.kind === 'ok') {
			const version =
				receipt.output && typeof receipt.output.version === 'number' ? ` (now version ${receipt.output.version})` : '';
			return `${label} — done${version}`;
		}
		return `${label} — ${receipt.kind === 'conflict' ? 'conflict: ' : 'failed: '}${receipt.errorMessage ?? 'unknown error'}`;
	});
	return [head, ...lines].join('\n');
}

/**
 * Execute the payload of a proposal already in `executing`. Returns the outcome the
 * client renders; never throws for a step's failure — that is a receipt, not an error.
 */
export async function executeProposal(proposal: ProposalRow, userId: string): Promise<ProposalOutcome> {
	const scopes = (proposal.grantedScopes ?? []) as DeskToolScope[];
	const steps: ProposalStepReceipt[] = (await listProposalSteps(proposal.id)).map(toStepReceipt);
	let failure: string | null = null;

	for (const [index, step] of proposal.payload.entries()) {
		// A receipt already present means this step ran in an execution that lost its
		// terminal transition; it is not run twice.
		if (steps.some((s) => s.stepIndex === index)) continue;

		let receipt: ProposalStepReceipt;
		try {
			receipt = await db.transaction(async (tx) => {
				// Replay under the scopes frozen when the plan was PROPOSED, never anything
				// supplied on the approving request — approval must not widen the reviewed grant.
				const outcome = await executeDeskToolCall(
					{ userId, scopes, actor: 'proposal-replay', handle: tx },
					step.toolName,
					step.args,
					step.target,
				);
				const row = await recordProposalStep(tx, {
					proposalId: proposal.id,
					stepIndex: index,
					toolName: step.toolName,
					kind: outcome.ok ? 'ok' : outcome.kind,
					output: outcome.ok ? outcome.output : null,
					errorMessage: outcome.ok ? undefined : outcome.errorMessage,
					createdFileId:
						outcome.ok && outcome.output.created === true && typeof outcome.output.fileId === 'string'
							? outcome.output.fileId
							: undefined,
				});
				return toStepReceipt(row);
			});
		} catch (err) {
			// The receipt could not be written, so the mutation rolled back with it. A primary
			// key collision here means another execution already owns this step.
			failure = err instanceof Error ? err.message : 'Step could not be recorded.';
			break;
		}

		steps.push(receipt);
		if (receipt.kind !== 'ok') {
			failure = receipt.kind === 'conflict' ? FAILURE_CONFLICT : (receipt.errorMessage ?? 'Step failed.');
			break;
		}
		await touchExecuting(proposal.id);
	}

	const status: ProposalStatus = failure === null ? 'executed' : 'failed';
	if (failure === null) await markExecuted(proposal.id);
	else await markFailed(proposal.id, failure);

	const receiptMessage = await persistReceiptMessage(proposal, userId, steps, status);
	return {
		id: proposal.id,
		status,
		steps,
		failureMessage: failure,
		effects: effectsOfReceipts(steps),
		receiptMessage,
		expiresAt: proposal.expiresAt.toISOString(),
	};
}

async function persistReceiptMessage(
	proposal: ProposalRow,
	userId: string,
	steps: readonly ProposalStepReceipt[],
	status: ProposalStatus,
): Promise<ProposalReceiptMessage | null> {
	const text = receiptText(proposal, steps, status);
	const id = crypto.randomUUID();
	try {
		await saveMessages(proposal.conversationId, userId, [{ id, role: 'assistant', content: text }]);
		return { id, text };
	} catch (err) {
		// The receipts already hold the truth; a lost message only costs the transcript a line.
		console.error('[ai:proposal] Failed to persist the receipt message:', err);
		return null;
	}
}

/**
 * The outcome of a proposal that is no longer running, rebuilt from its receipts — what
 * the status route and a repeated approval answer with. The receipt message is not
 * rebuilt: it is a row of the conversation already.
 */
export async function proposalOutcome(proposal: ProposalRow): Promise<ProposalOutcome> {
	const steps = (await listProposalSteps(proposal.id)).map(toStepReceipt);
	return {
		id: proposal.id,
		status: proposal.status,
		steps,
		failureMessage: proposal.failureMessage,
		effects: effectsOfReceipts(steps),
		receiptMessage: null,
		expiresAt: proposal.expiresAt.toISOString(),
	};
}
