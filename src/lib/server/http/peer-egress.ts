/**
 * Peer egress — the one secured outbound `fetch` to an operator-configured peer, shared by the
 * MCP client (`ai/mcp-client/endpoint-guard.ts`) and the A2A client (`a2a/guarded-fetch.ts`).
 *
 * Both protocols face the same outbound responsibilities, and each used to hold its own copy:
 * one copy pinned the socket, the other resolved and then fetched by name. They now live here
 * once, in this order, for every request:
 *
 *  1. **Admission** — the protocol's own policy (`admit`): its allowlist or origin rule, its
 *     scheme rule, the private destinations the operator listed for this peer. Protocol policy
 *     stays with the protocol; this module only asks.
 *  2. **Credential isolation** — the outgoing headers are rebuilt: `cookie`, `authorization`
 *     and `proxy-authorization` from the caller or the SDK are dropped, and the only credential
 *     sent is the one `authorization()` returns (the peer's own secret, by reference).
 *  3. **Pinned connect** — the host is resolved ONCE; every answer must be public or an exact
 *     `PrivateDestination` the admission returned (link-local never); the socket is opened to
 *     that validated address with the name kept for TLS SNI, certificate verification and `Host`
 *     (`pinned-fetch.ts`). A rebinding resolver has no second lookup to answer.
 *  4. **No redirects** — a 3xx is a refusal, never followed: a redirect target is a URL the
 *     admission never saw.
 *  5. **Bounded response** — a declared `content-length` past the cap is refused before the body
 *     is read; otherwise the body stream errors once the cap is passed, so an SSE stream still
 *     streams and an oversized JSON body is never parsed.
 *  6. **Cancellation and timeouts** — the egress `signal` (a delegation's deadline, a call's
 *     abort) is merged with the request's own, and reaches the socket.
 *
 * Errors keep each protocol's vocabulary: the protocol passes `refuse`, which builds ITS error
 * for the transport-level problems below, so MCP still throws `PeerEndpointError` and A2A its
 * `PeerFetchRefusal`, and each keeps deciding what "sent" means for its receipts.
 *
 * **Proxy restriction.** The pinned connect opens its own socket (`agent: false`) and ignores
 * `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY`: a forward proxy resolves the name again, which is
 * exactly the second lookup pinning removes. A deployment whose only route out is an egress
 * proxy cannot reach MCP or A2A peers through this module; it must allow direct outbound TLS
 * from the server functions to each peer's address (Vercel functions have direct egress). An
 * operator who must use a proxy needs a CONNECT-to-IP proxy and a change here, not a setting.
 */
import { type PrivateDestination, type ResolveHost, resolvePinnedAddress } from './egress-address.ts';
import { type EgressRequestImpl, fetchPinned } from './pinned-fetch.ts';

/** The transport-level refusals; each protocol maps them onto its own error. */
export type PeerEgressProblem = 'private_address' | 'unresolvable_host' | 'redirect' | 'response_too_large';

/** What the protocol's admission grants one URL. It throws the protocol's own error to refuse. */
export interface PeerEgressAdmission {
	/** The operator's private-network exceptions for this peer; default none. */
	privateDestinations?: readonly PrivateDestination[];
}

export interface PeerEgressOptions {
	/** The protocol policy: return the admission for `url`, or throw to refuse it. */
	admit(url: URL): PeerEgressAdmission;
	/** The one `authorization` header value to send (the peer's own secret), or null for none. Throw to refuse. */
	authorization?(): string | null;
	/** Builds the protocol's error for a transport-level problem. */
	refuse(problem: PeerEgressProblem, message: string): Error;
	maxResponseBytes: number;
	/** Aborts every request made through this fetch (a deadline, a cancellation). */
	signal?: AbortSignal;
	resolveHost?: ResolveHost;
	/** Extra trusted CA (PEM) for a test peer's self-signed certificate. Tests only. */
	tlsCa?: string;
	/** Replaces `node:http(s).request` under the pinned fetch. Tests only. */
	requestImpl?: EgressRequestImpl;
}

/** Headers the caller or an SDK may have set that must never reach a peer. */
const STRIPPED_HEADERS = ['cookie', 'authorization', 'proxy-authorization'] as const;

const portOf = (url: URL) => (url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80);

/** Fails the body stream once more than `maxBytes` arrived; the reader sees `error`. */
function capBody(body: ReadableStream<Uint8Array>, maxBytes: number, error: () => Error): ReadableStream<Uint8Array> {
	let seen = 0;
	return body.pipeThrough(
		new TransformStream<Uint8Array, Uint8Array>({
			transform(chunk, controller) {
				seen += chunk.byteLength;
				if (seen > maxBytes) controller.error(error());
				else controller.enqueue(chunk);
			},
		}),
	);
}

function mergedSignal(...signals: (AbortSignal | null | undefined)[]): AbortSignal | undefined {
	const present = signals.filter((s): s is AbortSignal => s instanceof AbortSignal);
	if (present.length <= 1) return present[0];
	return AbortSignal.any(present);
}

/** The secured `fetch` for one peer. Hand it to the protocol SDK as its only `fetch`. */
export function createPeerEgressFetch(options: PeerEgressOptions): typeof fetch {
	const egress = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const request = input instanceof Request ? input : null;
		const target = new URL(request ? request.url : String(input));
		const admission = options.admit(target);

		const headers = new Headers(request?.headers);
		for (const [key, value] of new Headers(init?.headers)) headers.set(key, value);
		for (const name of STRIPPED_HEADERS) headers.delete(name);
		const authorization = options.authorization?.() ?? null;
		if (authorization) headers.set('authorization', authorization);

		const resolution = await resolvePinnedAddress(target.hostname, portOf(target), {
			resolveHost: options.resolveHost,
			privateDestinations: admission.privateDestinations,
		});
		if (!resolution.ok) {
			throw resolution.reason === 'unresolvable'
				? options.refuse('unresolvable_host', 'the peer host does not resolve')
				: options.refuse('private_address', 'the peer resolves to a private, loopback or link-local address');
		}

		const body = init?.body ?? (request?.body ? await request.arrayBuffer() : undefined);
		const response = await fetchPinned(
			target,
			resolution.address,
			{
				method: init?.method ?? request?.method ?? 'GET',
				headers,
				body,
				signal: mergedSignal(init?.signal, request?.signal, options.signal),
			},
			{ ca: options.tlsCa, requestImpl: options.requestImpl },
		);
		if (response.status >= 300 && response.status < 400) {
			await response.body?.cancel().catch(() => {});
			throw options.refuse('redirect', `the peer answered ${response.status}; redirects are not followed`);
		}
		const tooLarge = () =>
			options.refuse('response_too_large', `the peer response exceeds ${options.maxResponseBytes} bytes`);
		const declared = Number(response.headers.get('content-length') ?? '0');
		if (declared > options.maxResponseBytes) {
			await response.body?.cancel().catch(() => {});
			throw tooLarge();
		}
		if (!response.body) return response;
		return new Response(capBody(response.body, options.maxResponseBytes, tooLarge), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	};
	return egress as typeof fetch;
}
