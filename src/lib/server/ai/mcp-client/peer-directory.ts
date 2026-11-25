/**
 * The peer directory — the operator's stored peers (`ai.mcp_peer`, `ai.mcp_peer_tool`) as the
 * MCP client's `McpPeer` policy, and the operator's actions on them: connection test, tool
 * discovery with drift against the reviewed fingerprints, per-tool activation, revocation.
 *
 * The mapping is the product rule: a tool is allowed only when the operator ACTIVATED it, and the
 * activation pins the fingerprint they reviewed. Nothing is ever listed read-only here — in the
 * assistant every external call, read or mutation, is proposed and waits for the user's one-time
 * approval, because even a read discloses its arguments. `mutates`, `reversibility` and the
 * argument-field allowlist are the operator's words, carried into the policy digest so changing
 * any of them invalidates the approvals pending for that tool.
 */
import {
	getMcpPeer,
	listLiveMcpPeers,
	type McpPeerRecord,
	recordDiscoveredPeerTools,
	recordMcpPeerTest,
	saveMcpPeer,
} from '#lib/server/db/ai/mcp-peers.ts';
import type { McpPeerAudience } from '#lib/types/db-enums.ts';
import { type McpPeer, type PeerConfigProblem, type PeerToolRule, peerConfigProblems } from './peer';
import {
	type ConnectPeerOptions,
	connectPeer,
	detectToolDrift,
	fingerprintsOf,
	listPeerTools,
	type PeerConnection,
	type PeerToolListing,
	type ToolDrift,
	type ToolFingerprints,
} from './peer-tools';

/** One stored peer, read as policy. */
export interface DirectoryPeer {
	peer: McpPeer;
	label: string;
	audience: McpPeerAudience;
	/** Remote name → the fingerprint the operator activated. Only activated tools appear. */
	pins: ToolFingerprints;
}

export function directoryPeerOf(record: McpPeerRecord): DirectoryPeer {
	const activated = record.tools.filter((tool) => tool.activatedFingerprint !== null);
	const toolRules: Record<string, PeerToolRule> = {};
	for (const tool of activated) {
		toolRules[tool.remoteName] = {
			mutates: tool.mutates,
			reversibility: tool.reversibility,
			...(tool.argumentFields ? { argumentFields: tool.argumentFields } : {}),
		};
	}
	return {
		label: record.label,
		audience: record.audience,
		pins: Object.fromEntries(activated.map((tool) => [tool.remoteName, tool.activatedFingerprint as string])),
		peer: {
			id: record.id,
			url: record.url,
			transport: 'streamable-http',
			auth: record.secretRef ? { kind: 'bearer', secretRef: record.secretRef } : { kind: 'none' },
			policy: { allowTools: activated.map((tool) => tool.remoteName), readOnlyTools: [], toolRules },
			...(record.maxArgumentBytes !== null ? { disclosure: { maxArgumentBytes: record.maxArgumentBytes } } : {}),
			privateDestinations: record.privateDestinations,
		},
	};
}

/** Whether a user with `role` may call a peer serving `audience`. */
export function audienceAdmits(audience: McpPeerAudience, role: 'admin' | 'user'): boolean {
	return audience === 'user' || role === 'admin';
}

/** One live (not revoked) peer as policy, or null. */
export async function loadDirectoryPeer(peerId: string): Promise<DirectoryPeer | null> {
	const record = await getMcpPeer(peerId);
	if (!record || record.revokedAt !== null) return null;
	return directoryPeerOf(record);
}

/** The peers a turn may mount for `role`: live, admitting the role, with at least one activated tool. */
export async function loadMountablePeers(role: 'admin' | 'user'): Promise<DirectoryPeer[]> {
	return (await listLiveMcpPeers())
		.map(directoryPeerOf)
		.filter((entry) => audienceAdmits(entry.audience, role) && entry.peer.policy.allowTools.length > 0);
}

/**
 * The connection a stored peer gets. Every read of a STORED config connects through here, with
 * no test-only option (`allowLoopbackHttp`, a custom resolver) — those exist for fixtures only.
 */
export function connectDirectoryPeer(peer: McpPeer, options: Pick<ConnectPeerOptions, 'signal'> = {}) {
	return connectPeer(peer, options);
}

/** A stored peer as the operator's connection test and discovery use it: lists, never projects or calls. */
function discoveryPeerOf(record: McpPeerRecord): McpPeer {
	const { peer } = directoryPeerOf(record);
	// Connecting validates the config, which wants a non-empty allow list; discovery projects nothing.
	return { ...peer, policy: { allowTools: [DISCOVERY_ONLY], readOnlyTools: [], toolRules: {} } };
}

/** Not a tool name the spec's alphabet admits, so it can never match a listed tool. */
const DISCOVERY_ONLY = '(discovery)';

export type PeerTestOutcome = 'ok' | 'config_invalid' | 'unreachable';

/** Connect and list once; records the outcome on the peer. Sends no tool call. */
export async function testDirectoryPeer(peerId: string): Promise<{ outcome: PeerTestOutcome; tools: number }> {
	const record = await getMcpPeer(peerId);
	if (!record) return { outcome: 'config_invalid', tools: 0 };
	let connection: PeerConnection | undefined;
	try {
		connection = await connectDirectoryPeer(discoveryPeerOf(record));
		const listing = await listPeerTools(connection);
		await recordMcpPeerTest(peerId, 'ok');
		return { outcome: 'ok', tools: listing.tools.length };
	} catch (error) {
		const outcome: PeerTestOutcome =
			error instanceof Error && error.name === 'PeerConfigError' ? 'config_invalid' : 'unreachable';
		await recordMcpPeerTest(peerId, outcome);
		return { outcome, tools: 0 };
	} finally {
		await connection?.close().catch(() => {});
	}
}

export interface PeerDiscovery {
	outcome: PeerTestOutcome;
	listing: PeerToolListing | null;
	/** Against the operator's activated fingerprints. */
	drift: ToolDrift | null;
}

/** List the peer's tools, store what was found (never touching a pin), and report drift. */
export async function discoverDirectoryPeerTools(peerId: string): Promise<PeerDiscovery> {
	const record = await getMcpPeer(peerId);
	if (!record) return { outcome: 'config_invalid', listing: null, drift: null };
	let connection: PeerConnection | undefined;
	try {
		connection = await connectDirectoryPeer(discoveryPeerOf(record));
		const listing = await listPeerTools(connection);
		await recordDiscoveredPeerTools(
			peerId,
			listing.tools.map((tool) => ({
				remoteName: tool.name,
				fingerprint: tool.fingerprint,
				description: tool.description,
				inputSchema: tool.inputSchema,
				hints: tool.hints,
			})),
		);
		await recordMcpPeerTest(peerId, 'ok');
		return { outcome: 'ok', listing, drift: detectToolDrift(directoryPeerOf(record).pins, fingerprintsOf(listing)) };
	} catch (error) {
		const outcome: PeerTestOutcome =
			error instanceof Error && error.name === 'PeerConfigError' ? 'config_invalid' : 'unreachable';
		await recordMcpPeerTest(peerId, outcome);
		return { outcome, listing: null, drift: null };
	} finally {
		await connection?.close().catch(() => {});
	}
}

export interface PeerConfigDraft {
	id: string;
	label: string;
	url: string;
	secretRef: string | null;
	audience: McpPeerAudience;
	maxArgumentBytes: number | null;
	privateDestinations: Array<{ cidr: string; port: number }>;
}

export type PeerConfigRejection = PeerConfigProblem | 'invalid_label' | 'invalid_url';

/**
 * Save an operator's peer config after the same validation a connect applies (id, secret
 * reference namespace, disclosure bound, private destinations) plus the URL's shape. Only
 * `https:` is stored; the endpoint guard still checks the address on every connect.
 */
export async function savePeerConfig(
	draft: PeerConfigDraft,
	adminId: string,
): Promise<{ ok: true } | { ok: false; problems: PeerConfigRejection[] }> {
	const problems: PeerConfigRejection[] = [];
	if (draft.label.trim().length === 0 || draft.label.length > 80) problems.push('invalid_label');
	try {
		if (new URL(draft.url).protocol !== 'https:') problems.push('invalid_url');
	} catch {
		problems.push('invalid_url');
	}
	problems.push(
		...peerConfigProblems({
			id: draft.id,
			url: draft.url,
			transport: 'streamable-http',
			auth: draft.secretRef ? { kind: 'bearer', secretRef: draft.secretRef } : { kind: 'none' },
			policy: { allowTools: [DISCOVERY_ONLY], readOnlyTools: [] },
			...(draft.maxArgumentBytes !== null ? { disclosure: { maxArgumentBytes: draft.maxArgumentBytes } } : {}),
			privateDestinations: draft.privateDestinations,
		}),
	);
	if (problems.length > 0) return { ok: false, problems };
	await saveMcpPeer({ ...draft, label: draft.label.trim() }, adminId);
	return { ok: true };
}
