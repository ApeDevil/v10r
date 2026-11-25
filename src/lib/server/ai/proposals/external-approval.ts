/**
 * The approve door's external half — the composition root that registers the protocol adapters
 * with the external-operations executor and answers in the proposal contract.
 *
 * Registration point: `externalOperationAdapters(actor)` returns one adapter per protocol: the
 * MCP peer directory's, and the A2A delegation adapter over the operator's peers
 * (`A2A_DELEGATION_PEERS`) when any are listed. The claim, the receipt, the card and the routes
 * are protocol-free.
 * The adapters are built per request because they revalidate the actor's CURRENT role.
 */

import {
	a2aEnvironmentSecretResolver,
	createA2aDelegationAdapter,
	loadDelegationPeers,
} from '#lib/server/a2a/index.ts';
import { getProposal } from '#lib/server/db/ai/proposals.ts';
import {
	type ApproveExternalOptions,
	createExternalOperationExecutor,
	type ExternalApprovalRefusal,
	type ExternalOperationActor,
	type ExternalOperationAdapters,
	externalReceiptView,
} from '#lib/server/external-operations/index.ts';
import type { ProposalOutcome } from '#lib/types/ai-proposal.ts';
import { createMcpOperationAdapter } from '../mcp-client';
import { wrapUntrusted } from '../untrusted-content';
import { proposalOutcome } from './proposal-outcome';

/** The A2A delegation adapter over the operator's peers, or none when no peer is listed. */
export function delegationOperationAdapter() {
	const peers = loadDelegationPeers();
	if (peers.length === 0) return undefined;
	return createA2aDelegationAdapter({ peers, resolveSecret: a2aEnvironmentSecretResolver, wrapResult: wrapUntrusted });
}

export function externalOperationAdapters(actor: ExternalOperationActor): ExternalOperationAdapters {
	const a2a = delegationOperationAdapter();
	return { mcp: createMcpOperationAdapter({ actor }), ...(a2a ? { a2a } : {}) };
}

export type ExternalProposalAnswer =
	| { kind: 'outcome'; outcome: ProposalOutcome }
	| { kind: 'in_flight'; outcome: ProposalOutcome }
	| { kind: 'refused'; reason: ExternalApprovalRefusal };

export interface ApproveExternalProposalDeps {
	/** Override the registered adapters (the interop harness, tests). */
	adapters?: ExternalOperationAdapters;
	leaseMs?: number;
}

/** Approve and execute one external proposal; answers what the approve route returns. */
export async function approveExternalProposal(
	proposalId: string,
	actor: ExternalOperationActor,
	options: ApproveExternalOptions = {},
	deps: ApproveExternalProposalDeps = {},
): Promise<ExternalProposalAnswer> {
	const executor = createExternalOperationExecutor({
		adapters: deps.adapters ?? externalOperationAdapters(actor),
		...(deps.leaseMs !== undefined ? { leaseMs: deps.leaseMs } : {}),
	});
	const result = await executor.approve(proposalId, actor, options);
	if (result.kind === 'refused') return result;
	const proposal = await getProposal(proposalId);
	if (!proposal) return { kind: 'refused', reason: 'not_found' };
	const outcome = { ...(await proposalOutcome(proposal)), external: externalReceiptView(result.row) };
	if (result.kind === 'in_flight') return { kind: 'in_flight', outcome };
	return { kind: 'outcome', outcome: { ...outcome, receiptMessage: result.receiptMessage } };
}

/**
 * The status door's recovery for an external proposal: settle an interrupted claim, refuse a
 * pending row that can no longer run, restore a lost receipt message from the row — never re-run.
 * Null when the proposal has no external operation.
 */
export async function recoverExternalProposal(proposalId: string, leaseMs?: number) {
	return createExternalOperationExecutor({ adapters: {}, ...(leaseMs !== undefined ? { leaseMs } : {}) }).recover(
		proposalId,
	);
}
