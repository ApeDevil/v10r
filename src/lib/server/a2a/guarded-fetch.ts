/**
 * The only `fetch` the A2A client is given: the shared peer egress
 * (`#lib/server/http/peer-egress.ts` — pinned connect with TLS name checks, header hygiene, no
 * redirects, byte cap, abort) under the A2A peer policy (`peer-policy.ts`) for every URL.
 *
 * What is A2A's own here: the allowlist check for each URL (the card's interface URL included),
 * the credential — none, or the operator's bearer for this peer by secret reference — and the
 * refusal vocabulary. A refusal is recorded on the returned handle as well as thrown: the SDK
 * wraps transport errors in its own, and the caller wants the precise reason, not the SDK's
 * paraphrase of it.
 */
import type { ResolveHost } from '#lib/server/http/egress-address.ts';
import { createPeerEgressFetch, type PeerEgressProblem } from '#lib/server/http/peer-egress.ts';
import type { EgressRequestImpl } from '#lib/server/http/pinned-fetch.ts';
import { checkPeerUrl, type PeerPolicy, type PeerRefusalCode, type PeerUrlOptions } from './peer-policy.ts';

export type FetchRefusalCode = PeerRefusalCode | PeerEgressProblem | 'missing_secret';

/** The refusals raised before any byte of a request left: nothing was sent. */
export const PRE_SEND_REFUSALS: ReadonlySet<FetchRefusalCode> = new Set([
	'invalid_url',
	'not_allowlisted',
	'insecure_scheme',
	'private_address',
	'unresolvable_host',
	'missing_secret',
]);

export class PeerFetchRefusal extends Error {
	constructor(
		readonly code: FetchRefusalCode,
		message: string,
	) {
		super(message);
		this.name = 'PeerFetchRefusal';
	}
}

/** The transport knobs a caller may set; everything else is policy. */
export interface A2aTransportOptions extends PeerUrlOptions {
	resolveHost?: ResolveHost;
	/** Extra trusted CA (PEM) for a test peer's self-signed certificate. Tests only. */
	tlsCa?: string;
	/** Replaces `node:http(s).request`. Tests only. */
	requestImpl?: EgressRequestImpl;
}

export interface A2aPeerFetchOptions extends A2aTransportOptions {
	policy: PeerPolicy;
	/** Aborts every request made through this fetch (the delegation's deadline). */
	signal: AbortSignal;
	responseBytes: number;
	/**
	 * The peer's bearer secret, resolved from the operator's secret reference at request time.
	 * Absent: no credential is sent. Present but answering nothing: the request is refused
	 * (`missing_secret`) before it leaves.
	 */
	bearerSecret?: () => string | undefined;
}

export interface A2aPeerFetch {
	fetch: typeof fetch;
	/** The first refusal this fetch raised, if any. */
	refusal(): PeerFetchRefusal | null;
}

export function createA2aPeerFetch(options: A2aPeerFetchOptions): A2aPeerFetch {
	let first: PeerFetchRefusal | null = null;
	const refusal = (code: FetchRefusalCode, message: string): PeerFetchRefusal => {
		const raised = new PeerFetchRefusal(code, message);
		first ??= raised;
		return raised;
	};
	const fetch = createPeerEgressFetch({
		admit: (url) => {
			const check = checkPeerUrl(url.href, options.policy, options);
			if (!check.ok) throw refusal(check.code, check.message);
			return { privateDestinations: check.peer.privateDestinations };
		},
		authorization: () => {
			if (!options.bearerSecret) return null;
			const secret = options.bearerSecret();
			if (!secret) throw refusal('missing_secret', 'the peer secret reference is not set');
			return `Bearer ${secret}`;
		},
		refuse: refusal,
		maxResponseBytes: options.responseBytes,
		signal: options.signal,
		resolveHost: options.resolveHost,
		tlsCa: options.tlsCa,
		requestImpl: options.requestImpl,
	});
	return { fetch, refusal: () => first };
}
