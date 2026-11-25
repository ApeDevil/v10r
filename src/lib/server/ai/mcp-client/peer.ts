/**
 * An MCP peer — an external MCP server v10r consumes as a client — and the operator policy that
 * decides what its tools may do, what a call may disclose, and where the peer may be reached.
 *
 * The policy is the only source of a tool's risk. A peer describes its tools (description,
 * `annotations.readOnlyHint`, `destructiveHint`, `title`), but the spec says clients MUST treat
 * annotations from an untrusted server as untrusted, and a peer that wants a delete tool to run
 * unattended only has to claim it is read-only. So the hints are recorded and shown, never obeyed:
 * an operator names the read-only tools, everything else waits for approval. The same holds for
 * reversibility: an operator states it per tool, and a tool nobody described is `unknown`.
 */
import { type PrivateDestination, privateDestinationProblems } from '#lib/server/http/egress-address.ts';
import { MAX_PEER_ARGUMENT_BYTES, PEER_SECRET_PREFIX } from './config';

/**
 * Credentials v10r presents to a peer: the DEPLOYMENT's credential for that peer, never the
 * user's. A bearer is a *reference* to a secret in the `MCP_PEER_SECRET_` namespace, never the
 * secret itself.
 */
export type PeerAuth = { kind: 'none' } | { kind: 'bearer'; secretRef: string };

/**
 * Whether a peer tool's effect can be taken back, as the OPERATOR knows it — nothing a peer says
 * sets it. `reversible`: the peer offers an exact undo; `compensatable`: a further action can
 * offset it (a refund, a correcting edit) but the first effect happened; `irreversible`: sent is
 * final; `unknown`: nobody said, the default — never read as reversible.
 */
export type PeerToolReversibility = 'reversible' | 'compensatable' | 'irreversible' | 'unknown';

/** The operator's per-tool rules, beyond allow/read-only. */
export interface PeerToolRule {
	/**
	 * The top-level argument fields a call may send. A call carrying any other field is refused,
	 * not stripped (stripping would change what the user approved). `[]` sends nothing at all.
	 * Absent: whatever the tool's input schema accepts, within the size bound.
	 */
	argumentFields?: string[];
	reversibility?: PeerToolReversibility;
	/**
	 * Whether a call may change persistent data on the peer, as the operator states it — what the
	 * approval card says. Absent: assumed to (`peerToolMutates`). Never read from a peer hint.
	 */
	mutates?: boolean;
}

/** What the operator allows a peer's tools to do. */
export interface PeerToolPolicy {
	/** Remote tool names projected at all. A tool the peer lists but the operator did not name is dropped. */
	allowTools: string[];
	/** Remote tool names that run without approval (risk `read`). Must be a subset of `allowTools`. */
	readOnlyTools: string[];
	/** Per-tool rules, keyed by remote name; every key must be in `allowTools`. */
	toolRules?: Record<string, PeerToolRule>;
}

/**
 * What a call to this peer may disclose. The context is fixed by construction, not configured:
 * v10r sends only the model-supplied, schema-validated arguments of the one call — never the
 * conversation, a document, the desk, the user's session or token. What an operator sets is the
 * bound on those arguments.
 */
export interface PeerDisclosurePolicy {
	/** Bytes of canonical JSON arguments per call; default `DEFAULT_PEER_ARGUMENT_BYTES`, at most `MAX_PEER_ARGUMENT_BYTES`. */
	maxArgumentBytes?: number;
}

export interface McpPeer {
	/**
	 * Slug, unique per deployment; becomes the tool-name namespace `mcp_<id>_<tool>`. Lowercase
	 * letters and digits only — no `-` or `_` — so the segment between the first two underscores
	 * of a projected name is always exactly one peer id, and no two peers can share a namespace.
	 */
	id: string;
	url: string;
	transport: 'streamable-http';
	auth: PeerAuth;
	policy: PeerToolPolicy;
	disclosure?: PeerDisclosurePolicy;
	/**
	 * The private addresses (narrow CIDR + port) this peer may resolve to — a sidecar, a VPC
	 * service. Default none: a peer that resolves to loopback, RFC 1918, CGNAT or unique-local is
	 * refused. Link-local (the metadata service) cannot be listed.
	 */
	privateDestinations?: PrivateDestination[];
}

/** Looks a secret up by its reference; the deployment decides where secrets live. */
export type SecretResolver = (secretRef: string) => string | undefined;

/** The secret-reference alphabet: `MCP_PEER_SECRET_` and an env-var-shaped suffix. */
const SECRET_REF = new RegExp(`^${PEER_SECRET_PREFIX}[A-Z0-9][A-Z0-9_]{0,46}$`);

/** True when `secretRef` names a variable inside the peer-secret namespace. */
export function isPeerSecretRef(secretRef: string): boolean {
	return SECRET_REF.test(secretRef);
}

/**
 * Reads the reference as an environment variable name — the deployment-default resolver. A
 * reference outside the namespace resolves to nothing, whatever the environment holds: this
 * resolver is the second lock behind `peerConfigProblems`.
 */
export const environmentSecretResolver: SecretResolver = (secretRef) =>
	isPeerSecretRef(secretRef) ? process.env[secretRef] : undefined;

const PEER_ID = /^[a-z][a-z0-9]{0,23}$/;

export type PeerConfigProblem =
	| 'invalid_id'
	| 'unsupported_transport'
	| 'invalid_secret_ref'
	| 'read_only_not_allowed'
	| 'empty_allow_list'
	| 'rule_for_unlisted_tool'
	| 'invalid_argument_fields'
	| 'invalid_disclosure'
	| 'invalid_private_destination';

/** Problems with a peer's configuration, empty when it can be used. Endpoint checks are `checkPeerEndpoint`'s. */
export function peerConfigProblems(peer: McpPeer): PeerConfigProblem[] {
	const problems: PeerConfigProblem[] = [];
	if (!PEER_ID.test(peer.id)) problems.push('invalid_id');
	if (peer.transport !== 'streamable-http') problems.push('unsupported_transport');
	if (peer.auth.kind === 'bearer' && !isPeerSecretRef(peer.auth.secretRef)) problems.push('invalid_secret_ref');
	if (peer.policy.allowTools.length === 0) problems.push('empty_allow_list');
	if (peer.policy.readOnlyTools.some((name) => !peer.policy.allowTools.includes(name))) {
		problems.push('read_only_not_allowed');
	}
	const rules = Object.entries(peer.policy.toolRules ?? {});
	if (rules.some(([name]) => !peer.policy.allowTools.includes(name))) problems.push('rule_for_unlisted_tool');
	if (
		rules.some(
			([, rule]) =>
				rule.argumentFields !== undefined &&
				(!Array.isArray(rule.argumentFields) || rule.argumentFields.some((field) => typeof field !== 'string')),
		)
	) {
		problems.push('invalid_argument_fields');
	}
	const max = peer.disclosure?.maxArgumentBytes;
	if (max !== undefined && (!Number.isInteger(max) || max < 2 || max > MAX_PEER_ARGUMENT_BYTES)) {
		problems.push('invalid_disclosure');
	}
	if ((peer.privateDestinations ?? []).some((destination) => privateDestinationProblems(destination).length > 0)) {
		problems.push('invalid_private_destination');
	}
	return problems;
}

/** The operator's word on whether one tool may change data on the peer; `true` unless stated otherwise. */
export function peerToolMutates(peer: McpPeer, remoteName: string): boolean {
	return peer.policy.toolRules?.[remoteName]?.mutates ?? true;
}

/** The operator's reversibility for one tool; `unknown` unless stated. */
export function peerToolReversibility(peer: McpPeer, remoteName: string): PeerToolReversibility {
	return peer.policy.toolRules?.[remoteName]?.reversibility ?? 'unknown';
}
