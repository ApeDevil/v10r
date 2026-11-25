/**
 * A2A delegation as an external operation — the A2A half of the external-operations contract
 * (`#lib/server/external-operations/`). The domain behind the contract owns the approval, the
 * execution claim and the receipt; this adapter owns only what is A2A's:
 *
 *  - `prepare` (the model proposed; nothing is sent): the peer must be an operator-listed
 *    `A2aDelegationPeer`, the skill one the operator allows AND the peer's card offers, the
 *    model a valid architecture model. The card is read through the secured transport (agent
 *    discovery: a GET, no task, no model). The disclosure says what is sent, to whom, under
 *    which credential; the binding pins the card (`peerCardDigest`), the operator's policy for
 *    the peer and the exact arguments.
 *  - `verify` (after approval, inside the domain's claim): the peer is still listed under the
 *    same policy, the approval has not expired, and the card it serves now digests the same.
 *  - `execute` (once per approval, never retried): the arguments must digest as approved; the
 *    delegation runs with that card digest bound, so a card swapped between `verify` and the
 *    send refuses instead of sending. The answer is a claim (`verified: false`): `succeeded`
 *    means the peer SAYS it completed a review, its findings are its assertion, and the result
 *    text is wrapped as untrusted content by `wrapResult` (the assistant layer's boundary).
 *
 * Remote task and context ids ride on every result (`remoteTask`) for trace correlation.
 */
import { createHash } from 'node:crypto';
import type {
	ExternalDisclosureDraft,
	ExternalExecutionResult,
	ExternalOperationAdapter,
	ExternalOperationBinding,
	ExternalOperationRequest,
	ExternalPreparation,
} from '#lib/server/external-operations/index.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { type ArchitectureModel, parseArchitectureModel } from '#patterns/architecture-engineering/index.ts';
import { A2A_CLIENT_LIMITS, A2A_DELEGATION_DEPTH_KEY, A2A_DELEGATION_LIMITS } from './config.ts';
import { type DelegationOutcome, type DelegationRefusalCode, delegateArchitectureReview } from './delegate.ts';
import {
	type A2aDelegationPeer,
	type A2aSecretResolver,
	delegationPeerPolicy,
	delegationPeerProblems,
} from './delegation-peer.ts';
import type { A2aTransportOptions } from './guarded-fetch.ts';
import { cut, peerCardDigest, readPeerCard } from './peer-card.ts';

/** The arguments the model passes; the A2A skill is the operation. */
export interface A2aDelegationArguments {
	model: ArchitectureModel;
}

export interface A2aDelegationAdapterOptions extends A2aTransportOptions {
	peers: readonly A2aDelegationPeer[];
	resolveSecret: A2aSecretResolver;
	/** Wraps a peer's text as untrusted content (the assistant layer's `wrapUntrusted`). */
	wrapResult: (source: string, text: string) => string;
	now?: () => Date;
	approvalTtlMs?: number;
	timeoutMs?: number;
}

/** What the tool and the approval card call this operation. */
export const DELEGATION_RESULT_SOURCE = 'delegate_architecture_review';

/** Characters of the claim text one result may carry. */
const MAX_RESULT_CHARS = 24_000;

/** Pre-send refusals that mean "a check failed", not "the peer failed". */
const POLICY_REFUSALS: ReadonlySet<DelegationRefusalCode> = new Set([
	'invalid_url',
	'not_allowlisted',
	'insecure_scheme',
	'private_address',
	'missing_secret',
	'card_changed',
	'skill_not_offered',
]);

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

export function delegationArgumentsDigest(args: unknown): string {
	return sha256(canonicalJson(args));
}

export function delegationPolicyDigest(peer: A2aDelegationPeer): string {
	return sha256(
		canonicalJson({
			id: peer.id,
			origin: peer.origin,
			skills: [...peer.skills].sort(),
			auth: peer.auth,
			privateDestinations: peer.privateDestinations ?? [],
			reversibility: peer.reversibility ?? 'unknown',
		}),
	);
}

function readArguments(raw: unknown): { ok: true; model: ArchitectureModel } | { ok: false; reason: string } {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, reason: 'invalid_arguments' };
	const keys = Object.keys(raw);
	if (keys.length !== 1 || keys[0] !== 'model') return { ok: false, reason: 'invalid_arguments' };
	const parsed = parseArchitectureModel((raw as { model: unknown }).model);
	return parsed.ok ? { ok: true, model: parsed.model } : { ok: false, reason: 'invalid_model' };
}

/** What the card shows of the model: identity and shape, never the descriptions verbatim. */
function modelPreview(model: ArchitectureModel): string {
	const ids = model.nodes.map((node) => node.id).join(', ');
	return cut(
		`architecture model "${model.name}" (${model.id}): ${model.nodes.length} nodes, ${model.connections.length} connections, ${model.zones.length} zones — the whole model is sent, descriptions and constraints included. Nodes: ${ids}`,
		600,
	);
}

function claimText(outcome: DelegationOutcome, peer: A2aDelegationPeer): string {
	const base = { peer: peer.label, verified: false as const };
	if (outcome.status === 'claimed') {
		return cut(
			JSON.stringify({
				...base,
				status: 'claimed',
				agent: outcome.agent,
				summary: outcome.summary,
				findings: outcome.findings,
				dropped: outcome.dropped,
			}),
			MAX_RESULT_CHARS,
		);
	}
	if (outcome.status === 'declined') {
		return JSON.stringify({ ...base, status: 'declined', taskState: outcome.taskState, reason: outcome.reason });
	}
	return JSON.stringify({
		...base,
		status: 'refused',
		code: outcome.code,
		...(outcome.cancellation ? { cancellation: outcome.cancellation } : {}),
	});
}

function settle(outcome: DelegationOutcome, peer: A2aDelegationPeer, wrap: A2aDelegationAdapterOptions['wrapResult']) {
	const remoteTask = { ...outcome.correlation };
	const result = wrap(DELEGATION_RESULT_SOURCE, claimText(outcome, peer));
	if (outcome.status === 'claimed') {
		return { outcome: 'succeeded', delivery: 'sent', result, remoteTask } satisfies ExternalExecutionResult;
	}
	if (outcome.status === 'declined') {
		return {
			outcome: 'failed',
			delivery: 'sent',
			result,
			reason: 'peer_declined',
			remoteTask,
		} satisfies ExternalExecutionResult;
	}
	if (outcome.delivery === 'not_sent') {
		return {
			outcome: POLICY_REFUSALS.has(outcome.code) ? 'refused' : 'failed',
			delivery: 'not_sent',
			reason: outcome.code,
			remoteTask,
		} satisfies ExternalExecutionResult;
	}
	if (outcome.code === 'timeout' || outcome.code === 'aborted') {
		// The peer confirming the cancel is still its claim — but it is the only word there is.
		return {
			outcome: outcome.cancellation === 'confirmed' ? 'failed' : 'unknown',
			delivery: outcome.delivery,
			result,
			reason: outcome.code,
			remoteTask,
		} satisfies ExternalExecutionResult;
	}
	return {
		outcome: outcome.delivery === 'sent' ? 'failed' : 'unknown',
		delivery: outcome.delivery,
		result,
		reason: outcome.code,
		remoteTask,
	} satisfies ExternalExecutionResult;
}

export function createA2aDelegationAdapter(options: A2aDelegationAdapterOptions): ExternalOperationAdapter {
	const now = options.now ?? (() => new Date());
	const usable = (id: string) => {
		const peer = options.peers.find((entry) => entry.id === id);
		return peer && delegationPeerProblems(peer).length === 0 ? peer : null;
	};
	const transport = (peer: A2aDelegationPeer) => ({
		policy: delegationPeerPolicy(peer),
		allowLoopbackHttp: options.allowLoopbackHttp,
		resolveHost: options.resolveHost,
		tlsCa: options.tlsCa,
		requestImpl: options.requestImpl,
		bearerSecret:
			peer.auth.kind === 'bearer'
				? () => options.resolveSecret((peer.auth as { secretRef: string }).secretRef)
				: undefined,
	});

	return {
		protocol: 'a2a',

		async prepare(request: ExternalOperationRequest): Promise<ExternalPreparation> {
			if (request.protocol !== 'a2a') return { ok: false, reason: 'wrong_protocol' };
			const peer = usable(request.peerId);
			if (!peer) return { ok: false, reason: 'unknown_peer' };
			if (!peer.skills.includes(request.operation)) return { ok: false, reason: 'skill_not_allowed' };
			const args = readArguments(request.arguments);
			if (!args.ok) return { ok: false, reason: args.reason };

			const read = await readPeerCard(peer.origin, { ...transport(peer), timeoutMs: options.timeoutMs });
			if (!read.ok) return { ok: false, reason: `card_unavailable:${read.code}` };
			if (!read.card.skills?.some((skill) => skill.id === request.operation)) {
				return { ok: false, reason: 'skill_not_offered' };
			}
			const endpoint = read.card.supportedInterfaces?.find((i) => i.protocolBinding === 'JSONRPC')?.url;
			if (!endpoint) return { ok: false, reason: 'no_jsonrpc_interface' };

			const canonical = canonicalJson({ model: args.model });
			const disclosure: ExternalDisclosureDraft = {
				protocol: 'a2a',
				peerId: peer.id,
				peerLabel: peer.label,
				destination: new URL(endpoint).origin,
				operation: request.operation,
				fields: ['model', 'metadata.skill', `metadata.${A2A_DELEGATION_DEPTH_KEY}`],
				preview: modelPreview(args.model),
				bytes: Buffer.byteLength(canonical),
				credential:
					peer.auth.kind === 'bearer' ? { kind: 'operator_secret', ref: peer.auth.secretRef } : { kind: 'none' },
				mutates: false,
				reversibility: peer.reversibility ?? 'unknown',
				grant: 'once',
				// What `delegate.ts` adds to the message beside the model, shown with the arguments.
				envelope: [
					{ field: 'metadata.skill', value: request.operation },
					{ field: `metadata.${A2A_DELEGATION_DEPTH_KEY}`, value: '1' },
				],
			};
			const binding: ExternalOperationBinding = {
				protocol: 'a2a',
				peerId: peer.id,
				endpoint,
				operation: request.operation,
				contractDigest: peerCardDigest(read.card, request.operation),
				policyDigest: delegationPolicyDigest(peer),
				argumentsDigest: delegationArgumentsDigest({ model: args.model }),
				userId: request.userId,
				expiresAt: new Date(
					now().getTime() + (options.approvalTtlMs ?? A2A_DELEGATION_LIMITS.approvalTtlMs),
				).toISOString(),
			};
			return { ok: true, disclosure, binding };
		},

		async verify(binding: ExternalOperationBinding) {
			if (binding.protocol !== 'a2a') return { ok: false, reason: 'wrong_protocol' };
			if (Date.parse(binding.expiresAt) <= now().getTime()) return { ok: false, reason: 'expired' };
			const peer = usable(binding.peerId);
			if (!peer) return { ok: false, reason: 'unknown_peer' };
			if (delegationPolicyDigest(peer) !== binding.policyDigest) return { ok: false, reason: 'policy_changed' };
			if (!peer.skills.includes(binding.operation)) return { ok: false, reason: 'skill_not_allowed' };
			const read = await readPeerCard(peer.origin, { ...transport(peer), timeoutMs: options.timeoutMs });
			if (!read.ok) return { ok: false, reason: `card_unavailable:${read.code}` };
			if (peerCardDigest(read.card, binding.operation) !== binding.contractDigest) {
				return { ok: false, reason: 'card_changed' };
			}
			return { ok: true };
		},

		async execute(request, binding, signal): Promise<ExternalExecutionResult> {
			const refused = (reason: string): ExternalExecutionResult => ({
				outcome: 'refused',
				delivery: 'not_sent',
				reason,
			});
			if (request.userId !== binding.userId) return refused('not_approver');
			if (request.peerId !== binding.peerId || request.operation !== binding.operation)
				return refused('binding_mismatch');
			const peer = usable(binding.peerId);
			if (!peer) return refused('unknown_peer');
			const args = readArguments(request.arguments);
			if (!args.ok) return refused(args.reason);
			if (delegationArgumentsDigest({ model: args.model }) !== binding.argumentsDigest) {
				return refused('arguments_changed');
			}
			const outcome = await delegateArchitectureReview(peer.origin, args.model, {
				...transport(peer),
				skill: binding.operation,
				cardDigest: binding.contractDigest,
				signal,
				timeoutMs: options.timeoutMs ?? A2A_CLIENT_LIMITS.timeoutMs,
			});
			return settle(outcome, peer, options.wrapResult);
		},
	};
}
