/**
 * The delegation client against peers on real loopback sockets, through the shared pinned
 * egress — no injected `fetch`. Each peer is `serveA2aPeer` over v10r's own handler or a
 * scripted JSON-RPC body; one runs https with a certificate for a host name. No Python here
 * (the interop run covers the independent peer).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { isNonPublicAddress, type ResolveHost } from '#lib/server/http/egress-address.ts';
import { selfSignedCertificate } from '#lib/server/http/tls-fixture.ts';
import { checkArchitecture } from '#patterns/architecture-engineering/index.ts';
import { buildArchitectureReviewCard } from './agent-card.ts';
import { A2A_CLIENT_LIMITS, A2A_DELEGATION_DEPTH_KEY } from './config.ts';
import { type DelegationOptions, delegateArchitectureReview } from './delegate.ts';
import { peerCardDigest } from './peer-card.ts';
import { type A2aPeerHandler, type ServedA2aPeer, serveA2aPeer, v10rReviewAgent } from './peer-fixture.ts';
import { sampleReviewModel } from './review-sample.ts';

const open: ServedA2aPeer[] = [];
afterEach(async () => {
	await Promise.all(open.splice(0).map((peer) => peer.close()));
});

async function serve(handler: A2aPeerHandler, tls?: { key: string; cert: string; hostname: string }) {
	const peer = await serveA2aPeer(handler, { tls });
	open.push(peer);
	return peer;
}

const publicDns: ResolveHost = async () => ['93.184.215.14'];

function delegate(peer: ServedA2aPeer, extra: Partial<DelegationOptions> = {}) {
	return delegateArchitectureReview(peer.origin, sampleReviewModel(), {
		policy: { peers: [{ origin: peer.origin, privateDestinations: peer.destinations }] },
		allowLoopbackHttp: true,
		...extra,
	});
}

/** The JSON-RPC request a scripted peer received. */
async function rpc(request: Request): Promise<{ id: unknown; method: string; params: Record<string, unknown> }> {
	return JSON.parse(await request.text());
}

/** A peer whose card is v10r's (blocking unless `streaming`) and whose SendMessage answer is `result`, verbatim. */
function scripted(
	answer: (call: { id: unknown; method: string; params: Record<string, unknown> }) => unknown,
	card: Record<string, unknown> = {},
): A2aPeerHandler {
	return async (request, origin) => {
		const url = new URL(request.url);
		if (url.pathname === '/.well-known/agent-card.json') {
			const base = buildArchitectureReviewCard(origin);
			return Response.json({
				...base,
				name: 'scripted peer',
				capabilities: { ...base.capabilities, streaming: false },
				...card,
			});
		}
		const call = await rpc(request);
		const result = await answer(call);
		if (result instanceof Response) return result;
		return Response.json({ jsonrpc: '2.0', id: call.id, result });
	};
}

function completedTask(data: unknown) {
	return {
		task: {
			id: 'remote-task',
			contextId: 'remote-context',
			status: { state: 'TASK_STATE_COMPLETED' },
			artifacts: [{ artifactId: 'a', name: 'performance-review', parts: [{ data }, { text: 'summary' }] }],
		},
	};
}

const never = () => new Promise<never>(() => {});

describe('delegateArchitectureReview — the happy path is a claim', () => {
	it('returns the peer findings as an unverified claim, streamed, with the remote ids', async () => {
		const outcome = await delegate(await serve(v10rReviewAgent));
		expect(outcome.status).toBe('claimed');
		if (outcome.status !== 'claimed') return;
		expect(outcome.verified).toBe(false);
		expect(outcome.agent).toEqual({ name: 'v10r architecture review agent', version: '1.0.0' });
		expect(outcome.findings.map((entry) => entry.code)).toEqual(
			checkArchitecture(sampleReviewModel()).map((entry) => entry.code),
		);
		expect(outcome.dropped).toBe(0);
		expect(outcome.summary).toMatch(/^architecture-review of/);
		expect(outcome.correlation.taskId).toBe(outcome.taskId);
		expect(outcome.correlation.taskId).toMatch(/\S/);
		expect(outcome.correlation.contextId).toMatch(/\S/);
		expect(outcome.raw.length).toBeLessThanOrEqual(A2A_CLIENT_LIMITS.rawChars + 1);
	});

	it('marks the message with the delegation depth, so a v10r peer can tell it is delegated', async () => {
		let metadata: unknown;
		const peer = await serve(
			scripted((call) => {
				metadata = (call.params.message as { metadata?: unknown }).metadata;
				return completedTask({ format: 1, findings: [] });
			}),
		);
		await delegate(peer, { skill: 'architecture-review' });
		expect(metadata).toEqual({ skill: 'architecture-review', [A2A_DELEGATION_DEPTH_KEY]: 1 });
	});

	it('a peer that declines (unknown skill → rejected) is a declined outcome, not a claim', async () => {
		const outcome = await delegate(await serve(v10rReviewAgent), { skill: 'no-such-skill' });
		expect(outcome).toMatchObject({ status: 'declined', verified: false, taskState: 'TASK_STATE_REJECTED' });
	});

	it('no outcome is ever marked verified', async () => {
		const peer = await serve(v10rReviewAgent);
		const outcomes = await Promise.all([
			delegate(peer),
			delegate(peer, { skill: 'no-such-skill' }),
			delegate(peer, { policy: { peers: [] } }),
		]);
		expect(outcomes.map((outcome) => outcome.verified)).toEqual([false, false, false]);
	});
});

describe('delegateArchitectureReview — the peer policy', () => {
	it('refuses a peer that is not allowlisted, before any lookup or request', async () => {
		let lookups = 0;
		const outcome = await delegateArchitectureReview('https://peer.test', sampleReviewModel(), {
			policy: { peers: [{ origin: 'https://other.test' }] },
			resolveHost: async () => {
				lookups++;
				return ['93.184.215.14'];
			},
		});
		expect(outcome).toMatchObject({ status: 'refused', code: 'not_allowlisted', delivery: 'not_sent' });
		expect(lookups).toBe(0);
	});

	it('an unlisted loopback peer is refused as private before the allowlist is consulted', async () => {
		const peer = await serve(v10rReviewAgent);
		const outcome = await delegate(peer, { policy: { peers: [{ origin: 'https://other.test' }] } });
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address', delivery: 'not_sent' });
		expect(peer.seen).toEqual([]);
	});

	it.each([
		['http://169.254.169.254', 'cloud metadata'],
		['https://10.0.0.5', 'RFC 1918'],
		['https://[::ffff:169.254.169.254]', 'IPv4-mapped metadata'],
		['https://[fd00::1]', 'unique-local IPv6'],
	])('refuses %s (%s) even when allowlisted', async (origin) => {
		const outcome = await delegateArchitectureReview(origin, sampleReviewModel(), {
			policy: { peers: [{ origin: new URL(origin).origin }] },
			resolveHost: publicDns,
		});
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address', delivery: 'not_sent' });
	});

	it('the metadata range cannot be opened by listing it as a private destination', async () => {
		const origin = 'https://169.254.169.254';
		const outcome = await delegateArchitectureReview(origin, sampleReviewModel(), {
			policy: { peers: [{ origin, privateDestinations: [{ cidr: '169.254.169.254/32', port: 443 }] }] },
		});
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address' });
	});

	it('refuses a loopback peer without a listed private destination', async () => {
		const peer = await serve(v10rReviewAgent);
		const outcome = await delegate(peer, { policy: { peers: [{ origin: peer.origin }] } });
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address' });
		expect(peer.seen).toEqual([]);
	});

	it('refuses plain http to a loopback peer unless the caller allows it', async () => {
		const peer = await serve(v10rReviewAgent);
		const outcome = await delegate(peer, { allowLoopbackHttp: false });
		expect(outcome).toMatchObject({ status: 'refused', code: 'insecure_scheme' });
	});

	it('refuses plain http to a public peer', async () => {
		const origin = 'http://peer.test';
		const outcome = await delegateArchitectureReview(origin, sampleReviewModel(), {
			policy: { peers: [{ origin }] },
			resolveHost: publicDns,
			allowLoopbackHttp: true,
		});
		expect(outcome).toMatchObject({ status: 'refused', code: 'insecure_scheme' });
	});

	it('refuses a name that resolves to a private address (SSRF through DNS)', async () => {
		const outcome = await delegateArchitectureReview('https://peer.test', sampleReviewModel(), {
			policy: { peers: [{ origin: 'https://peer.test' }] },
			resolveHost: async () => ['93.184.215.14', '10.1.2.3'],
		});
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address', delivery: 'not_sent' });
	});

	it('refuses a card whose interface URL leaves the allowlist, before the task is sent', async () => {
		const peer = await serve(
			scripted(() => completedTask({ format: 1, findings: [] }), {
				supportedInterfaces: [
					{ url: 'http://169.254.169.254/rpc', protocolBinding: 'JSONRPC', protocolVersion: '1.0', tenant: '' },
				],
			}),
		);
		const outcome = await delegate(peer);
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address', delivery: 'not_sent' });
		expect(peer.seen).toEqual(['GET /.well-known/agent-card.json']);
	});

	it('does not follow redirects', async () => {
		const peer = await serve(
			() => new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/' } }),
		);
		const outcome = await delegate(peer);
		expect(outcome).toMatchObject({ status: 'refused', code: 'redirect' });
	});

	it('sends the operator bearer only, and refuses before sending when its reference is unset', async () => {
		let authorization: string | null = null;
		const peer = await serve(async (request, origin) => {
			authorization = request.headers.get('authorization');
			return v10rReviewAgent(request, origin);
		});
		const sent = await delegate(peer, { bearerSecret: () => 'peer-secret' });
		expect(sent.status).toBe('claimed');
		expect(authorization).toBe('Bearer peer-secret');
		const unset = await delegate(peer, { bearerSecret: () => undefined });
		expect(unset).toMatchObject({ status: 'refused', code: 'missing_secret', delivery: 'not_sent' });
	});
});

describe('delegateArchitectureReview — pinned, over TLS, against rebinding', () => {
	const tls = selfSignedCertificate('peer.test');

	it.skipIf(!tls)('reaches https://peer.test by its pinned address, the certificate checked for the name', async () => {
		const peer = await serve(v10rReviewAgent, tls ? { ...tls, hostname: 'peer.test' } : undefined);
		const outcome = await delegate(peer, { resolveHost: async () => ['127.0.0.1'], tlsCa: tls?.cert });
		expect(outcome).toMatchObject({ status: 'claimed', verified: false });
	});

	it.skipIf(!tls)('a pinned address that cannot present the name’s certificate is refused, nothing sent', async () => {
		const peer = await serve(v10rReviewAgent, tls ? { ...tls, hostname: 'peer.test' } : undefined);
		const origin = `https://other.test:${peer.port}`;
		const outcome = await delegateArchitectureReview(origin, sampleReviewModel(), {
			policy: { peers: [{ origin, privateDestinations: peer.destinations }] },
			resolveHost: async () => ['127.0.0.1'],
			tlsCa: tls?.cert,
		});
		expect(outcome).toMatchObject({ status: 'refused', code: 'transport', delivery: 'not_sent' });
		expect(peer.seen).toEqual([]);
	});

	it.skipIf(!tls)('a rebinding answer between the card and the send is refused, never connected', async () => {
		const peer = await serve(v10rReviewAgent, tls ? { ...tls, hostname: 'peer.test' } : undefined);
		let lookups = 0;
		const rebinding: ResolveHost = async () => (++lookups === 1 ? ['127.0.0.1'] : ['10.0.0.1']);
		const outcome = await delegate(peer, { resolveHost: rebinding, tlsCa: tls?.cert });
		expect(outcome).toMatchObject({ status: 'refused', code: 'private_address', delivery: 'not_sent' });
		expect(lookups).toBe(2);
		expect(peer.seen).toEqual(['GET /.well-known/agent-card.json']);
	});
});

describe('delegateArchitectureReview — bounds, timeouts and cancellation', () => {
	it('gives up at the deadline while the card is still loading: nothing sent', async () => {
		const outcome = await delegate(await serve(never), { timeoutMs: 150 });
		expect(outcome).toMatchObject({ status: 'refused', code: 'timeout', delivery: 'not_sent' });
		expect(outcome).not.toHaveProperty('cancellation');
	});

	it('a blocking peer that hangs after the send: possibly sent, and nothing to cancel', async () => {
		const peer = await serve(scripted(never));
		const outcome = await delegate(peer, { timeoutMs: 300 });
		expect(outcome).toMatchObject({
			status: 'refused',
			code: 'timeout',
			delivery: 'possibly_sent',
			cancellation: 'no_task',
		});
	});

	/** A streaming peer: one WORKING task event, then silence; CancelTask answers CANCELED. */
	function stalledStream(onCancel: (id: string) => unknown) {
		return scripted(
			(call) => {
				if (call.method === 'CancelTask') return onCancel(String(call.params.id));
				const frame = {
					jsonrpc: '2.0',
					id: call.id,
					result: { task: { id: 'slow-task', contextId: 'slow-ctx', status: { state: 'TASK_STATE_WORKING' } } },
				};
				const encoder = new TextEncoder();
				const body = new ReadableStream<Uint8Array>({
					start(controller) {
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(frame)}\n\n`));
					},
				});
				return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
			},
			{ capabilities: { streaming: true, pushNotifications: false, extendedAgentCard: false, extensions: [] } },
		);
	}

	it('a streaming peer that stalls: the deadline sends CancelTask for the task it named', async () => {
		const cancelled: string[] = [];
		const peer = await serve(
			stalledStream((id) => {
				cancelled.push(id);
				return { id, contextId: 'slow-ctx', status: { state: 'TASK_STATE_CANCELED' } };
			}),
		);
		const outcome = await delegate(peer, { timeoutMs: 300 });
		expect(outcome).toMatchObject({
			status: 'refused',
			code: 'timeout',
			delivery: 'sent',
			cancellation: 'confirmed',
			correlation: { taskId: 'slow-task', contextId: 'slow-ctx' },
		});
		expect(cancelled).toEqual(['slow-task']);
	});

	it('the caller’s abort cancels too; a peer that will not cancel is recorded as not confirmed', async () => {
		const peer = await serve(
			stalledStream(
				(id) => new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32002, message: 'no' } })),
			),
		);
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 150);
		const outcome = await delegate(peer, { signal: controller.signal });
		expect(outcome).toMatchObject({ status: 'refused', code: 'aborted', cancellation: 'not_confirmed' });
	});

	it('refuses an oversized response before parsing it', async () => {
		const huge = 'x'.repeat(A2A_CLIENT_LIMITS.responseBytes + 1);
		const outcome = await delegate(await serve(scripted(() => completedTask({ format: 1, findings: [], huge }))));
		expect(outcome).toMatchObject({ status: 'refused', code: 'response_too_large', delivery: 'sent' });
	});

	it('drops and counts malformed remote findings, copying only known fields', async () => {
		const valid = { code: 'sync.chain-depth', severity: 'warning', subject: 'nodes/api', detected: 'three sync hops' };
		const findings = [
			{ ...valid, category: 'performance', injected: '<script>', __proto__: { polluted: true } },
			{ ...valid, code: 'NOT A CODE' },
			{ ...valid, severity: 'critical' },
			{ ...valid, detected: '' },
			{ ...valid, why: 42 },
			'a string',
			null,
		];
		const outcome = await delegate(await serve(scripted(() => completedTask({ format: 1, findings }))));
		expect(outcome.status).toBe('claimed');
		if (outcome.status !== 'claimed') return;
		expect(outcome.dropped).toBe(6);
		expect(outcome.findings).toEqual([{ ...valid, category: 'performance' }]);
		expect(outcome.verified).toBe(false);
		expect(outcome.correlation).toEqual({ taskId: 'remote-task', contextId: 'remote-context' });
	});

	it('refuses a report with the wrong envelope or too many findings, rather than cutting it', async () => {
		const wrongFormat = await delegate(await serve(scripted(() => completedTask({ format: 99, findings: [] }))));
		expect(wrongFormat).toMatchObject({ status: 'refused', code: 'invalid_answer', delivery: 'sent' });
		const many = Array.from({ length: A2A_CLIENT_LIMITS.findings + 1 }, () => ({}));
		const tooMany = await delegate(await serve(scripted(() => completedTask({ format: 1, findings: many }))));
		expect(tooMany).toMatchObject({ status: 'refused', code: 'invalid_answer' });
	});

	it('refuses a message where a task was expected', async () => {
		const outcome = await delegate(
			await serve(scripted(() => ({ message: { messageId: 'm', role: 'ROLE_AGENT', parts: [{ text: 'trust me' }] } }))),
		);
		expect(outcome).toMatchObject({ status: 'refused', code: 'invalid_answer' });
	});

	it('refuses, before sending, a card that changed since its digest was approved', async () => {
		const peer = await serve(v10rReviewAgent);
		const card = buildArchitectureReviewCard(peer.origin);
		const approved = peerCardDigest(card, 'architecture-review');
		const same = await delegate(peer, { skill: 'architecture-review', cardDigest: approved });
		expect(same.status).toBe('claimed');
		const changed = await delegate(peer, { skill: 'architecture-review', cardDigest: 'f'.repeat(64) });
		expect(changed).toMatchObject({ status: 'refused', code: 'card_changed', delivery: 'not_sent' });
		const gone = await delegate(peer, { skill: 'retired-skill', cardDigest: approved });
		expect(gone).toMatchObject({ status: 'refused', code: 'skill_not_offered', delivery: 'not_sent' });
	});

	it('classifies addresses', () => {
		for (const address of ['127.0.0.1', '0.0.0.0', '100.64.0.1', '172.20.1.1', '192.168.1.1', '::1', 'fe80::1']) {
			expect(isNonPublicAddress(address), address).toBe(true);
		}
		for (const address of ['93.184.215.14', '8.8.8.8', '2606:4700::1111']) {
			expect(isNonPublicAddress(address), address).toBe(false);
		}
	});
});
