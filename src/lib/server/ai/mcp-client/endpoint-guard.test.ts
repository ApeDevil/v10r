import http from 'node:http';
import https from 'node:https';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { isNonPublicAddress } from '#lib/server/http/egress-address.ts';
import type { EgressRequestImpl } from '#lib/server/http/pinned-fetch.ts';
import { selfSignedCertificate } from '#lib/server/http/tls-fixture.ts';
import { checkPeerEndpoint, createMcpPeerFetch, parsePeerUrl, resolvePeerAddress } from './endpoint-guard';
import type { McpPeer } from './peer';

const peer = (over: Partial<McpPeer> = {}): McpPeer => ({
	id: 'docs',
	url: 'https://mcp.example.com/mcp',
	transport: 'streamable-http',
	auth: { kind: 'none' },
	policy: { allowTools: ['search'], readOnlyTools: [] },
	...over,
});

/** The one private destination a loopback test server is: its exact address and port. */
const loopbackAt = (origin: string) => [{ cidr: '127.0.0.1/32', port: Number(new URL(origin).port) }];

const resolvesTo =
	(...addresses: string[]) =>
	async () =>
		addresses;

describe('isNonPublicAddress', () => {
	it.each([
		'169.254.169.254',
		'169.254.0.1',
		'10.0.0.1',
		'172.16.0.1',
		'172.31.255.255',
		'192.168.1.1',
		'127.0.0.1',
		'127.8.8.8',
		'0.0.0.0',
		'100.64.0.1',
		'224.0.0.1',
		'::1',
		'::',
		'fc00::1',
		'fd00:ec2::254',
		'fe80::1',
		'febf::1',
		'::ffff:127.0.0.1',
		'::ffff:169.254.169.254',
		'::ffff:a9fe:a9fe',
		'64:ff9b::a9fe:a9fe',
		'not-an-ip',
	])('blocks %s', (address) => {
		expect(isNonPublicAddress(address)).toBe(true);
	});

	it.each([
		'93.184.216.34',
		'8.8.8.8',
		'172.32.0.1',
		'192.169.0.1',
		'2606:4700::1111',
		'::ffff:8.8.8.8',
	])('allows %s', (address) => {
		expect(isNonPublicAddress(address)).toBe(false);
	});
});

describe('parsePeerUrl', () => {
	it('accepts https', () => {
		expect(parsePeerUrl('https://mcp.example.com/mcp').origin).toBe('https://mcp.example.com');
	});

	it('refuses http, even to loopback, without the test flag', () => {
		expect(() => parsePeerUrl('http://mcp.example.com/mcp')).toThrow(/https/);
		expect(() => parsePeerUrl('http://127.0.0.1:9000/mcp')).toThrow(/https/);
	});

	it('allows http to a loopback literal only with the test flag', () => {
		expect(parsePeerUrl('http://127.0.0.1:9000/mcp', { allowLoopbackHttp: true }).port).toBe('9000');
		expect(parsePeerUrl('http://[::1]:9000/mcp', { allowLoopbackHttp: true }).port).toBe('9000');
		expect(() => parsePeerUrl('http://localhost:9000/mcp', { allowLoopbackHttp: true })).toThrow(/https/);
		expect(() => parsePeerUrl('http://10.0.0.5/mcp', { allowLoopbackHttp: true })).toThrow(/https/);
	});

	it('refuses credentials in the URL and non-http schemes', () => {
		expect(() => parsePeerUrl('https://user:secret@mcp.example.com/mcp')).toThrow(/credentials/);
		expect(() => parsePeerUrl('https://token@mcp.example.com/mcp')).toThrow(/credentials/);
		expect(() => parsePeerUrl('file:///etc/passwd')).toThrow(/https/);
		expect(() => parsePeerUrl('not a url')).toThrow(/parse/);
	});
});

describe('resolvePeerAddress', () => {
	it('refuses a hostname that resolves to the metadata service', async () => {
		await expect(
			resolvePeerAddress(new URL('https://evil.example/mcp'), peer(), { resolveHost: resolvesTo('169.254.169.254') }),
		).rejects.toMatchObject({ problem: 'private_address' });
	});

	it('refuses when ANY answer is private (a mixed DNS answer)', async () => {
		await expect(
			resolvePeerAddress(new URL('https://evil.example/mcp'), peer(), {
				resolveHost: resolvesTo('93.184.216.34', '10.0.0.1'),
			}),
		).rejects.toMatchObject({ problem: 'private_address' });
	});

	it('refuses an IP-literal private host without a lookup', async () => {
		await expect(resolvePeerAddress(new URL('https://[fe80::1]/mcp'), peer())).rejects.toMatchObject({
			problem: 'private_address',
		});
	});

	it('pins a public answer; a private one only when listed for that exact port', async () => {
		await expect(
			resolvePeerAddress(new URL('https://ok.example/mcp'), peer(), { resolveHost: resolvesTo('93.184.216.34') }),
		).resolves.toBe('93.184.216.34');
		const sidecar = peer({ privateDestinations: [{ cidr: '10.0.0.7/32', port: 8443 }] });
		await expect(
			resolvePeerAddress(new URL('https://sidecar.internal:8443/mcp'), sidecar, {
				resolveHost: resolvesTo('10.0.0.7'),
			}),
		).resolves.toBe('10.0.0.7');
		await expect(
			resolvePeerAddress(new URL('https://sidecar.internal/mcp'), sidecar, { resolveHost: resolvesTo('10.0.0.7') }),
		).rejects.toMatchObject({ problem: 'private_address' });
		await expect(
			resolvePeerAddress(new URL('https://sidecar.internal:8443/mcp'), sidecar, {
				resolveHost: resolvesTo('10.0.0.8'),
			}),
		).rejects.toMatchObject({ problem: 'private_address' });
	});

	it('a listed metadata address is still refused', async () => {
		const leaky = peer({ privateDestinations: [{ cidr: '169.254.169.254/32', port: 443 }] });
		await expect(
			resolvePeerAddress(new URL('https://meta.example/mcp'), leaky, { resolveHost: resolvesTo('169.254.169.254') }),
		).rejects.toMatchObject({ problem: 'private_address' });
	});

	it('reports an unresolvable host', async () => {
		await expect(
			resolvePeerAddress(new URL('https://nope.example/mcp'), peer(), {
				resolveHost: async () => {
					throw new Error('ENOTFOUND');
				},
			}),
		).rejects.toMatchObject({ problem: 'unresolvable_host' });
	});
});

describe('DNS rebinding: the address that is checked is the address that is connected to', () => {
	/** A resolver that answers public first and private ever after — the rebinding attacker. */
	function rebinding() {
		let calls = 0;
		const resolveHost = async () => (++calls === 1 ? ['93.184.216.34'] : ['10.0.0.1']);
		return { resolveHost, calls: () => calls };
	}

	/** Records every socket the pinned fetch would open; answers nothing (the request fails). */
	function recorder() {
		const opened: string[] = [];
		const requestImpl: EgressRequestImpl = (options) => {
			opened.push(String(options.host));
			return new http.ClientRequest({ host: '127.0.0.1', port: 1, agent: false });
		};
		return { requestImpl, opened };
	}

	it('one request resolves once, and opens its socket to that validated answer', async () => {
		const dns = rebinding();
		const sockets = recorder();
		const guarded = createMcpPeerFetch(peer(), { ...dns, ...sockets, resolveSecret: () => undefined });
		await guarded('https://mcp.example.com/mcp', { method: 'POST', body: '{}' }).catch(() => undefined);
		expect(dns.calls()).toBe(1);
		expect(sockets.opened).toEqual(['93.184.216.34']);
	});

	it('a pre-flight check that saw the public answer does not let the request reach the private one', async () => {
		const dns = rebinding();
		const sockets = recorder();
		await expect(checkPeerEndpoint(peer(), dns)).resolves.toBeInstanceOf(URL);
		const guarded = createMcpPeerFetch(peer(), { ...dns, ...sockets, resolveSecret: () => undefined });
		await expect(guarded('https://mcp.example.com/mcp', { method: 'POST', body: '{}' })).rejects.toMatchObject({
			problem: 'private_address',
		});
		expect(dns.calls()).toBe(2);
		expect(sockets.opened).toEqual([]);
	});
});

describe('createMcpPeerFetch', () => {
	const publicHost = { resolveHost: resolvesTo('93.184.216.34') };

	it('refuses a request to any origin but the peer', async () => {
		const guarded = createMcpPeerFetch(peer(), { ...publicHost, resolveSecret: () => undefined });
		await expect(guarded('https://other.example/token')).rejects.toMatchObject({ problem: 'foreign_origin' });
	});

	it('refuses to send when the bearer reference is unset', async () => {
		const guarded = createMcpPeerFetch(peer({ auth: { kind: 'bearer', secretRef: 'MCP_PEER_SECRET_DOCS' } }), {
			...publicHost,
			resolveSecret: () => undefined,
		});
		await expect(guarded('https://mcp.example.com/mcp', { method: 'POST' })).rejects.toMatchObject({
			problem: 'missing_secret',
		});
	});
});

describe('createMcpPeerFetch on the wire', () => {
	/** A loopback server that answers `/redirect` with a 302 and anything else with the headers it saw. */
	async function withEchoServer(run: (url: string) => Promise<void>) {
		const server = http.createServer((req, res) => {
			if (req.url === '/redirect') {
				res.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
				res.end();
				return;
			}
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify(req.headers));
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		try {
			await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
		} finally {
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	}

	it("sends only the peer's own bearer: a caller's cookie and authorization never cross", async () => {
		await withEchoServer(async (origin) => {
			const guarded = createMcpPeerFetch(
				peer({
					url: `${origin}/mcp`,
					privateDestinations: loopbackAt(origin),
					auth: { kind: 'bearer', secretRef: 'MCP_PEER_SECRET_DOCS' },
				}),
				{
					allowLoopbackHttp: true,
					resolveSecret: (ref) => (ref === 'MCP_PEER_SECRET_DOCS' ? 'peer-secret' : undefined),
				},
			);
			const response = await guarded(`${origin}/mcp`, {
				method: 'POST',
				headers: {
					cookie: 'session=user-session',
					authorization: 'Bearer user-token',
					'proxy-authorization': 'Basic dXNlcg==',
					'x-keep': '1',
				},
				body: '{}',
			});
			const seen = (await response.json()) as Record<string, string>;
			expect(seen.authorization).toBe('Bearer peer-secret');
			expect(seen.cookie).toBeUndefined();
			expect(seen['proxy-authorization']).toBeUndefined();
			expect(seen['x-keep']).toBe('1');
		});
	});

	it('loopback without a listed destination is refused, and a listed one on another port is too', async () => {
		await withEchoServer(async (origin) => {
			const unlisted = createMcpPeerFetch(peer({ url: `${origin}/mcp` }), {
				allowLoopbackHttp: true,
				resolveSecret: () => undefined,
			});
			await expect(unlisted(`${origin}/mcp`)).rejects.toMatchObject({ problem: 'private_address' });
			const otherPort = createMcpPeerFetch(
				peer({ url: `${origin}/mcp`, privateDestinations: [{ cidr: '127.0.0.1/32', port: 1 }] }),
				{ allowLoopbackHttp: true, resolveSecret: () => undefined },
			);
			await expect(otherPort(`${origin}/mcp`)).rejects.toMatchObject({ problem: 'private_address' });
		});
	});

	it('a redirect is an error, never followed', async () => {
		await withEchoServer(async (origin) => {
			const guarded = createMcpPeerFetch(peer({ url: `${origin}/mcp`, privateDestinations: loopbackAt(origin) }), {
				allowLoopbackHttp: true,
				resolveSecret: () => undefined,
			});
			await expect(guarded(`${origin}/redirect`)).rejects.toMatchObject({ problem: 'redirect' });
		});
	});

	it('a body past the byte cap fails while being read', async () => {
		await withEchoServer(async (origin) => {
			const guarded = createMcpPeerFetch(peer({ url: `${origin}/mcp`, privateDestinations: loopbackAt(origin) }), {
				allowLoopbackHttp: true,
				resolveSecret: () => undefined,
				maxResponseBytes: 16,
			});
			const response = await guarded(`${origin}/mcp`, { headers: { 'x-pad': 'p'.repeat(200) } });
			await expect(response.text()).rejects.toMatchObject({ problem: 'response_too_large' });
		});
	});
});

const tls = selfSignedCertificate('peer.test');

describe.skipIf(!tls)('createMcpPeerFetch over TLS, pinned', () => {
	it('reaches https://peer.test by its pinned address with SNI, certificate and Host for the name', async () => {
		const seen: Array<{ sni: unknown; host: unknown; authorization: unknown }> = [];
		const server = https.createServer({ key: tls?.key, cert: tls?.cert }, (req, res) => {
			seen.push({
				sni: (req.socket as unknown as { servername?: string }).servername,
				host: req.headers.host,
				authorization: req.headers.authorization,
			});
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end('{"ok":true}');
		});
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
		const port = (server.address() as AddressInfo).port;
		try {
			const guarded = createMcpPeerFetch(
				peer({
					url: `https://peer.test:${port}/mcp`,
					auth: { kind: 'bearer', secretRef: 'MCP_PEER_SECRET_DOCS' },
					privateDestinations: [{ cidr: '127.0.0.1/32', port }],
				}),
				{ resolveHost: resolvesTo('127.0.0.1'), tlsCa: tls?.cert, resolveSecret: () => 'tls-secret' },
			);
			const response = await guarded(`https://peer.test:${port}/mcp`, { method: 'POST', body: '{}' });
			expect(await response.json()).toEqual({ ok: true });
			expect(seen).toEqual([{ sni: 'peer.test', host: `peer.test:${port}`, authorization: 'Bearer tls-secret' }]);
		} finally {
			server.closeAllConnections();
			await new Promise<void>((resolve) => server.close(() => resolve()));
		}
	});
});
