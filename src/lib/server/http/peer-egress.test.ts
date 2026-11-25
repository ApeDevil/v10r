/**
 * The shared peer egress on its own: admission is the caller's, everything else — header
 * hygiene, the pinned connect, redirect refusal, the byte cap, abort — is held here once for
 * the MCP and the A2A client. Real loopback sockets; one https server with a certificate for
 * `peer.test`.
 */
import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ResolveHost } from './egress-address';
import { createPeerEgressFetch, type PeerEgressOptions, type PeerEgressProblem } from './peer-egress';
import { EgressRequestError, type EgressRequestImpl } from './pinned-fetch';
import { selfSignedCertificate } from './tls-fixture';

class Refused extends Error {
	constructor(readonly problem: PeerEgressProblem | 'admission') {
		super(problem);
	}
}

let server: http.Server;
let port = 0;
const seen: http.IncomingHttpHeaders[] = [];

beforeAll(async () => {
	server = http.createServer((req, res) => {
		seen.push(req.headers);
		if (req.url === '/redirect') {
			res.writeHead(307, { location: 'http://169.254.169.254/latest/meta-data/' });
			res.end();
		} else if (req.url === '/declared-large') {
			res.writeHead(200, { 'content-length': '4096' });
			res.end('x'.repeat(4096));
		} else if (req.url === '/streamed-large') {
			res.writeHead(200, { 'content-type': 'text/event-stream' });
			res.write('data: one\n\n');
			setTimeout(() => res.end(`data: ${'x'.repeat(4096)}\n\n`), 10);
		} else if (req.url === '/hang') {
			res.writeHead(200, { 'content-type': 'text/event-stream' });
			res.write('data: started\n\n');
		} else {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify(req.headers));
		}
	});
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise<void>((resolve) => server.close(() => resolve()));
});

function egress(extra: Partial<PeerEgressOptions> = {}) {
	return createPeerEgressFetch({
		admit: () => ({ privateDestinations: [{ cidr: '127.0.0.1/32', port }] }),
		refuse: (problem) => new Refused(problem),
		maxResponseBytes: 1024,
		resolveHost: async () => ['127.0.0.1'],
		...extra,
	});
}

const url = (path: string) => `http://peer.test:${port}${path}`;

describe('peer egress — admission and credentials', () => {
	it('asks the protocol first: a refused admission sends nothing and resolves nothing', async () => {
		let lookups = 0;
		const fetch = egress({
			admit: () => {
				throw new Refused('admission');
			},
			resolveHost: async () => {
				lookups++;
				return ['127.0.0.1'];
			},
		});
		await expect(fetch(url('/'))).rejects.toMatchObject({ problem: 'admission' });
		expect(lookups).toBe(0);
	});

	it('strips the caller’s cookie and authorization and sends only the peer credential', async () => {
		const fetch = egress({ authorization: () => 'Bearer peer-secret' });
		const response = await fetch(url('/'), {
			headers: { cookie: 's=1', authorization: 'Bearer user', 'proxy-authorization': 'Basic x', 'x-keep': '1' },
		});
		const headers = (await response.json()) as Record<string, string>;
		expect(headers.authorization).toBe('Bearer peer-secret');
		expect(headers.cookie).toBeUndefined();
		expect(headers['proxy-authorization']).toBeUndefined();
		expect(headers['x-keep']).toBe('1');
		expect(headers.host).toBe(`peer.test:${port}`);
	});

	it('sends no authorization at all when the peer has no credential', async () => {
		const response = await egress()(url('/'), { headers: { authorization: 'Bearer user' } });
		expect(((await response.json()) as Record<string, string>).authorization).toBeUndefined();
	});
});

describe('peer egress — the pinned connect', () => {
	it('loopback is refused unless the admission lists it, on that port', async () => {
		const unlisted = egress({ admit: () => ({}) });
		await expect(unlisted(url('/'))).rejects.toMatchObject({ problem: 'private_address' });
		const otherPort = egress({ admit: () => ({ privateDestinations: [{ cidr: '127.0.0.1/32', port: 1 }] }) });
		await expect(otherPort(url('/'))).rejects.toMatchObject({ problem: 'private_address' });
	});

	it('an unresolvable host is its own refusal', async () => {
		const fetch = egress({
			resolveHost: async () => {
				throw new Error('NXDOMAIN');
			},
		});
		await expect(fetch(url('/'))).rejects.toMatchObject({ problem: 'unresolvable_host' });
	});

	it('DNS rebinding: one lookup per request, and the socket goes to the validated answer', async () => {
		let lookups = 0;
		const rebinding: ResolveHost = async () => (++lookups === 1 ? ['93.184.216.34'] : ['10.0.0.1']);
		const opened: string[] = [];
		const requestImpl: EgressRequestImpl = (options) => {
			opened.push(String(options.host));
			return new http.ClientRequest({ host: '127.0.0.1', port: 1, agent: false });
		};
		const fetch = egress({ admit: () => ({}), resolveHost: rebinding, requestImpl });
		await fetch('https://peer.example/first').catch(() => undefined);
		await expect(fetch('https://peer.example/second')).rejects.toMatchObject({ problem: 'private_address' });
		expect(lookups).toBe(2);
		expect(opened).toEqual(['93.184.216.34']);
	});
});

describe('peer egress — what comes back', () => {
	it('a redirect is a refusal, never followed', async () => {
		await expect(egress()(url('/redirect'))).rejects.toMatchObject({ problem: 'redirect' });
	});

	it('a declared body past the cap is refused before it is read', async () => {
		await expect(egress()(url('/declared-large'))).rejects.toMatchObject({ problem: 'response_too_large' });
	});

	it('a streamed body still streams, and errors once it passes the cap', async () => {
		const response = await egress()(url('/streamed-large'));
		const reader = (response.body as ReadableStream<Uint8Array>).getReader();
		const first = await reader.read();
		expect(new TextDecoder().decode(first.value)).toBe('data: one\n\n');
		await expect(
			(async () => {
				for (;;) if ((await reader.read()).done) return;
			})(),
		).rejects.toMatchObject({ problem: 'response_too_large' });
	});

	it('the egress signal aborts a request mid-stream', async () => {
		const controller = new AbortController();
		const response = await egress({ signal: controller.signal })(url('/hang'));
		const reader = (response.body as ReadableStream<Uint8Array>).getReader();
		await reader.read();
		setTimeout(() => controller.abort(), 20);
		await expect(reader.read()).rejects.toBeDefined();
	});

	it('an egress signal already aborted refuses before connecting: provably not sent', async () => {
		const error = await egress({ signal: AbortSignal.abort() })(url('/')).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(EgressRequestError);
		expect((error as EgressRequestError).requestSent).toBe(false);
	});
});

const tls = selfSignedCertificate('peer.test');

describe.skipIf(!tls)('peer egress — TLS keeps the name', () => {
	let secure: https.Server;
	let securePort = 0;
	beforeAll(async () => {
		secure = https.createServer({ key: tls?.key, cert: tls?.cert }, (req, res) => {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ sni: (req.socket as unknown as { servername?: string }).servername }));
		});
		await new Promise<void>((resolve) => secure.listen(0, '127.0.0.1', resolve));
		securePort = (secure.address() as AddressInfo).port;
	});
	afterAll(async () => {
		secure.closeAllConnections();
		await new Promise<void>((resolve) => secure.close(() => resolve()));
	});

	const tlsEgress = () =>
		egress({ admit: () => ({ privateDestinations: [{ cidr: '127.0.0.1/32', port: securePort }] }), tlsCa: tls?.cert });

	it('connects to the pinned address with SNI and the certificate checked for the name', async () => {
		const response = await tlsEgress()(`https://peer.test:${securePort}/`);
		expect(await response.json()).toEqual({ sni: 'peer.test' });
	});

	it('another name on the same address fails the certificate check before anything is sent', async () => {
		const error = await tlsEgress()(`https://other.test:${securePort}/`).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(EgressRequestError);
		expect((error as EgressRequestError).requestSent).toBe(false);
		expect(String((error as Error).cause)).toMatch(/altname|Hostname/i);
	});
});
