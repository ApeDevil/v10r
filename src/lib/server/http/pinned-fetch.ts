/**
 * A `fetch` that connects to an address the caller already validated — connect-time pinning.
 *
 * The web `fetch` takes a URL and resolves its host itself, so "check the address, then fetch
 * by name" is two lookups, and a DNS-rebinding resolver can answer a public address to the
 * check and a private one to the connect. `fetchPinned` closes that gap without an egress
 * proxy or a new dependency: it opens the socket to the pinned IP with `node:http` /
 * `node:https` and keeps the NAME for everything the name is for — the TLS SNI (`servername`),
 * certificate verification (checked against `servername`, so a pinned IP still has to present
 * the host's certificate) and the `Host` header. There is no second lookup to rebind.
 *
 * Runtimes: Node 22 (the Vercel `nodejs22.x` functions v10r deploys to) and Bun 1.4 both honour
 * `servername` and verify the certificate against it (probed: a mismatched name fails with
 * `ERR_TLS_CERT_ALTNAME_INVALID` on both). `agent: false` — one connection per request, so no
 * pooled socket outlives the address check that opened it; an `HTTPS_PROXY` is NOT used, since a
 * proxy would resolve the name again.
 *
 * A failure carries `requestSent`: false only when the socket never reached the point where a
 * request byte could leave (connect refused, TLS refused, aborted before connecting). A caller
 * deciding whether a mutation may have happened reads that, never the error text.
 */
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { Readable } from 'node:stream';

export class EgressRequestError extends Error {
	constructor(
		/** False only when provably nothing of the request left this process. */
		readonly requestSent: boolean,
		message: string,
		options?: { cause?: unknown },
	) {
		super(message, options);
		this.name = 'EgressRequestError';
	}
}

/** `http.request` / `https.request`, injectable so a test can observe what would be opened. */
export type EgressRequestImpl = (
	options: https.RequestOptions,
	onResponse: (response: http.IncomingMessage) => void,
) => http.ClientRequest;

export interface PinnedFetchOptions {
	/** Extra trusted CA certificates (PEM) — for a test peer with a self-signed certificate. */
	ca?: string;
	/** Replaces `node:http(s).request`; tests only. */
	requestImpl?: EgressRequestImpl;
}

/** Statuses whose response may not carry a body (the `Response` constructor refuses one). */
const NULL_BODY = new Set([101, 103, 204, 205, 304]);

async function bodyBytes(body: RequestInit['body']): Promise<Buffer | undefined> {
	if (body === undefined || body === null) return undefined;
	if (typeof body === 'string') return Buffer.from(body);
	if (body instanceof Uint8Array) return Buffer.from(body);
	if (body instanceof ArrayBuffer) return Buffer.from(new Uint8Array(body));
	return Buffer.from(await new Response(body).arrayBuffer());
}

/**
 * Sends one request to `url`, over a socket opened to `address`. `url`'s host stays the TLS
 * name and the `Host` header; `address` is the only place the socket may go.
 */
export async function fetchPinned(
	url: URL,
	address: string,
	init: RequestInit = {},
	options: PinnedFetchOptions = {},
): Promise<Response> {
	const secure = url.protocol === 'https:';
	if (!secure && url.protocol !== 'http:') throw new EgressRequestError(false, `unsupported scheme ${url.protocol}`);
	const hostname = url.hostname.replace(/^\[|\]$/g, '');
	const headers: Record<string, string> = {};
	new Headers(init.headers).forEach((value, key) => {
		headers[key] = value;
	});
	headers.host = url.host;
	const body = await bodyBytes(init.body);
	if (body) headers['content-length'] = String(body.byteLength);
	const signal = init.signal ?? undefined;
	if (signal?.aborted) throw new EgressRequestError(false, 'aborted before connecting', { cause: signal.reason });

	const request =
		options.requestImpl ??
		((requestOptions: https.RequestOptions, onResponse: (response: http.IncomingMessage) => void) =>
			secure ? https.request(requestOptions, onResponse) : http.request(requestOptions, onResponse));

	return new Promise<Response>((resolve, reject) => {
		let connected = false;
		const req = request(
			{
				host: address.replace(/^\[|\]$/g, ''),
				port: url.port ? Number(url.port) : secure ? 443 : 80,
				path: `${url.pathname}${url.search}`,
				method: init.method ?? 'GET',
				headers,
				agent: false,
				signal,
				...(secure ? { servername: isIP(hostname) === 0 ? hostname : undefined, ca: options.ca } : {}),
			},
			(response) => {
				const status = response.statusCode ?? 0;
				const responseHeaders = new Headers();
				const raw = response.rawHeaders;
				for (let i = 0; i + 1 < raw.length; i += 2) responseHeaders.append(raw[i] ?? '', raw[i + 1] ?? '');
				if (NULL_BODY.has(status) || init.method === 'HEAD') {
					response.resume();
					resolve(new Response(null, { status, statusText: response.statusMessage, headers: responseHeaders }));
					return;
				}
				const stream = Readable.toWeb(response) as unknown as ReadableStream<Uint8Array>;
				resolve(new Response(stream, { status, statusText: response.statusMessage, headers: responseHeaders }));
			},
		);
		req.on('socket', (socket) => {
			socket.once(secure ? 'secureConnect' : 'connect', () => {
				connected = true;
			});
		});
		req.on('error', (error) => {
			reject(new EgressRequestError(connected, 'the request to the pinned address failed', { cause: error }));
		});
		req.end(body);
	});
}

/** True when `error`, or anything in its cause chain, proves the request never left. */
export function provablyNotSent(error: unknown): boolean {
	for (let e: unknown = error, depth = 0; e && depth < 6; depth++) {
		if (e instanceof EgressRequestError) return !e.requestSent;
		e = (e as { cause?: unknown }).cause;
	}
	return false;
}
