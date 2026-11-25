/**
 * Test fixture: an MCP server built with the official `@modelcontextprotocol/server`, served
 * in-process over loopback HTTP (or HTTPS with a throwaway certificate), so the client is tested
 * against the real SDK on a real socket. Imported by the suites only.
 *
 * `onWire` sees every request body before the SDK does; returning true means the hook answered
 * (or destroyed) the exchange itself — how a test simulates a connection reset after a
 * `tools/call` reached the peer.
 */
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { createMcpHandler, type McpServer, type Server } from '@modelcontextprotocol/server';

export interface ServedPeer {
	url: string;
	port: number;
	close(): Promise<void>;
}

export interface ServePeerOptions {
	/** Serve https with this key and certificate; `url` then names `hostname`. */
	tls?: { key: string; cert: string; hostname: string };
	onWire?: (body: string, req: http.IncomingMessage, res: http.ServerResponse) => boolean;
}

export async function servePeer(
	factory: () => McpServer | Server,
	options: ServePeerOptions = {},
): Promise<ServedPeer> {
	const handler = createMcpHandler(factory);
	const listener = async (req: http.IncomingMessage, res: http.ServerResponse) => {
		const chunks: Buffer[] = [];
		for await (const chunk of req) chunks.push(chunk as Buffer);
		const body = Buffer.concat(chunks);
		if (options.onWire?.(body.toString('utf8'), req, res)) return;
		const headers = new Headers();
		for (const [key, value] of Object.entries(req.headers)) if (typeof value === 'string') headers.set(key, value);
		const response = await handler.fetch(
			new Request(`http://${req.headers.host}${req.url}`, {
				method: req.method,
				headers,
				body: body.length > 0 ? body : undefined,
			}),
		);
		const out: Record<string, string> = {};
		response.headers.forEach((v, k) => {
			out[k] = v;
		});
		res.writeHead(response.status, out);
		res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
	};
	const server = options.tls
		? https.createServer({ key: options.tls.key, cert: options.tls.cert }, listener)
		: http.createServer(listener);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address() as AddressInfo;
	const host = options.tls ? options.tls.hostname : '127.0.0.1';
	return {
		url: `${options.tls ? 'https' : 'http'}://${host}:${port}/mcp`,
		port,
		close: () =>
			new Promise<void>((resolve) => {
				server.closeAllConnections();
				server.close(() => resolve());
			}),
	};
}
