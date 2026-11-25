/**
 * The MCP half of an external operation — `ExternalOperationAdapter` for `protocol: 'mcp'`.
 *
 * It wraps what this module already proves: `createPeerCallApproval` (disclosure check, secret
 * refusal, the fingerprint and permission digest an approval binds), `verifyApprovedPeerCall`
 * (re-list, re-fingerprint, compare every binding), `executeApprovedPeerCall` (one `tools/call`,
 * no retry, a receipt that does not overclaim). The external-operations domain owns the claim
 * and the persistence; this adapter owns the MCP policy and never stores anything — its receipt
 * store is a pass-through, because the domain's database claim is the "once".
 *
 * Authority, revalidated at every step from the operator's CURRENT directory row:
 *  - the peer is live (not revoked) and its audience admits the actor's role NOW;
 *  - the tool is activated, at the pin the operator reviewed;
 *  - the policy digest — the MCP permission digest (endpoint, credential reference, allow list,
 *    the tool's rule: fields, mutates, reversibility; disclosure bound; private destinations),
 *    the pin, the audience — equals the one the approval holds.
 * A peer's annotations never enter any of it.
 */
import { createHash } from 'node:crypto';
import {
	type ExternalExecutionResult,
	type ExternalOperationAdapter,
	type ExternalOperationBinding,
	type ExternalOperationRequest,
	type ExternalPreparation,
	previewExternalArguments,
} from '#lib/server/external-operations/index.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { executeApprovedPeerCall, type PeerCallReceiptStore } from './approved-execution';
import { createPeerCallApproval, type PeerCallApproval, peerPermissionDigest } from './call-approval';
import { peerCallCredential } from './disclosure';
import { peerToolMutates, peerToolReversibility } from './peer';
import { audienceAdmits, connectDirectoryPeer, type DirectoryPeer, loadDirectoryPeer } from './peer-directory';
import { listPeerTools, type PeerConnection } from './peer-tools';
import { peerToolName, projectPeerTools } from './projection';

export interface McpOperationAdapterOptions {
	/** Who is proposing or executing, as the request's session says now. */
	actor: { userId: string; role: 'admin' | 'user' };
	/** The operator's directory; default the database. */
	loadPeer?: (peerId: string) => Promise<DirectoryPeer | null>;
	/** How a directory peer is connected; default `connectDirectoryPeer`. */
	connect?: (entry: DirectoryPeer, signal?: AbortSignal) => Promise<PeerConnection>;
	now?: () => Date;
}

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** The digest an MCP approval binds as `policyDigest`: the permission digest, the pin, the audience. */
export function mcpPolicyDigest(entry: DirectoryPeer, remoteName: string): string {
	return sha256(
		canonicalJson({
			permission: peerPermissionDigest(entry.peer, remoteName),
			pin: entry.pins[remoteName] ?? null,
			audience: entry.audience,
		}),
	);
}

/** Every call's own receipt lives in `agent_external_operation`; the MCP layer keeps none. */
const passThroughStore: PeerCallReceiptStore = { claim: async () => null, record: async () => {} };

async function withConnection<T>(
	connect: NonNullable<McpOperationAdapterOptions['connect']>,
	entry: DirectoryPeer,
	signal: AbortSignal | undefined,
	use: (connection: PeerConnection) => Promise<T>,
): Promise<T> {
	const connection = await connect(entry, signal);
	try {
		return await use(connection);
	} finally {
		await connection.close().catch(() => {});
	}
}

export function createMcpOperationAdapter(options: McpOperationAdapterOptions): ExternalOperationAdapter {
	const loadPeer = options.loadPeer ?? loadDirectoryPeer;
	const connect = options.connect ?? ((entry, signal) => connectDirectoryPeer(entry.peer, { signal }));
	const clock = options.now ?? (() => new Date());
	const { actor } = options;

	/** The directory checks shared by prepare and verify; a reason string when one fails. */
	async function authority(peerId: string, remoteName: string, userId: string) {
		if (userId !== actor.userId) return { ok: false as const, reason: 'user_mismatch' };
		const entry = await loadPeer(peerId);
		if (!entry) return { ok: false as const, reason: 'peer_revoked' };
		if (!audienceAdmits(entry.audience, actor.role)) return { ok: false as const, reason: 'not_permitted' };
		if (!entry.pins[remoteName]) return { ok: false as const, reason: 'tool_revoked' };
		return { ok: true as const, entry };
	}

	return {
		protocol: 'mcp',

		async prepare(request: ExternalOperationRequest): Promise<ExternalPreparation> {
			const checked = await authority(request.peerId, request.operation, request.userId);
			if (!checked.ok) return checked;
			const { entry } = checked;
			let approval: PeerCallApproval;
			try {
				const drafted = await withConnection(connect, entry, undefined, async (connection) => {
					const projection = projectPeerTools(entry.peer, await listPeerTools(connection), entry.pins);
					const projected = projection.tools.find((t) => t.descriptor.remoteName === request.operation);
					if (!projected) {
						const withheld = projection.withheld.find((w) => w.remoteName === request.operation);
						return {
							ok: false as const,
							reason: withheld?.reason === 'changed_since_approval' ? 'tool_drift' : 'tool_unavailable',
						};
					}
					return createPeerCallApproval({
						id: 'proposed',
						userId: request.userId,
						peer: entry.peer,
						projected,
						arguments: request.arguments,
						now: clock(),
						resolveSecret: connection.resolveSecret,
					});
				});
				if (!drafted.ok) return { ok: false, reason: drafted.reason };
				approval = drafted.approval;
			} catch {
				return { ok: false, reason: 'peer_unreachable' };
			}
			const credential = peerCallCredential(entry.peer);
			return {
				ok: true,
				disclosure: {
					protocol: 'mcp',
					peerId: entry.peer.id,
					peerLabel: entry.label,
					destination: approval.disclosure.destination,
					operation: request.operation,
					fields: approval.disclosure.argumentFields,
					preview: previewExternalArguments(approval.arguments),
					bytes: approval.disclosure.argumentBytes,
					credential:
						credential.kind === 'deployment_bearer'
							? { kind: 'operator_secret', ref: credential.secretRef }
							: { kind: 'none' },
					mutates: peerToolMutates(entry.peer, request.operation),
					reversibility: peerToolReversibility(entry.peer, request.operation),
					grant: 'once',
				},
				binding: {
					protocol: 'mcp',
					peerId: entry.peer.id,
					endpoint: approval.endpoint,
					operation: request.operation,
					contractDigest: approval.fingerprint,
					policyDigest: mcpPolicyDigest(entry, request.operation),
					argumentsDigest: approval.argumentsHash,
					userId: request.userId,
					expiresAt: approval.expiresAt,
				},
			};
		},

		async verify(binding: ExternalOperationBinding) {
			const checked = await authority(binding.peerId, binding.operation, binding.userId);
			if (!checked.ok) return checked;
			const { entry } = checked;
			if (new URL(entry.peer.url).href !== binding.endpoint) return { ok: false, reason: 'endpoint_changed' };
			if (mcpPolicyDigest(entry, binding.operation) !== binding.policyDigest) {
				return { ok: false, reason: 'permission_changed' };
			}
			try {
				return await withConnection(connect, entry, undefined, async (connection) => {
					const live = (await listPeerTools(connection)).tools.find((tool) => tool.name === binding.operation);
					if (!live) return { ok: false as const, reason: 'tool_removed' };
					if (live.fingerprint !== binding.contractDigest) return { ok: false as const, reason: 'contract_drift' };
					return { ok: true as const };
				});
			} catch {
				return { ok: false, reason: 'peer_unreachable' };
			}
		},

		async execute(request, binding, signal): Promise<ExternalExecutionResult> {
			const checked = await authority(binding.peerId, binding.operation, binding.userId);
			if (!checked.ok) return { outcome: 'refused', delivery: 'not_sent', reason: checked.reason };
			const { entry } = checked;
			if (mcpPolicyDigest(entry, binding.operation) !== binding.policyDigest) {
				return { outcome: 'refused', delivery: 'not_sent', reason: 'permission_changed' };
			}
			const args = request.arguments as Record<string, unknown>;
			const approval: PeerCallApproval = {
				id: 'external',
				userId: binding.userId,
				peerId: binding.peerId,
				endpoint: binding.endpoint,
				remoteName: binding.operation,
				toolName: peerToolName(binding.peerId, binding.operation),
				fingerprint: binding.contractDigest,
				// The composite policy digest was compared just above; the MCP digest inside it matches by construction.
				permissionDigest: peerPermissionDigest(entry.peer, binding.operation),
				arguments: args,
				argumentsHash: binding.argumentsDigest,
				disclosure: {
					peerId: binding.peerId,
					remoteName: binding.operation,
					destination: new URL(binding.endpoint).origin,
					sends: 'tool_arguments_only',
					argumentFields: Object.keys(args).sort(),
					argumentBytes: Buffer.byteLength(canonicalJson(args), 'utf8'),
					credential: peerCallCredential(entry.peer),
				},
				risk: 'write',
				reversibility: peerToolReversibility(entry.peer, binding.operation),
				approvedAt: clock().toISOString(),
				expiresAt: binding.expiresAt,
			};
			let connection: PeerConnection;
			try {
				connection = await connect(entry, signal);
			} catch {
				// The operation's request is only built after the connection; nothing of it left.
				return { outcome: 'failed', delivery: 'not_sent', reason: 'peer_unreachable' };
			}
			try {
				const receipt = await executeApprovedPeerCall(approval, {
					peer: entry.peer,
					connection,
					userId: actor.userId,
					store: passThroughStore,
					arguments: args,
					now: clock,
					signal,
				});
				return {
					outcome: receipt.outcome,
					delivery: receipt.delivery,
					result: receipt.result.text,
					...(receipt.reason ? { reason: receipt.reason } : {}),
				};
			} finally {
				await connection.close().catch(() => {});
			}
		},
	};
}
