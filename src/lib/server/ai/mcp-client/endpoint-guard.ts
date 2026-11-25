/**
 * The endpoint guard — where an MCP peer may be reached, and the one `fetch` the client uses.
 *
 * v10r's MCP client runs on the server, so a peer URL is a server-side request: the spec's SSRF
 * warning applies in full. The guard holds four rules:
 *
 *  1. **Transport.** `https` only; plain `http` only to a loopback address, and only when the
 *     caller passes the explicit test flag — a persisted peer config cannot carry it.
 *  2. **No credentials in the URL.** `https://user:token@host` would put a secret in config and logs.
 *  3. **No private network, pinned at connect.** Every request resolves the host ONCE
 *     (`resolvePinnedAddress`): every answer must be public, or an exact `privateDestinations`
 *     entry (narrow CIDR + port) the operator listed; link-local (169.254.169.254) never. The
 *     socket is then opened to that validated address (`fetchPinned`), keeping the host name
 *     for TLS SNI, certificate verification and `Host` — so a rebinding resolver has no second
 *     lookup to answer differently.
 *  4. **Nothing of the user's crosses.** The guarded fetch rebuilds the headers: any `cookie`,
 *     `authorization` or `proxy-authorization` the SDK or a caller put there is dropped, and the
 *     only credential sent is the peer's own bearer, resolved from its `MCP_PEER_SECRET_*`
 *     reference. A redirect is an error, never followed.
 *
 * Address classification (`#lib/server/http/egress-address.ts`) and the secured transport
 * itself (`#lib/server/http/peer-egress.ts`: pinning, header hygiene, redirects, byte cap) are
 * shared with the A2A client; this module keeps only the MCP peer's own policy on top of them.
 */
import { isIP } from 'node:net';
import { isLoopbackAddress, type ResolveHost, resolvePinnedAddress } from '#lib/server/http/egress-address.ts';
import { createPeerEgressFetch } from '#lib/server/http/peer-egress.ts';
import type { EgressRequestImpl } from '#lib/server/http/pinned-fetch.ts';
import { MAX_PEER_RESPONSE_BYTES } from './config';
import type { McpPeer, SecretResolver } from './peer';

export type EndpointProblem =
	| 'invalid_url'
	| 'insecure_scheme'
	| 'credentials_in_url'
	| 'private_address'
	| 'unresolvable_host'
	| 'missing_secret'
	| 'foreign_origin'
	| 'redirect'
	| 'response_too_large';

/** The problems raised before any byte of a request left: the request provably was not sent. */
export const PRE_SEND_PROBLEMS: ReadonlySet<EndpointProblem> = new Set([
	'invalid_url',
	'insecure_scheme',
	'credentials_in_url',
	'private_address',
	'unresolvable_host',
	'missing_secret',
	'foreign_origin',
]);

export class PeerEndpointError extends Error {
	constructor(
		readonly problem: EndpointProblem,
		message: string,
	) {
		super(message);
		this.name = 'PeerEndpointError';
	}
}

export interface EndpointOptions {
	/**
	 * Allows `http://` to a loopback address. Tests and the interop script set it; nothing that
	 * reads a stored peer config may. Loopback still needs a `privateDestinations` entry.
	 */
	allowLoopbackHttp?: boolean;
	/** Injected for tests; the default is the system resolver. */
	resolveHost?: ResolveHost;
	/** Extra trusted CA (PEM) for a test peer's self-signed certificate. Tests only. */
	tlsCa?: string;
	/** Replaces `node:http(s).request` under the pinned fetch. Tests only. */
	requestImpl?: EgressRequestImpl;
}

// ── the URL and address checks ────────────────────────────────────────────────────────────

/** The URL, parsed, when it passes rules 1 and 2; throws `PeerEndpointError` otherwise. */
export function parsePeerUrl(raw: string, options: EndpointOptions = {}): URL {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		throw new PeerEndpointError('invalid_url', 'The peer URL does not parse.');
	}
	if (url.username || url.password) {
		throw new PeerEndpointError('credentials_in_url', 'A peer URL may not carry credentials; use a secret reference.');
	}
	if (url.protocol === 'https:') return url;
	if (url.protocol === 'http:' && options.allowLoopbackHttp) {
		const host = url.hostname.replace(/^\[|\]$/g, '');
		if (isIP(host) !== 0 && isLoopbackAddress(host)) return url;
	}
	throw new PeerEndpointError('insecure_scheme', 'A peer must be reached over https.');
}

const portOf = (url: URL) => (url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80);

/**
 * Rule 3: resolves the host once and returns the one address a request to `url` may connect
 * to. Throws `private_address` when any answer is non-public and not a listed destination.
 */
export async function resolvePeerAddress(url: URL, peer: McpPeer, options: EndpointOptions = {}): Promise<string> {
	const resolution = await resolvePinnedAddress(url.hostname, portOf(url), {
		resolveHost: options.resolveHost,
		privateDestinations: peer.privateDestinations,
	});
	if (resolution.ok) return resolution.address;
	if (resolution.reason === 'unresolvable') {
		throw new PeerEndpointError('unresolvable_host', 'The peer host does not resolve.');
	}
	throw new PeerEndpointError('private_address', 'The peer resolves to a private, loopback or link-local address.');
}

/** Rules 1–3 for one peer, as a pre-flight: the parsed URL, ready to connect to. */
export async function checkPeerEndpoint(peer: McpPeer, options: EndpointOptions = {}): Promise<URL> {
	const url = parsePeerUrl(peer.url, options);
	await resolvePeerAddress(url, peer, options);
	return url;
}

// ── the guarded fetch ─────────────────────────────────────────────────────────────────────

export interface McpPeerFetchOptions extends EndpointOptions {
	resolveSecret: SecretResolver;
	maxResponseBytes?: number;
}

/**
 * The only `fetch` the peer's transport gets (rules 3 and 4, per request), built on the shared
 * peer egress (`#lib/server/http/peer-egress.ts`: header hygiene, pinned connect, no redirects,
 * byte cap). What stays here is the MCP policy: every request goes to the peer's own origin;
 * one aimed anywhere else (an OAuth discovery URL, a redirect target the SDK computed) is
 * refused rather than checked, since nothing here configures OAuth.
 */
export function createMcpPeerFetch(peer: McpPeer, options: McpPeerFetchOptions): typeof fetch {
	const origin = parsePeerUrl(peer.url, options).origin;
	return createPeerEgressFetch({
		admit: (url) => {
			const target = parsePeerUrl(url.href, options);
			if (target.origin !== origin) {
				throw new PeerEndpointError('foreign_origin', 'A peer request may only go to the peer origin.');
			}
			return { privateDestinations: peer.privateDestinations };
		},
		authorization: () => {
			if (peer.auth.kind !== 'bearer') return null;
			const secret = options.resolveSecret(peer.auth.secretRef);
			if (!secret) throw new PeerEndpointError('missing_secret', 'The peer secret reference is not set.');
			return `Bearer ${secret}`;
		},
		refuse: (problem, message) => new PeerEndpointError(problem, message),
		maxResponseBytes: options.maxResponseBytes ?? MAX_PEER_RESPONSE_BYTES,
		resolveHost: options.resolveHost,
		tlsCa: options.tlsCa,
		requestImpl: options.requestImpl,
	});
}
