/**
 * An operator-configured A2A peer the assistant may delegate to — the allowlist entry behind
 * `delegate_architecture_review`. No endpoint comes from the model or the user: the tool names
 * a peer by id, and only an id listed here exists.
 *
 * The operator states everything the approval card shows and nothing is inferred from the peer:
 * which A2A skills may be asked for, the credential (none, or a bearer by secret reference —
 * never the user's session), the private destinations it may sit on, and whether undoing a
 * delegation is possible. The card the peer serves can narrow this (a skill it no longer
 * offers is refused), never widen it.
 */

import type { ExternalReversibility } from '#lib/server/external-operations/index.ts';
import { type PrivateDestination, privateDestinationProblems } from '#lib/server/http/egress-address.ts';
import type { PeerPolicy } from './peer-policy.ts';

export type A2aPeerAuth = { kind: 'none' } | { kind: 'bearer'; secretRef: string };

export interface A2aDelegationPeer {
	/** Operator id, the name the model passes (`^[a-z][a-z0-9-]{0,31}$`). */
	id: string;
	/** What the approval card calls the peer. */
	label: string;
	/** The peer's origin; its Agent Card is read from `/.well-known/agent-card.json` there. */
	origin: string;
	/** The A2A skills v10r may ask this peer for; anything else is refused before it is proposed. */
	skills: readonly string[];
	auth: A2aPeerAuth;
	privateDestinations?: readonly PrivateDestination[];
	/** The operator's word on undoing a delegation; `unknown` unless stated. */
	reversibility?: ExternalReversibility;
}

/** Looks a secret up by its reference; the deployment decides where secrets live. */
export type A2aSecretResolver = (secretRef: string) => string | undefined;

export const A2A_PEER_SECRET_PREFIX = 'A2A_PEER_SECRET_';
const SECRET_REF = new RegExp(`^${A2A_PEER_SECRET_PREFIX}[A-Z0-9][A-Z0-9_]{0,46}$`);
const PEER_ID = /^[a-z][a-z0-9-]{0,31}$/;
const SKILL_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

export function isA2aPeerSecretRef(secretRef: string): boolean {
	return SECRET_REF.test(secretRef);
}

/** The deployment-default resolver: an environment variable inside the A2A peer-secret namespace. */
export const a2aEnvironmentSecretResolver: A2aSecretResolver = (secretRef) =>
	isA2aPeerSecretRef(secretRef) ? process.env[secretRef] : undefined;

export type DelegationPeerProblem =
	| 'invalid_id'
	| 'invalid_origin'
	| 'empty_skills'
	| 'invalid_skill'
	| 'invalid_secret_ref'
	| 'invalid_private_destination';

/** Problems with one peer entry, empty when it can be used. */
export function delegationPeerProblems(peer: A2aDelegationPeer): DelegationPeerProblem[] {
	const problems: DelegationPeerProblem[] = [];
	if (!PEER_ID.test(peer.id)) problems.push('invalid_id');
	try {
		const url = new URL(peer.origin);
		if (url.origin !== peer.origin) problems.push('invalid_origin');
	} catch {
		problems.push('invalid_origin');
	}
	if (peer.skills.length === 0) problems.push('empty_skills');
	if (peer.skills.some((skill) => !SKILL_ID.test(skill) || skill.length > 64)) problems.push('invalid_skill');
	if (peer.auth.kind === 'bearer' && !isA2aPeerSecretRef(peer.auth.secretRef)) problems.push('invalid_secret_ref');
	if ((peer.privateDestinations ?? []).some((d) => privateDestinationProblems(d).length > 0)) {
		problems.push('invalid_private_destination');
	}
	return problems;
}

/** The peer policy for one delegation: exactly this peer's origin, nothing else. */
export function delegationPeerPolicy(peer: A2aDelegationPeer): PeerPolicy {
	return { peers: [{ origin: peer.origin, privateDestinations: peer.privateDestinations }] };
}
