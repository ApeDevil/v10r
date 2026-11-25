/**
 * An approved external call, and the check that what runs is exactly what was approved.
 *
 * A human approves ONE call: this peer, at this endpoint, this remote tool as its contract read
 * then, these exact arguments, for this user, under this operator policy, until this time. A
 * `PeerCallApproval` records all of it, and `verifyApprovedPeerCall` runs at the execution
 * boundary — after the approval, immediately before the call — comparing each binding with the
 * live state and refusing with the specific reason the first one breaks:
 *
 *   user_mismatch · expired · arguments_tampered · arguments_mismatch · peer_mismatch ·
 *   endpoint_changed · tool_revoked · permission_changed · peer_unreachable · tool_removed ·
 *   contract_drift · tool_withheld · disclosure_refused
 *
 * The tool is re-listed from the peer (a fresh `tools/list`, never a cached one) and
 * re-fingerprinted. **A fingerprint proves the advertised contract, not behaviour**: it shows
 * the name, description, schemas and annotations are the ones the user saw, so a peer cannot
 * swap the tool's stated meaning between approval and execution. It cannot show what the peer's
 * code does with the arguments, nor that the peer will not change between this check and the
 * call a few milliseconds later. Those are the peer's to keep; the receipt says what came back.
 */
import { createHash } from 'node:crypto';
import type { ToolRisk } from '#lib/types/ai-tools.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { PEER_APPROVAL_TTL_MS } from './config';
import { type DisclosureRefusal, type PeerCallDisclosure, preparePeerArguments } from './disclosure';
import { type McpPeer, type PeerToolReversibility, peerToolReversibility } from './peer';
import { listPeerTools, type PeerConnection } from './peer-tools';
import { type ProjectedPeerTool, projectPeerTools } from './projection';

/** One human approval of one external call — every input the call depends on, bound. */
export interface PeerCallApproval {
	id: string;
	/** The user who approved it; only they can execute it. */
	userId: string;
	peerId: string;
	/** The peer URL (`href`) at approval time. */
	endpoint: string;
	remoteName: string;
	/** The model-facing name the user saw. */
	toolName: string;
	/** The tool's contract fingerprint when it was approved. */
	fingerprint: string;
	/** sha-256 of the operator policy that applies to this tool (`peerPermissionDigest`). */
	permissionDigest: string;
	/** The arguments as they will be sent (canonical JSON, parsed back). */
	arguments: Record<string, unknown>;
	/** sha-256 of the canonical arguments. */
	argumentsHash: string;
	disclosure: PeerCallDisclosure;
	risk: ToolRisk;
	reversibility: PeerToolReversibility;
	approvedAt: string;
	expiresAt: string;
}

export type PeerCallRefusal =
	| 'user_mismatch'
	| 'expired'
	| 'arguments_tampered'
	| 'arguments_mismatch'
	| 'peer_mismatch'
	| 'endpoint_changed'
	| 'tool_revoked'
	| 'permission_changed'
	| 'peer_unreachable'
	| 'tool_removed'
	| 'contract_drift'
	| 'tool_withheld'
	| 'disclosure_refused';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** sha-256 of the canonical JSON of `args` — what an approval binds the arguments by. */
export function peerArgumentsHash(args: unknown): string {
	return sha256(canonicalJson(args));
}

/**
 * The operator policy one tool's call depends on, as a digest: the endpoint, the credential
 * reference, whether the tool is allowed and read-only, its rule, the disclosure bound and the
 * private destinations. A change to any of them — not to another tool's entry — invalidates
 * the approvals pending for this tool.
 */
export function peerPermissionDigest(peer: McpPeer, remoteName: string): string {
	return sha256(
		canonicalJson({
			url: peer.url,
			auth: peer.auth,
			allowed: peer.policy.allowTools.includes(remoteName),
			readOnly: peer.policy.readOnlyTools.includes(remoteName),
			rule: peer.policy.toolRules?.[remoteName] ?? null,
			disclosure: peer.disclosure ?? null,
			privateDestinations: [...(peer.privateDestinations ?? [])].map((d) => `${d.cidr}|${d.port}`).sort(),
		}),
	);
}

export interface CreatePeerCallApprovalInput {
	id: string;
	userId: string;
	peer: McpPeer;
	projected: ProjectedPeerTool;
	arguments: unknown;
	now?: Date;
	ttlMs?: number;
	/** The peer connection's resolver, so arguments carrying the peer secret are refused. */
	resolveSecret?: (secretRef: string) => string | undefined;
}

export type PeerCallApprovalDraft =
	| { ok: true; approval: PeerCallApproval }
	| { ok: false; reason: DisclosureRefusal | 'peer_mismatch' };

/**
 * The record a human approves. Built from the projected tool the model called and the
 * arguments it proposed — refused here already when the arguments would fail disclosure, so a
 * call that can never run is never put in front of a human.
 */
export function createPeerCallApproval(input: CreatePeerCallApprovalInput): PeerCallApprovalDraft {
	const { peer, projected } = input;
	if (projected.descriptor.peerId !== peer.id) return { ok: false, reason: 'peer_mismatch' };
	const prepared = preparePeerArguments(peer, projected.tool, input.arguments, input.resolveSecret);
	if (!prepared.ok) return prepared;
	const now = input.now ?? new Date();
	return {
		ok: true,
		approval: {
			id: input.id,
			userId: input.userId,
			peerId: peer.id,
			endpoint: new URL(peer.url).href,
			remoteName: projected.descriptor.remoteName,
			toolName: projected.descriptor.name,
			fingerprint: projected.descriptor.fingerprint,
			permissionDigest: peerPermissionDigest(peer, projected.descriptor.remoteName),
			arguments: prepared.arguments,
			argumentsHash: sha256(prepared.canonical),
			disclosure: prepared.disclosure,
			risk: projected.descriptor.risk,
			reversibility: peerToolReversibility(peer, projected.descriptor.remoteName),
			approvedAt: now.toISOString(),
			expiresAt: new Date(now.getTime() + (input.ttlMs ?? PEER_APPROVAL_TTL_MS)).toISOString(),
		},
	};
}

export interface VerifyPeerCallContext {
	/** The peer config as it is NOW — not the one the approval was made under. */
	peer: McpPeer;
	connection: PeerConnection;
	/** The user asking to execute. */
	userId: string;
	/** The arguments the executing side means to send (e.g. the stored proposal step's). */
	arguments?: unknown;
	now?: Date;
	signal?: AbortSignal;
	listTimeoutMs?: number;
}

export type PeerCallVerification =
	| { ok: true; projected: ProjectedPeerTool; arguments: Record<string, unknown>; disclosure: PeerCallDisclosure }
	| { ok: false; reason: PeerCallRefusal };

const refuse = (reason: PeerCallRefusal): PeerCallVerification => ({ ok: false, reason });

/** Every binding of `approval` against the live state; the first that breaks is the reason. */
export async function verifyApprovedPeerCall(
	approval: PeerCallApproval,
	context: VerifyPeerCallContext,
): Promise<PeerCallVerification> {
	const { peer, connection } = context;
	if (context.userId !== approval.userId) return refuse('user_mismatch');
	if ((context.now ?? new Date()).getTime() >= Date.parse(approval.expiresAt)) return refuse('expired');
	if (peerArgumentsHash(approval.arguments) !== approval.argumentsHash) return refuse('arguments_tampered');
	if (context.arguments !== undefined && peerArgumentsHash(context.arguments) !== approval.argumentsHash) {
		return refuse('arguments_mismatch');
	}
	if (peer.id !== approval.peerId || connection.peer.id !== peer.id) return refuse('peer_mismatch');
	if (new URL(peer.url).href !== approval.endpoint || new URL(connection.peer.url).href !== approval.endpoint) {
		return refuse('endpoint_changed');
	}
	if (!peer.policy.allowTools.includes(approval.remoteName)) return refuse('tool_revoked');
	if (peerPermissionDigest(peer, approval.remoteName) !== approval.permissionDigest) {
		return refuse('permission_changed');
	}

	let listing: Awaited<ReturnType<typeof listPeerTools>>;
	try {
		listing = await listPeerTools(connection, { signal: context.signal, timeoutMs: context.listTimeoutMs });
	} catch {
		return refuse('peer_unreachable');
	}
	const live = listing.tools.find((tool) => tool.name === approval.remoteName);
	if (!live) return refuse('tool_removed');
	if (live.fingerprint !== approval.fingerprint) return refuse('contract_drift');

	// The approval is the pin for this one call: project the live listing under it.
	const projection = projectPeerTools(peer, listing, { [approval.remoteName]: approval.fingerprint });
	const projected = projection.tools.find((t) => t.descriptor.remoteName === approval.remoteName);
	if (!projected || projected.descriptor.name !== approval.toolName) return refuse('tool_withheld');

	const prepared = preparePeerArguments(peer, live, approval.arguments, connection.resolveSecret);
	if (!prepared.ok || peerArgumentsHash(prepared.arguments) !== approval.argumentsHash) {
		return refuse('disclosure_refused');
	}
	return { ok: true, projected, arguments: prepared.arguments, disclosure: prepared.disclosure };
}
