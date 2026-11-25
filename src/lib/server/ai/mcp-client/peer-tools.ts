/**
 * Connecting to an MCP peer and reading its tool list — bounded, fingerprinted, diffed.
 *
 * The official client (`@modelcontextprotocol/client`, the same major as the server v10r runs —
 * decision D10: official maintained implementations by default) owns the protocol: era
 * negotiation, the 2026-07-28 envelope, framing. This module owns what is v10r's: the guarded
 * transport, the bounds on what a peer may send, and the fingerprint that makes a silently
 * changed tool (a "rug pull") visible.
 *
 * A changed tool is not accepted: `detectToolDrift` reports it, and `projectPeerTools` withholds
 * every tool whose fingerprint differs from the one the operator approved.
 */
import { createHash } from 'node:crypto';
import { Client, StreamableHTTPClientTransport, type Tool } from '@modelcontextprotocol/client';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import {
	MAX_PEER_DESCRIPTION_CHARS,
	MAX_PEER_LIST_PAGES,
	MAX_PEER_TOOLS,
	PEER_CONNECT_TIMEOUT_MS,
	PEER_LIST_TIMEOUT_MS,
} from './config';
import { checkPeerEndpoint, createMcpPeerFetch, type EndpointOptions } from './endpoint-guard';
import { environmentSecretResolver, type McpPeer, peerConfigProblems, type SecretResolver } from './peer';

/** What the peer claims about a tool. Shown to the operator; never an input to risk lowering. */
export interface PeerToolHints {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

export type PeerToolFlag = 'description_truncated';
export type PeerListingFlag =
	| 'tool_list_truncated'
	| 'page_limit_reached'
	| 'invalid_tool_name'
	| 'duplicate_tool_name';

/** One tool as a peer listed it, after the bounds. */
export interface PeerTool {
	/** The peer's own name, sent back on `tools/call`. */
	name: string;
	/** Bounded to `MAX_PEER_DESCRIPTION_CHARS`. Untrusted text: the projection labels it so. */
	description: string;
	inputSchema: Record<string, unknown>;
	outputSchema?: Record<string, unknown>;
	hints: PeerToolHints;
	/** sha-256 of the tool's contract as listed — see `toolFingerprint`. */
	fingerprint: string;
	flags: PeerToolFlag[];
	/** The definition as listed, for the SDK's header mirroring on `tools/call`. */
	definition: Tool;
}

export interface PeerToolListing {
	peerId: string;
	tools: PeerTool[];
	flags: PeerListingFlag[];
}

export interface PeerConnection {
	peer: McpPeer;
	client: Client;
	/**
	 * The resolver the guarded fetch reads the peer's bearer through. Kept so a result can be
	 * scrubbed of that secret and an argument refused for carrying it — the value itself is
	 * never stored on the connection.
	 */
	resolveSecret: SecretResolver;
	close(): Promise<void>;
}

export interface ConnectPeerOptions extends EndpointOptions {
	resolveSecret?: SecretResolver;
	maxResponseBytes?: number;
	timeoutMs?: number;
	signal?: AbortSignal;
}

export class PeerConfigError extends Error {
	constructor(readonly problems: string[]) {
		super(`MCP peer config is invalid: ${problems.join(', ')}`);
		this.name = 'PeerConfigError';
	}
}

/**
 * Connects to a peer over Streamable HTTP through the guarded fetch. `auto` negotiation probes the
 * 2026-07-28 era and falls back to the 2025 `initialize` handshake, so both server generations work.
 */
export async function connectPeer(peer: McpPeer, options: ConnectPeerOptions = {}): Promise<PeerConnection> {
	const problems = peerConfigProblems(peer);
	if (problems.length > 0) throw new PeerConfigError(problems);
	const url = await checkPeerEndpoint(peer, options);
	const resolveSecret = options.resolveSecret ?? environmentSecretResolver;
	const transport = new StreamableHTTPClientTransport(url, {
		fetch: createMcpPeerFetch(peer, { ...options, resolveSecret }),
	});
	const client = new Client({ name: 'v10r-mcp-client', version: '1.0.0' }, { versionNegotiation: { mode: 'auto' } });
	await client.connect(transport, {
		timeout: options.timeoutMs ?? PEER_CONNECT_TIMEOUT_MS,
		signal: options.signal,
	});
	return { peer, client, resolveSecret, close: () => client.close() };
}

/**
 * sha-256 over the tool's contract: name, the FULL description (a change past the display cut is
 * still a change), input schema, output schema and annotations. An annotation flip is a contract
 * change too: `destructiveHint` raises a tool's risk.
 */
export function toolFingerprint(tool: Tool): string {
	return createHash('sha256')
		.update(
			canonicalJson({
				name: tool.name,
				description: tool.description ?? '',
				inputSchema: tool.inputSchema ?? null,
				outputSchema: tool.outputSchema ?? null,
				annotations: tool.annotations ?? null,
			}),
		)
		.digest('hex');
}

/** Name → fingerprint, the shape an operator's approval is stored in. */
export type ToolFingerprints = Record<string, string>;

export function fingerprintsOf(listing: PeerToolListing): ToolFingerprints {
	return Object.fromEntries(listing.tools.map((tool) => [tool.name, tool.fingerprint]));
}

export interface ToolDrift {
	/** `unchanged` — nothing to do; `needs_reapproval` — the operator must look before these tools run. */
	status: 'unchanged' | 'needs_reapproval';
	added: string[];
	removed: string[];
	changed: string[];
}

/** What changed between the approved fingerprints and the live listing. Removal alone needs no approval. */
export function detectToolDrift(previous: ToolFingerprints, current: ToolFingerprints): ToolDrift {
	const added = Object.keys(current)
		.filter((name) => !(name in previous))
		.sort();
	const removed = Object.keys(previous)
		.filter((name) => !(name in current))
		.sort();
	const changed = Object.keys(current)
		.filter((name) => name in previous && previous[name] !== current[name])
		.sort();
	return { status: added.length > 0 || changed.length > 0 ? 'needs_reapproval' : 'unchanged', added, removed, changed };
}

/** The spec's tool-name alphabet (SEP-986): 1–128 of `A-Z a-z 0-9 _ - .`. */
const REMOTE_TOOL_NAME = /^[A-Za-z0-9_.-]{1,128}$/;

function hintsOf(tool: Tool): PeerToolHints {
	const a = tool.annotations ?? {};
	const hints: PeerToolHints = {};
	const title = tool.title ?? a.title;
	if (typeof title === 'string') hints.title = title.slice(0, 200);
	for (const key of ['readOnlyHint', 'destructiveHint', 'idempotentHint', 'openWorldHint'] as const) {
		if (typeof a[key] === 'boolean') hints[key] = a[key];
	}
	return hints;
}

function boundTool(tool: Tool): PeerTool {
	const raw = typeof tool.description === 'string' ? tool.description : '';
	const truncated = raw.length > MAX_PEER_DESCRIPTION_CHARS;
	return {
		name: tool.name,
		description: truncated ? `${raw.slice(0, MAX_PEER_DESCRIPTION_CHARS)}…` : raw,
		inputSchema: (tool.inputSchema ?? { type: 'object' }) as Record<string, unknown>,
		...(tool.outputSchema ? { outputSchema: tool.outputSchema as Record<string, unknown> } : {}),
		hints: hintsOf(tool),
		fingerprint: toolFingerprint(tool),
		flags: truncated ? ['description_truncated'] : [],
		definition: tool,
	};
}

/**
 * The peer's tools, bounded: at most `MAX_PEER_TOOLS` (in listing order), at most
 * `MAX_PEER_LIST_PAGES` pages, invalid and duplicate names dropped. Always a fresh read
 * (`cacheMode: 'refresh'`) — a drift check against a cached list would prove nothing.
 */
export async function listPeerTools(
	connection: PeerConnection,
	options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<PeerToolListing> {
	const flags = new Set<PeerListingFlag>();
	const tools: PeerTool[] = [];
	const seen = new Set<string>();
	let cursor: string | undefined;
	for (let page = 0; ; page++) {
		if (page >= MAX_PEER_LIST_PAGES) {
			flags.add('page_limit_reached');
			break;
		}
		const result = await connection.client.listTools(cursor ? { cursor } : undefined, {
			timeout: options.timeoutMs ?? PEER_LIST_TIMEOUT_MS,
			signal: options.signal,
			cacheMode: 'refresh',
		});
		for (const tool of result.tools) {
			if (tools.length >= MAX_PEER_TOOLS) {
				flags.add('tool_list_truncated');
				break;
			}
			if (typeof tool.name !== 'string' || !REMOTE_TOOL_NAME.test(tool.name)) {
				flags.add('invalid_tool_name');
				continue;
			}
			if (seen.has(tool.name)) {
				flags.add('duplicate_tool_name');
				continue;
			}
			seen.add(tool.name);
			tools.push(boundTool(tool));
		}
		cursor = result.nextCursor;
		if (!cursor || flags.has('tool_list_truncated')) break;
	}
	return { peerId: connection.peer.id, tools, flags: [...flags] };
}
