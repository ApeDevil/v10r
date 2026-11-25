/**
 * Propose → approve → claim → verify → execute → receipt, for any external operation.
 *
 * `prepareExternalOperation` runs when the model asks for an operation: the adapter describes
 * the disclosure and the binding, the content screen classifies the arguments, nothing is sent.
 * The proposal and its `agent_external_operation` row are then written together by the turn.
 *
 * `createExternalOperationExecutor(...).approve(proposalId, actor, options)` is what the approve
 * door calls. In order:
 *
 *  1. **Owner.** Only the proposing user; anyone else is refused and nothing is recorded, so a
 *     stranger cannot spend someone else's approval.
 *  2. **Recovery.** A claim older than the lease that never settled is settled from the side of
 *     the wire it stopped on (`healInterruptedExternalOperation`) — never re-run.
 *  3. **Settled or in flight** answers from the row: a second approval never sends again.
 *  4. **Quoted content.** A `quotes_read_content` disclosure needs `authorizeQuotedContent`;
 *     without it the proposal stays pending and nothing is claimed.
 *  5. **Approve and claim.** `pending → approved`, then the atomic claim
 *     (`claimExternalOperation`: proposal `approved → executing` + operation `pending → claimed`,
 *     unexpired on the database clock, in one transaction). The loser of a race — on this
 *     instance or another — gets no row and reads the winner's.
 *  6. **Verify.** The stored arguments still match their digest; the adapter re-checks peer,
 *     contract and the operator's policy against the live state (`adapter.verify`) — the
 *     permission revalidation at execution time. Any break is `refused`, recorded; nothing sent.
 *  7. **Dispatch marker, then execute once.** `claimed → dispatched` is written before the
 *     adapter may send; `adapter.execute` runs once, with no retry here or below.
 *  8. **Receipt.** The outcome and the proposal's terminal status in one transaction, by the
 *     claim's owner only; then a deterministic receipt message in the conversation, which the
 *     model reads next turn (the peer's answer inside it stays `<untrusted-content>`).
 *
 * What a receipt claims: `succeeded` means the peer ANSWERED success — v10r did not observe the
 * effect; `unknown` means the request may have reached the peer and no reliable answer came
 * back. Nothing here claims a remote effect happened exactly once — only that v10r sent it at
 * most once.
 */
import { createHash, randomUUID } from 'node:crypto';
import {
	claimExternalOperation,
	type ExternalOperationRow,
	type ExternalSettlement,
	getExternalOperation,
	healInterruptedExternalOperation,
	markExternalDispatched,
	refusePendingExternalOperation,
	settleExternalOperation,
} from '#lib/server/db/ai/external-operations.ts';
import { saveMessages } from '#lib/server/db/ai/mutations.ts';
import { approveProposal, EXECUTION_LEASE_MS, getProposalWithExpiry } from '#lib/server/db/ai/proposals.ts';
import type { ExternalOperationCard, ExternalOperationReceiptView } from '#lib/types/ai-proposal.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import type {
	ExternalDisclosure,
	ExternalExecutionResult,
	ExternalOperationAdapter,
	ExternalOperationAdapters,
	ExternalOperationBinding,
	ExternalOperationRequest,
	ExternalOutcome,
} from './contract';
import { externalArgumentBytes, externalOutgoingDocument } from './outgoing-arguments';
import { externalArgumentsDigest, type PreparedExternalOperation } from './prepare';

/** The `agent_external_operation` values a prepared operation is persisted as (the proposal adds id and expiry). */
export function externalOperationRecord(prepared: PreparedExternalOperation) {
	const { request, binding } = prepared;
	return {
		userId: request.userId,
		protocol: request.protocol,
		peerId: request.peerId,
		operation: request.operation,
		toolName: prepared.toolName,
		endpoint: binding.endpoint,
		contractDigest: binding.contractDigest,
		policyDigest: binding.policyDigest,
		argumentsDigest: binding.argumentsDigest,
		arguments: JSON.parse(canonicalJson(request.arguments)) as Record<string, unknown>,
		disclosure: prepared.disclosure as unknown as Record<string, unknown>,
	};
}

/**
 * The card's view of a prepared (or stored) operation: the disclosure, and the complete outgoing
 * arguments bound to the approval by `argumentsDigest` (`outgoing-arguments.ts`).
 */
export function externalOperationCard(
	toolName: string,
	disclosure: ExternalDisclosure,
	outgoing: { arguments: unknown; argumentsDigest: string },
): ExternalOperationCard {
	return {
		toolName,
		protocol: disclosure.protocol,
		peerId: disclosure.peerId,
		peerLabel: disclosure.peerLabel,
		destination: disclosure.destination,
		operation: disclosure.operation,
		fields: [...disclosure.fields],
		preview: disclosure.preview,
		bytes: disclosure.bytes,
		credential: disclosure.credential,
		mutates: disclosure.mutates,
		reversibility: disclosure.reversibility,
		grant: 'once',
		contentClass: disclosure.contentClass,
		quotedFrom: [...disclosure.quotedFrom],
		outgoing: {
			document: externalOutgoingDocument(outgoing.arguments),
			digest: outgoing.argumentsDigest,
			bytes: externalArgumentBytes(outgoing.arguments),
			envelope: (disclosure.envelope ?? []).map((entry) => ({ field: entry.field, value: entry.value })),
		},
	};
}

const SETTLED = new Set(['succeeded', 'failed', 'unknown', 'refused']);

/** The receipt as the client and the trace read it, from the stored row. */
export function externalReceiptView(row: ExternalOperationRow): ExternalOperationReceiptView {
	return {
		status: row.status,
		outcome: SETTLED.has(row.status) ? (row.status as ExternalOutcome) : null,
		delivery: row.delivery,
		reason: row.reason,
		result: row.result?.text || null,
		settledAt: row.settledAt?.toISOString() ?? null,
	};
}

/** Who is executing, as the approve request's session says NOW (not as it was at proposal time). */
export interface ExternalOperationActor {
	userId: string;
	role: 'admin' | 'user';
}

/** Why the approve door refused without claiming anything (nothing recorded, nothing sent). */
export type ExternalApprovalRefusal =
	| 'not_found'
	| 'not_owner'
	| 'quoted_content_unauthorized'
	| 'expired'
	| 'state_changed';

export type ExternalReceiptMessage = { id: string; text: string };

export type ExternalApproval =
	| { kind: 'receipt'; row: ExternalOperationRow; receiptMessage: ExternalReceiptMessage | null }
	| { kind: 'in_flight'; row: ExternalOperationRow }
	| { kind: 'refused'; reason: ExternalApprovalRefusal };

export interface ExternalOperationExecutorOptions {
	adapters: ExternalOperationAdapters;
	/** How long a claim may go unsettled before recovery settles it; default the proposal lease. */
	leaseMs?: number;
}

export interface ApproveExternalOptions {
	authorizeQuotedContent?: boolean;
	signal?: AbortSignal;
}

const OUTCOME_SENTENCE: Record<ExternalOutcome, string> = {
	succeeded: 'the peer reported success (a claim: v10r did not observe the effect)',
	failed: 'it failed',
	unknown: 'its outcome is unknown — the request may have reached the peer; it will not be re-sent',
	refused: 'v10r refused it before sending anything',
};

/** The deterministic receipt message: what the user reads under the card and the model reads next turn. */
export function externalReceiptText(row: ExternalOperationRow): string {
	const disclosure = row.disclosure as unknown as ExternalDisclosure;
	const outcome = SETTLED.has(row.status) ? (row.status as ExternalOutcome) : 'unknown';
	const head = `External call "${row.operation}" on ${disclosure.peerLabel ?? row.peerId} (${disclosure.destination ?? row.endpoint}): ${OUTCOME_SENTENCE[outcome]}${row.reason ? ` [${row.reason}]` : ''}.`;
	const task = row.result?.remoteTask?.taskId ? `\nRemote task: ${row.result.remoteTask.taskId}.` : '';
	return row.result?.text ? `${head}${task}\n${row.result.text}` : `${head}${task}`;
}

/**
 * The receipt message's id, derived from the operation: one message per operation whoever writes
 * it — the executor that settled the row, or a later reader rebuilding a message that was never
 * written (a heal settles without one; a crash or a failed insert after the settlement loses it).
 * The insert claims this id, so a second writer finds it taken and nothing is duplicated.
 */
export function externalReceiptMessageId(proposalId: string): string {
	const hex = createHash('sha256').update(`v10r:external-receipt:${proposalId}`).digest('hex');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** A peer-supplied id is kept only in a plain id shape — it is shown outside the untrusted wrapper. */
const REMOTE_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const remoteId = (id: string | null | undefined) => (id && REMOTE_ID.test(id) ? id : null);

function settlementOf(result: ExternalExecutionResult): ExternalSettlement {
	const remoteTask = result.remoteTask
		? { taskId: remoteId(result.remoteTask.taskId), contextId: remoteId(result.remoteTask.contextId) }
		: undefined;
	return {
		status: result.outcome,
		delivery: result.delivery,
		reason: result.outcome === 'succeeded' ? null : (result.reason ?? result.outcome),
		result:
			result.result === undefined && !remoteTask
				? null
				: { text: result.result ?? '', flags: [], ...(remoteTask ? { remoteTask } : {}) },
	};
}

const refusedBeforeSending = (reason: string): ExternalSettlement => ({
	status: 'refused',
	delivery: 'not_sent',
	reason,
	result: null,
});

/**
 * One executor. Stateless apart from its adapters: any number of instances, on any number of
 * hosts, share the claim through the database, which is what the concurrency test races.
 */
export function createExternalOperationExecutor(options: ExternalOperationExecutorOptions) {
	const leaseMs = options.leaseMs ?? EXECUTION_LEASE_MS;

	/**
	 * The receipt message for a settled row, written if it is missing — rebuilt from the row
	 * (`externalReceiptText` is deterministic), never by running anything again. Answers the
	 * message whether this call wrote it or found it; the client keys receipts by id.
	 */
	async function ensureReceiptMessage(
		conversationId: string,
		row: ExternalOperationRow,
	): Promise<ExternalReceiptMessage | null> {
		// Refused before any claim (expired, rejected): nothing was approved to run, so no receipt line.
		if (!SETTLED.has(row.status) || (row.status === 'refused' && row.claimedAt === null)) return null;
		const text = externalReceiptText(row);
		const id = externalReceiptMessageId(row.proposalId);
		try {
			const saved = await saveMessages(conversationId, row.userId, [{ id, role: 'assistant', content: text }], {
				claim: id,
			});
			return saved === 'not_saved' ? null : { id, text };
		} catch (err) {
			// The row already holds the truth; the next read of the proposal writes the message.
			console.error('[external-operations] Failed to persist the receipt message:', err);
			return null;
		}
	}

	async function answer(proposalId: string, fallback: ExternalOperationRow): Promise<ExternalApproval> {
		const row = (await getExternalOperation(proposalId)) ?? fallback;
		if (!SETTLED.has(row.status)) return { kind: 'in_flight', row };
		const proposal = await getProposalWithExpiry(proposalId);
		const receiptMessage = proposal ? await ensureReceiptMessage(proposal.proposal.conversationId, row) : null;
		return { kind: 'receipt', row, receiptMessage };
	}

	async function run(
		row: ExternalOperationRow,
		claimToken: string,
		adapter: ExternalOperationAdapter | undefined,
		signal?: AbortSignal,
	): Promise<ExternalOperationRow | null> {
		const settle = (settlement: ExternalSettlement) => settleExternalOperation(row.proposalId, claimToken, settlement);
		if (!adapter) return settle(refusedBeforeSending('protocol_unavailable'));
		if (externalArgumentsDigest(row.arguments) !== row.argumentsDigest) {
			return settle(refusedBeforeSending('arguments_tampered'));
		}
		const binding: ExternalOperationBinding = {
			protocol: row.protocol,
			peerId: row.peerId,
			endpoint: row.endpoint,
			operation: row.operation,
			contractDigest: row.contractDigest,
			policyDigest: row.policyDigest,
			argumentsDigest: row.argumentsDigest,
			userId: row.userId,
			expiresAt: row.expiresAt.toISOString(),
		};
		let verified: Awaited<ReturnType<ExternalOperationAdapter['verify']>>;
		try {
			verified = await adapter.verify(binding);
		} catch {
			verified = { ok: false, reason: 'verification_failed' };
		}
		if (!verified.ok) return settle(refusedBeforeSending(verified.reason));
		if (signal?.aborted) return settle(refusedBeforeSending('cancelled'));

		// From here the request may leave. A crash after this line heals to `unknown`.
		if (!(await markExternalDispatched(row.proposalId, claimToken))) return null;

		const request: ExternalOperationRequest = {
			protocol: row.protocol,
			peerId: row.peerId,
			operation: row.operation,
			arguments: row.arguments,
			userId: row.userId,
			conversationId: null,
		};
		let result: ExternalExecutionResult;
		try {
			result = await adapter.execute(request, binding, signal ?? new AbortController().signal);
		} catch {
			// An adapter that threw after dispatch cannot say what reached the peer.
			result = { outcome: 'unknown', delivery: 'possibly_sent', reason: 'adapter_error' };
		}
		return settle(settlementOf(result));
	}

	return {
		/** The approve door: approve, claim, verify, execute once, record — or answer what is already recorded. */
		async approve(
			proposalId: string,
			actor: ExternalOperationActor,
			approveOptions: ApproveExternalOptions = {},
		): Promise<ExternalApproval> {
			let row = await getExternalOperation(proposalId);
			if (!row) return { kind: 'refused', reason: 'not_found' };
			if (row.userId !== actor.userId) return { kind: 'refused', reason: 'not_owner' };

			if (row.status === 'claimed' || row.status === 'dispatched') {
				row = (await healInterruptedExternalOperation(proposalId, leaseMs)) ?? row;
			}
			if (row.status !== 'pending') return answer(proposalId, row);

			const disclosure = row.disclosure as unknown as ExternalDisclosure;
			if (disclosure.contentClass === 'quotes_read_content' && approveOptions.authorizeQuotedContent !== true) {
				return { kind: 'refused', reason: 'quoted_content_unauthorized' };
			}

			const current = await getProposalWithExpiry(proposalId);
			if (!current) return { kind: 'refused', reason: 'not_found' };
			if (current.proposal.status === 'pending') {
				const approved = await approveProposal(proposalId, actor.userId);
				if (!approved) {
					const fresh = await getProposalWithExpiry(proposalId);
					if (fresh?.isExpired) {
						await refusePendingExternalOperation(proposalId, 'expired');
						return { kind: 'refused', reason: 'expired' };
					}
					return { kind: 'refused', reason: 'state_changed' };
				}
			} else if (current.proposal.status !== 'approved') {
				return { kind: 'refused', reason: 'state_changed' };
			}

			const claimToken = randomUUID();
			const claimed = await claimExternalOperation(proposalId, actor.userId, claimToken);
			if (!claimed) {
				const fresh = await getProposalWithExpiry(proposalId);
				if (fresh?.isExpired && fresh.proposal.status === 'approved') {
					await refusePendingExternalOperation(proposalId, 'expired');
					return { kind: 'refused', reason: 'expired' };
				}
				return answer(proposalId, row);
			}

			const settled = await run(claimed, claimToken, options.adapters[claimed.protocol], approveOptions.signal);
			if (!settled) return answer(proposalId, claimed);
			const receiptMessage = await ensureReceiptMessage(current.proposal.conversationId, settled);
			return { kind: 'receipt', row: settled, receiptMessage };
		},

		/**
		 * Recovery for a reader (the status door), never a re-run:
		 *  - a claim past its lease is settled from the side of the wire it stopped on;
		 *  - a pending row whose approval can no longer run (expired on the database clock, or
		 *    the proposal rejected / expired) is `refused` / `not_sent`, so the row and the
		 *    proposal never disagree about whether it may still run;
		 *  - a settled row gets its receipt message if it has none (rebuilt from the row).
		 * Null when the proposal has no external operation.
		 */
		async recover(
			proposalId: string,
		): Promise<{ row: ExternalOperationRow; receiptMessage: ExternalReceiptMessage | null } | null> {
			let row = await getExternalOperation(proposalId);
			if (!row) return null;
			const proposal = await getProposalWithExpiry(proposalId);
			if (!proposal) return { row, receiptMessage: null };
			if (row.status === 'claimed' || row.status === 'dispatched') {
				row = (await healInterruptedExternalOperation(proposalId, leaseMs)) ?? row;
			}
			if (row.status === 'pending') {
				const status = proposal.proposal.status;
				const dead = proposal.isExpired || (status !== 'pending' && status !== 'approved');
				if (dead) {
					row =
						(await refusePendingExternalOperation(proposalId, proposal.isExpired ? 'expired' : `proposal_${status}`)) ??
						row;
				}
			}
			return { row, receiptMessage: await ensureReceiptMessage(proposal.proposal.conversationId, row) };
		},
	};
}

export type ExternalOperationExecutor = ReturnType<typeof createExternalOperationExecutor>;
