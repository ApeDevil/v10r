/**
 * Which URLs a delegation may reach — the A2A peer's own policy on top of the shared peer
 * egress (`#lib/server/http/peer-egress.ts`). Every outbound request of the A2A client — the
 * Agent Card fetch and every JSON-RPC call to whatever interface URL that card names — passes
 * `checkPeerUrl` first, so a card cannot point the client somewhere the policy never allowed.
 *
 * Layers, in order, each a refusal:
 *   1. a well-formed absolute http(s) URL without credentials;
 *   2. an IP-literal host must be public or an exact `PrivateDestination` the operator listed
 *      for this peer (cloud metadata `169.254.169.254` and all link-local space never) —
 *      checked BEFORE the allowlist, so allowlisting a private address by mistake does not
 *      open it;
 *   3. the URL's origin must be on the explicit peer allowlist;
 *   4. https, except plain http to a loopback IP literal when the CALLER passes
 *      `allowLoopbackHttp` (tests and the interop run) — a stored peer config cannot carry it.
 *
 * The named-host check is not here: the egress resolves the name once, validates every answer
 * against the same private destinations and connects to that address (pinned), so a
 * DNS-rebinding answer has no second lookup to win. Address classification is shared with the
 * MCP client (`#lib/server/http/egress-address.ts`).
 */
import { isIP } from 'node:net';
import {
	isAllowedPrivateDestination,
	isLoopbackAddress,
	isNonPublicAddress,
	type PrivateDestination,
} from '#lib/server/http/egress-address.ts';

export interface A2aPeer {
	/** The peer's origin (`https://reviews.example`), compared exactly with each URL's origin. */
	origin: string;
	/**
	 * Private addresses this peer may be reached on — an exact narrow range plus one port per
	 * entry, default none. A peer on loopback or a private network needs one; link-local
	 * (the metadata service) can never be listed.
	 */
	privateDestinations?: readonly PrivateDestination[];
}

export interface PeerPolicy {
	peers: readonly A2aPeer[];
}

/** Caller-side switches, never part of a stored peer config. */
export interface PeerUrlOptions {
	/** Permit plain http to a loopback IP literal. Tests and the interop script only. */
	allowLoopbackHttp?: boolean;
}

export type PeerRefusalCode = 'invalid_url' | 'not_allowlisted' | 'insecure_scheme' | 'private_address';

export type PeerUrlCheck =
	| { ok: true; peer: A2aPeer; url: URL }
	| { ok: false; code: PeerRefusalCode; message: string };

const portOf = (url: URL) => (url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80);

function refuse(code: PeerRefusalCode, message: string): PeerUrlCheck {
	return { ok: false, code, message };
}

export function checkPeerUrl(raw: string, policy: PeerPolicy, options: PeerUrlOptions = {}): PeerUrlCheck {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return refuse('invalid_url', 'not an absolute URL');
	}
	if (url.protocol !== 'https:' && url.protocol !== 'http:') return refuse('invalid_url', `scheme ${url.protocol}`);
	if (url.username || url.password) return refuse('invalid_url', 'credentials in the URL');

	const host = url.hostname.replace(/^\[|\]$/g, '');
	const peer = policy.peers.find((entry) => entry.origin === url.origin);
	if (isIP(host) && isNonPublicAddress(host)) {
		if (!isAllowedPrivateDestination(host, portOf(url), peer?.privateDestinations)) {
			return refuse('private_address', `${host} is not a public address`);
		}
	}
	if (!peer) return refuse('not_allowlisted', `${url.origin} is not an allowlisted peer`);

	const loopbackLiteral = isIP(host) !== 0 && isLoopbackAddress(host);
	if (url.protocol !== 'https:' && !(loopbackLiteral && options.allowLoopbackHttp)) {
		return refuse('insecure_scheme', 'https is required for a peer');
	}
	return { ok: true, peer, url };
}
