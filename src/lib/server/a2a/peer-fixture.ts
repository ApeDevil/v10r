/**
 * Test fixture: an A2A peer on a real loopback socket (http, or https with a throwaway
 * certificate for a host name), answering through a web `Request → Response` handler. The
 * delegation client is tested on the wire — the shared pinned egress included — never through
 * an injected `fetch`. Imported by the suites only.
 */
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import type { PrivateDestination } from '#lib/server/http/egress-address.ts';
import { buildArchitectureReviewCard } from './agent-card.ts';
import { respondToA2aPost } from './http.adapter.ts';

export interface ServedA2aPeer {
	/** The origin the peer is reached at (`http://127.0.0.1:port`, or `https://<name>:port`). */
	origin: string;
	port: number;
	/** The private destination that lets a policy reach this loopback peer. */
	destinations: PrivateDestination[];
	/** Every request the peer received, as method + path. */
	seen: string[];
	close(): Promise<void>;
}

export type A2aPeerHandler = (request: Request, origin: string) => Response | Promise<Response>;

/** v10r's own review agent — the JS side of the protocol. */
export const v10rReviewAgent: A2aPeerHandler = (request, origin) => {
	const url = new URL(request.url);
	if (url.pathname === '/.well-known/agent-card.json') return Response.json(buildArchitectureReviewCard(origin));
	return respondToA2aPost(request, origin);
};

export async function serveA2aPeer(
	handler: A2aPeerHandler,
	options: { tls?: { key: string; cert: string; hostname: string } } = {},
): Promise<ServedA2aPeer> {
	const seen: string[] = [];
	let origin = '';
	const listener = async (req: http.IncomingMessage, res: http.ServerResponse) => {
		seen.push(`${req.method} ${req.url}`);
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		const headers = new Headers();
		for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
		const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks);
		const controller = new AbortController();
		res.on('close', () => controller.abort());
		try {
			const response = await handler(
				new Request(new URL(req.url ?? '/', origin), {
					method: req.method,
					headers,
					body,
					signal: controller.signal,
				}),
				origin,
			);
			res.writeHead(response.status, Object.fromEntries(response.headers));
			if (!response.body) {
				res.end();
				return;
			}
			for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
				if (res.destroyed) break;
				res.write(chunk);
			}
			res.end();
		} catch {
			if (!res.headersSent) res.writeHead(500);
			res.end();
		}
	};
	const server = options.tls
		? https.createServer({ key: options.tls.key, cert: options.tls.cert }, listener)
		: http.createServer(listener);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;
	origin = options.tls ? `https://${options.tls.hostname}:${port}` : `http://127.0.0.1:${port}`;
	return {
		origin,
		port,
		destinations: [{ cidr: '127.0.0.1/32', port }],
		seen,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
}
