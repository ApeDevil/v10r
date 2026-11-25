/**
 * Executing an approved external call — once, verified, with a receipt that does not overclaim.
 *
 * `executeApprovedPeerCall(approval, deps)` is what the approve door will call for an `mcp_*`
 * step (not wired yet). In order:
 *
 *  1. **Owner.** Only the approving user may execute; anyone else gets a `refused` receipt that
 *     is NOT recorded, so a stranger cannot burn someone else's approval.
 *  2. **Once.** The receipt store is claimed by approval id before anything else. A second call
 *     returns the first receipt — never a second `tools/call`. A claim with no receipt yet (a
 *     concurrent run, or one that died mid-call) answers `unknown`, because nobody can say
 *     whether that call reached the peer.
 *  3. **Verify** (`verifyApprovedPeerCall`): re-list, re-fingerprint, compare every binding.
 *     Any break is a `refused` receipt, recorded — the approval is spent; re-approve.
 *  4. **Call once**, with a timeout and the caller's `AbortSignal`. There is no retry: not in
 *     this function, and not in the guarded transport. A mutation whose outcome is unknown
 *     (a timeout after the request left, a reset mid-response, an abort in flight) is reported
 *     as `unknown`, never re-sent — re-sending could do it twice.
 *
 * The receipt's `outcome` is one of four words, each a claim of a different strength:
 *
 *  - `succeeded` — the peer ANSWERED and reported success. A claim (`security.md`: requested,
 *    executed, confirmed — and claimed): v10r did not observe the effect.
 *  - `failed` — the peer answered with an error, or provably nothing was sent (the socket never
 *    connected, the guard refused before sending).
 *  - `unknown` — the request may have reached the peer, and no reliable answer came back.
 *  - `refused` — a pre-execution check failed; nothing was sent.
 *
 * `delivery` says the same from the wire's side (`not_sent` · `sent` · `possibly_sent`), and
 * `reversibility` is the operator's word for the tool (default `unknown`) — never assumed.
 * The peer's answer stays wrapped as untrusted content in `result`.
 */

import { provablyNotSent } from '#lib/server/http/pinned-fetch.ts';
import { type PeerCallApproval, type PeerCallRefusal, verifyApprovedPeerCall } from './call-approval';
import { MAX_PEER_RESULT_CHARS, PEER_CALL_TIMEOUT_MS } from './config';
import type { PeerCallDisclosure } from './disclosure';
import { PeerEndpointError, PRE_SEND_PROBLEMS } from './endpoint-guard';
import type { McpPeer, PeerToolReversibility } from './peer';
import {
	callDefinition,
	isRequestTimeout,
	isResponseTooLarge,
	type PeerCallResult,
	readPeerCallResult,
	settledPeerCall,
} from './peer-call';
import type { PeerConnection } from './peer-tools';

export type PeerReceiptOutcome = 'succeeded' | 'failed' | 'unknown' | 'refused';

export type PeerCallDelivery = 'not_sent' | 'sent' | 'possibly_sent';

/** Why a receipt is not `succeeded`. */
export type PeerReceiptReason =
	| PeerCallRefusal
	| 'cancelled'
	| 'execution_already_claimed'
	| 'peer_reported_error'
	| 'not_sent'
	| 'timeout'
	| 'response_too_large'
	| 'transport_error';

export interface PeerCallReceipt {
	approvalId: string;
	peerId: string;
	remoteName: string;
	toolName: string;
	outcome: PeerReceiptOutcome;
	/** Null exactly when `outcome` is `succeeded`. */
	reason: PeerReceiptReason | null;
	delivery: PeerCallDelivery;
	reversibility: PeerToolReversibility;
	/** What was (or would have been) sent, and to whom. */
	disclosure: PeerCallDisclosure;
	/** The peer's answer, wrapped; for a refusal or failure, v10r's own wrapped sentence. */
	result: PeerCallResult;
	settledAt: string;
}

/**
 * Where receipts live, keyed by approval id. `claim` must be atomic (a primary-key insert in a
 * database store): the first caller gets `null` and must `record` a receipt; every later caller
 * gets the recorded receipt, or `'claimed'` while the first has none yet.
 */
export interface PeerCallReceiptStore {
	claim(approvalId: string): Promise<PeerCallReceipt | 'claimed' | null>;
	record(receipt: PeerCallReceipt): Promise<void>;
}

/** A process-local store: tests, the interop run, and the contract a durable store must keep. */
export function createInMemoryPeerCallReceiptStore(): PeerCallReceiptStore & {
	get(approvalId: string): PeerCallReceipt | 'claimed' | undefined;
} {
	const entries = new Map<string, PeerCallReceipt | 'claimed'>();
	return {
		async claim(approvalId) {
			const existing = entries.get(approvalId);
			if (existing !== undefined) return existing;
			entries.set(approvalId, 'claimed');
			return null;
		},
		async record(receipt) {
			entries.set(receipt.approvalId, receipt);
		},
		get: (approvalId) => entries.get(approvalId),
	};
}

export interface ExecutePeerCallDeps {
	/** The peer config as it is now. */
	peer: McpPeer;
	connection: PeerConnection;
	/** The user executing (the approve request's session user). */
	userId: string;
	store: PeerCallReceiptStore;
	/** The arguments the executing side holds for the step, compared with the approval's. */
	arguments?: unknown;
	now?: () => Date;
	timeoutMs?: number;
	signal?: AbortSignal;
	maxResultChars?: number;
}

const SENTENCES: Record<PeerReceiptReason, string> = {
	user_mismatch: 'Not run: the approval belongs to another user.',
	expired: 'Not run: the approval expired.',
	arguments_tampered: 'Not run: the approved arguments do not match their hash.',
	arguments_mismatch: 'Not run: the arguments differ from the approved ones.',
	peer_mismatch: 'Not run: the peer is not the one approved.',
	endpoint_changed: 'Not run: the peer endpoint changed since the approval.',
	tool_revoked: 'Not run: the operator no longer allows this tool.',
	permission_changed: "Not run: the operator's policy for this tool changed since the approval.",
	peer_unreachable: 'Not run: the peer could not be re-checked.',
	tool_removed: 'Not run: the peer no longer lists this tool.',
	contract_drift: 'Not run: the tool changed since it was approved.',
	tool_withheld: 'Not run: the tool is withheld from the catalogue.',
	disclosure_refused: 'Not run: the arguments no longer pass the disclosure check.',
	cancelled: 'The call was cancelled.',
	execution_already_claimed:
		'Another execution of this approval is in progress or was interrupted; its outcome is unknown.',
	peer_reported_error: 'The external tool reported an error.',
	not_sent: 'The external tool could not be reached; nothing was sent.',
	timeout: 'The external tool did not answer in time; whether it acted is unknown.',
	response_too_large: 'The external tool answered more than v10r reads; whether it acted is unknown.',
	transport_error: 'The connection failed after the request may have left; whether it acted is unknown.',
};

function receiptFor(
	approval: PeerCallApproval,
	outcome: PeerReceiptOutcome,
	reason: PeerReceiptReason | null,
	delivery: PeerCallDelivery,
	now: Date,
	result?: PeerCallResult,
	disclosure: PeerCallDisclosure = approval.disclosure,
): PeerCallReceipt {
	return {
		approvalId: approval.id,
		peerId: approval.peerId,
		remoteName: approval.remoteName,
		toolName: approval.toolName,
		outcome,
		reason,
		delivery,
		reversibility: approval.reversibility,
		disclosure,
		result: result ?? settledPeerCall(approval.toolName, 'failed', reason ? SENTENCES[reason] : ''),
		settledAt: now.toISOString(),
	};
}

/** How a thrown `tools/call` ended: provably unsent, or unknown — never "safe to retry". */
function classifyThrown(
	error: unknown,
	signal?: AbortSignal,
): { outcome: PeerReceiptOutcome; reason: PeerReceiptReason; delivery: PeerCallDelivery } {
	for (let e: unknown = error, depth = 0; e && depth < 6; depth++) {
		if (e instanceof PeerEndpointError && PRE_SEND_PROBLEMS.has(e.problem)) {
			return { outcome: 'failed', reason: 'not_sent', delivery: 'not_sent' };
		}
		e = (e as { cause?: unknown }).cause;
	}
	if (provablyNotSent(error)) return { outcome: 'failed', reason: 'not_sent', delivery: 'not_sent' };
	if (signal?.aborted) return { outcome: 'unknown', reason: 'cancelled', delivery: 'possibly_sent' };
	if (isRequestTimeout(error)) return { outcome: 'unknown', reason: 'timeout', delivery: 'possibly_sent' };
	if (isResponseTooLarge(error)) return { outcome: 'unknown', reason: 'response_too_large', delivery: 'sent' };
	return { outcome: 'unknown', reason: 'transport_error', delivery: 'possibly_sent' };
}

/** Runs one approved external call at most once and answers its receipt. Never throws for the call's own failure. */
export async function executeApprovedPeerCall(
	approval: PeerCallApproval,
	deps: ExecutePeerCallDeps,
): Promise<PeerCallReceipt> {
	const clock = deps.now ?? (() => new Date());
	if (deps.userId !== approval.userId) return receiptFor(approval, 'refused', 'user_mismatch', 'not_sent', clock());

	const prior = await deps.store.claim(approval.id);
	if (prior === 'claimed') {
		return receiptFor(approval, 'unknown', 'execution_already_claimed', 'possibly_sent', clock());
	}
	if (prior) return prior;

	const settle = async (receipt: PeerCallReceipt) => {
		await deps.store.record(receipt);
		return receipt;
	};

	const verification = await verifyApprovedPeerCall(approval, {
		peer: deps.peer,
		connection: deps.connection,
		userId: deps.userId,
		arguments: deps.arguments,
		now: clock(),
		signal: deps.signal,
	});
	if (!verification.ok) return settle(receiptFor(approval, 'refused', verification.reason, 'not_sent', clock()));
	if (deps.signal?.aborted) return settle(receiptFor(approval, 'refused', 'cancelled', 'not_sent', clock()));

	const { projected, disclosure } = verification;
	try {
		const answer = await deps.connection.client.callTool(
			{ name: approval.remoteName, arguments: verification.arguments },
			{
				timeout: deps.timeoutMs ?? PEER_CALL_TIMEOUT_MS,
				signal: deps.signal,
				toolDefinition: callDefinition(projected),
			},
		);
		const result = readPeerCallResult(deps.connection, projected, answer, deps.maxResultChars ?? MAX_PEER_RESULT_CHARS);
		return settle(
			answer.isError
				? receiptFor(approval, 'failed', 'peer_reported_error', 'sent', clock(), result, disclosure)
				: receiptFor(approval, 'succeeded', null, 'sent', clock(), result, disclosure),
		);
	} catch (error) {
		const { outcome, reason, delivery } = classifyThrown(error, deps.signal);
		return settle(receiptFor(approval, outcome, reason, delivery, clock(), undefined, disclosure));
	}
}
