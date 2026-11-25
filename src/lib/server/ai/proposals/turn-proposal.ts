/**
 * The proposal a persisted turn stopped on, as its owner reads it back.
 *
 * `ai.turn` records the proposal's id only — the row keeps moving after the turn (approved,
 * executing, executed, failed, expired), so the trace resolves it at read time the way it
 * resolves grounding bodies: by id, for the owner. The card's steps are derived exactly as
 * the PlanCard's were (risk and recovery from the tool, never from the model); the receipts
 * are the durable account of what the approval replay ran.
 */
import { getExternalOperation } from '#lib/server/db/ai/external-operations.ts';
import { getProposal, listProposalSteps } from '#lib/server/db/ai/proposals.ts';
import {
	type ExternalDisclosure,
	externalOperationCard,
	externalReceiptView,
} from '#lib/server/external-operations/index.ts';
import type { TurnProposal, TurnTrace } from '#lib/types/turn-trace.ts';
import { toCardSteps } from './approval-boundary';
import { toStepReceipt } from './proposal-outcome';

/**
 * Attach the turn's proposal. A proposal that is gone (its message deleted) or that names
 * another message than the turn's is left unresolved — the id stays, the node says so.
 */
export async function resolveTurnProposal(trace: TurnTrace): Promise<TurnTrace> {
	if (!trace.proposalId) return trace;
	const row = await getProposal(trace.proposalId);
	if (!row || row.messageId !== trace.messageId) return trace;
	const receipts = (await listProposalSteps(row.id)).map(toStepReceipt);
	const external = await getExternalOperation(row.id);
	const proposal: TurnProposal = {
		...(external
			? {
					external: {
						card: externalOperationCard(
							external.toolName,
							external.disclosure as unknown as ExternalDisclosure,
							external,
						),
						receipt: externalReceiptView(external),
					},
				}
			: {}),
		id: row.id,
		status: row.status,
		riskTier: row.riskTier,
		goal: row.rationale,
		steps: toCardSteps(row.payload),
		grantedScopes: row.grantedScopes,
		receipts,
		failureMessage: row.failureMessage,
		expiresAt: row.expiresAt.toISOString(),
		approvedAt: row.approvedAt?.toISOString() ?? null,
		executedAt: row.executedAt?.toISOString() ?? null,
	};
	return { ...trace, proposal };
}
