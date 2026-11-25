/**
 * Connect-time pinning on the wire: a real TLS server on loopback with a certificate for the
 * name `peer.test` (made with `openssl` for this run), reached by NAME through a pinned address.
 */
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { EgressRequestError, type EgressRequestImpl, fetchPinned, provablyNotSent } from './pinned-fetch';
import { selfSignedCertificate } from './tls-fixture';

const tls = selfSignedCertificate('peer.test');
let server: https.Server;
let port = 0;
const seen: Array<{ sni: string | false | undefined; host: string | undefined; body: string }> = [];

beforeAll(async () => {
	if (!tls) return;
	server = https.createServer({ key: tls.key, cert: tls.cert }, async (req, res) => {
		let body = '';
		for await (const chunk of req) body += chunk;
		seen.push({
			sni: (req.socket as unknown as { servername?: string | false }).servername,
			host: req.headers.host,
			body,
		});
		if (req.url === '/reset') {
			req.socket.destroy();
			return;
		}
		res.writeHead(200, { 'content-type': 'text/event-stream', 'x-peer': 'yes' });
		res.write('data: one\n\n');
		setTimeout(() => res.end('data: two\n\n'), 20);
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
	if (!tls) return;
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe.skipIf(!tls)('fetchPinned over TLS', () => {
	it('connects to the pinned address and keeps the name for SNI, the certificate and Host', async () => {
		const response = await fetchPinned(
			new URL(`https://peer.test:${port}/mcp?x=1`),
			'127.0.0.1',
			{ method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"a":1}' },
			{ ca: tls?.cert },
		);
		expect(response.status).toBe(200);
		expect(response.headers.get('x-peer')).toBe('yes');
		expect(await response.text()).toBe('data: one\n\ndata: two\n\n');
		expect(seen.at(-1)).toEqual({ sni: 'peer.test', host: `peer.test:${port}`, body: '{"a":1}' });
	});

	it('a pinned address that cannot present the name’s certificate is refused before anything is sent', async () => {
		const error = await fetchPinned(
			new URL(`https://other.test:${port}/mcp`),
			'127.0.0.1',
			{},
			{ ca: tls?.cert },
		).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(EgressRequestError);
		expect((error as EgressRequestError).requestSent).toBe(false);
		expect(String((error as Error).cause)).toMatch(/altname|Hostname/i);
	});

	it('a connection reset after the request left reads as possibly sent', async () => {
		const error = await fetchPinned(
			new URL(`https://peer.test:${port}/reset`),
			'127.0.0.1',
			{ method: 'POST', body: '{}' },
			{ ca: tls?.cert },
		).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(EgressRequestError);
		expect((error as EgressRequestError).requestSent).toBe(true);
		expect(provablyNotSent(error)).toBe(false);
	});
});

describe('fetchPinned, plain', () => {
	it('a refused connection is provably not sent', async () => {
		const closed = http.createServer();
		await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
		const freePort = (closed.address() as AddressInfo).port;
		await new Promise<void>((resolve) => closed.close(() => resolve()));
		const error = await fetchPinned(new URL(`http://peer.test:${freePort}/`), '127.0.0.1').catch((e: unknown) => e);
		expect(provablyNotSent(error)).toBe(true);
	});

	it('an aborted signal is refused before connecting', async () => {
		const error = await fetchPinned(new URL('http://peer.test:1/'), '127.0.0.1', {
			signal: AbortSignal.abort(),
		}).catch((e: unknown) => e);
		expect(provablyNotSent(error)).toBe(true);
	});

	it('opens the socket to the pinned public address, never to the name', async () => {
		const opened: Parameters<EgressRequestImpl>[0][] = [];
		const requestImpl: EgressRequestImpl = (options) => {
			opened.push(options);
			const req = new http.ClientRequest({ host: '127.0.0.1', port: 1, agent: false });
			return req;
		};
		await fetchPinned(
			new URL('https://mcp.example.com/mcp'),
			'93.184.216.34',
			{ method: 'POST', body: '{}' },
			{
				requestImpl,
			},
		).catch(() => undefined);
		expect(opened).toHaveLength(1);
		expect(opened[0]).toMatchObject({
			host: '93.184.216.34',
			port: 443,
			servername: 'mcp.example.com',
			path: '/mcp',
			agent: false,
		});
		expect((opened[0]?.headers as Record<string, string>).host).toBe('mcp.example.com');
	});
});
