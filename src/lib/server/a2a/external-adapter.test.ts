/**
 * The A2A delegation adapter under the external-operations contract, driven by an in-memory
 * fake of the domain's execute flow (propose → approve → claim once → verify → execute →
 * receipt). The real domain lives on its own branch; the fake holds only the rules the
 * adapter relies on: one execution per approval, verify before execute, owner only.
 *
 * Peers are real loopback servers reached through the pinned egress.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type {
	ExternalDisclosureDraft,
	ExternalExecutionResult,
	ExternalOperationAdapter,
	ExternalOperationBinding,
	ExternalOperationRequest,
} from '#lib/server/external-operations/index.ts';
import { buildArchitectureReviewCard } from './agent-card.ts';
import { A2A_DELEGATION_LIMITS } from './config.ts';
import { createDelegationBudget } from './delegation-budget.ts';
import type { A2aDelegationPeer } from './delegation-peer.ts';
import { type A2aDelegationAdapterOptions, createA2aDelegationAdapter } from './external-adapter.ts';
import { type A2aPeerHandler, type ServedA2aPeer, serveA2aPeer, v10rReviewAgent } from './peer-fixture.ts';
import { sampleReviewModel } from './review-sample.ts';

const open: ServedA2aPeer[] = [];
afterEach(async () => {
	await Promise.all(open.splice(0).map((peer) => peer.close()));
});

async function serve(handler: A2aPeerHandler) {
	const peer = await serveA2aPeer(handler);
	open.push(peer);
	return peer;
}

const wrap = (source: string, text: string) => `<untrusted-content source="${source}">\n${text}\n</untrusted-content>`;

function peerEntry(served: ServedA2aPeer, extra: Partial<A2aDelegationPeer> = {}): A2aDelegationPeer {
	return {
		id: 'reviewer',
		label: 'Independent reviewer',
		origin: served.origin,
		skills: ['architecture-review'],
		auth: { kind: 'none' },
		privateDestinations: served.destinations,
		...extra,
	};
}

/** The domain's execute flow, in memory: the rules the adapter is built against. */
function fakeExternalOperations(adapter: ExternalOperationAdapter) {
	const proposals = new Map<
		string,
		{ request: ExternalOperationRequest; disclosure: ExternalDisclosureDraft; binding: ExternalOperationBinding }
	>();
	const approved = new Set<string>();
	const receipts = new Map<string, ExternalExecutionResult | 'claimed'>();
	let executions = 0;
	return {
		get executions() {
			return executions;
		},
		async propose(request: ExternalOperationRequest) {
			const prepared = await adapter.prepare(request);
			if (!prepared.ok) return prepared;
			const id = `op-${proposals.size + 1}`;
			proposals.set(id, { request, disclosure: prepared.disclosure, binding: prepared.binding });
			return { ok: true as const, id, disclosure: prepared.disclosure, binding: prepared.binding };
		},
		approve(id: string) {
			approved.add(id);
		},
		/** `override` replays a tampered request against the stored binding. */
		async execute(
			id: string,
			userId: string,
			signal = new AbortController().signal,
			override?: unknown,
		): Promise<ExternalExecutionResult> {
			const proposal = proposals.get(id);
			if (!proposal || !approved.has(id)) return { outcome: 'refused', delivery: 'not_sent', reason: 'not_approved' };
			if (proposal.binding.userId !== userId) return { outcome: 'refused', delivery: 'not_sent', reason: 'not_owner' };
			const prior = receipts.get(id);
			if (prior === 'claimed') return { outcome: 'unknown', delivery: 'possibly_sent', reason: 'claimed' };
			if (prior) return prior;
			receipts.set(id, 'claimed');
			const verified = await adapter.verify(proposal.binding);
			if (!verified.ok) {
				const receipt: ExternalExecutionResult = { outcome: 'refused', delivery: 'not_sent', reason: verified.reason };
				receipts.set(id, receipt);
				return receipt;
			}
			executions++;
			const request = override === undefined ? proposal.request : { ...proposal.request, arguments: override };
			const receipt = await adapter.execute(request, proposal.binding, signal);
			receipts.set(id, receipt);
			return receipt;
		},
	};
}

function request(extra: Partial<ExternalOperationRequest> = {}): ExternalOperationRequest {
	return {
		protocol: 'a2a',
		peerId: 'reviewer',
		operation: 'architecture-review',
		arguments: { model: sampleReviewModel() },
		userId: 'user-1',
		conversationId: 'conv-1',
		...extra,
	};
}

function adapterFor(peers: A2aDelegationPeer[], extra: Partial<A2aDelegationAdapterOptions> = {}) {
	return createA2aDelegationAdapter({
		peers,
		resolveSecret: (ref) => (ref === 'A2A_PEER_SECRET_REVIEWER' ? 'operator-secret' : undefined),
		wrapResult: wrap,
		allowLoopbackHttp: true,
		...extra,
	});
}

/** A blocking peer with v10r's card whose SendMessage answer is `result`. */
function scripted(result: (call: { id: unknown; method: string }) => unknown, card: Record<string, unknown> = {}) {
	return async (req: Request, origin: string) => {
		if (new URL(req.url).pathname === '/.well-known/agent-card.json') {
			const base = buildArchitectureReviewCard(origin);
			return Response.json({ ...base, capabilities: { ...base.capabilities, streaming: false }, ...card });
		}
		const call = JSON.parse(await req.text());
		const answer = await result(call);
		return Response.json({ jsonrpc: '2.0', id: call.id, result: answer });
	};
}

describe('A2A delegation adapter — the approved path', () => {
	it('prepares a disclosure, runs once after approval, and returns a wrapped claim with the remote ids', async () => {
		const served = await serve(v10rReviewAgent);
		const domain = fakeExternalOperations(adapterFor([peerEntry(served)]));
		const proposed = await domain.propose(request());
		expect(proposed.ok).toBe(true);
		if (!proposed.ok) return;
		expect(proposed.disclosure).toMatchObject({
			protocol: 'a2a',
			peerId: 'reviewer',
			peerLabel: 'Independent reviewer',
			destination: served.origin,
			operation: 'architecture-review',
			credential: { kind: 'none' },
			mutates: false,
			reversibility: 'unknown',
			grant: 'once',
		});
		expect(proposed.disclosure.fields).toContain('model');
		expect(proposed.disclosure.preview).toMatch(/4 nodes, 3 connections/);
		expect(proposed.binding.endpoint).toBe(`${served.origin}/api/a2a`);
		// Discovery read the card and sent nothing else.
		expect(served.seen).toEqual(['GET /.well-known/agent-card.json']);

		const before = await domain.execute(proposed.id, 'user-1');
		expect(before).toMatchObject({ outcome: 'refused', reason: 'not_approved' });
		domain.approve(proposed.id);
		const receipt = await domain.execute(proposed.id, 'user-1');
		expect(receipt).toMatchObject({ outcome: 'succeeded', delivery: 'sent' });
		expect(receipt.result).toMatch(/^<untrusted-content source="delegate_architecture_review">/);
		expect(receipt.result).toContain('"verified":false');
		expect(receipt.result).toContain('"status":"claimed"');
		expect(receipt.remoteTask?.taskId).toMatch(/\S/);
		expect(receipt.remoteTask?.contextId).toMatch(/\S/);

		const seen = served.seen.length;
		const again = await domain.execute(proposed.id, 'user-1');
		expect(again).toEqual(receipt);
		expect(served.seen.length).toBe(seen);
		expect(domain.executions).toBe(1);
	});

	it('names the operator secret by reference in the disclosure and sends its value only on the wire', async () => {
		let authorization: string | null = null;
		const served = await serve(async (req, origin) => {
			authorization = req.headers.get('authorization');
			return v10rReviewAgent(req, origin);
		});
		const adapter = adapterFor([
			peerEntry(served, { auth: { kind: 'bearer', secretRef: 'A2A_PEER_SECRET_REVIEWER' } }),
		]);
		const domain = fakeExternalOperations(adapter);
		const proposed = await domain.propose(request());
		if (!proposed.ok) throw new Error(proposed.reason);
		expect(proposed.disclosure.credential).toEqual({ kind: 'operator_secret', ref: 'A2A_PEER_SECRET_REVIEWER' });
		expect(JSON.stringify(proposed)).not.toContain('operator-secret');
		domain.approve(proposed.id);
		expect(await domain.execute(proposed.id, 'user-1')).toMatchObject({ outcome: 'succeeded' });
		expect(authorization).toBe('Bearer operator-secret');
	});

	it('only the approving user executes', async () => {
		const served = await serve(v10rReviewAgent);
		const domain = fakeExternalOperations(adapterFor([peerEntry(served)]));
		const proposed = await domain.propose(request());
		if (!proposed.ok) throw new Error(proposed.reason);
		domain.approve(proposed.id);
		expect(await domain.execute(proposed.id, 'someone-else')).toMatchObject({ outcome: 'refused' });
		expect(domain.executions).toBe(0);
	});
});

describe('A2A delegation adapter — refusals before anything is proposed', () => {
	it.each([
		[{ peerId: 'nobody' }, 'unknown_peer'],
		[{ operation: 'architecture-security-review' }, 'skill_not_allowed'],
		[{ arguments: { model: { format: 1 } } }, 'invalid_model'],
		[{ arguments: { model: sampleReviewModel(), url: 'https://evil.example' } }, 'invalid_arguments'],
		[{ protocol: 'mcp' as const }, 'wrong_protocol'],
	])('%o → %s, with no request to the peer', async (extra, reason) => {
		const served = await serve(v10rReviewAgent);
		const prepared = await adapterFor([peerEntry(served)]).prepare(request(extra));
		expect(prepared).toEqual({ ok: false, reason });
		expect(served.seen).toEqual([]);
	});

	it('a misconfigured operator entry does not exist', async () => {
		const served = await serve(v10rReviewAgent);
		const prepared = await adapterFor([peerEntry(served, { id: 'Bad Id' })]).prepare(request({ peerId: 'Bad Id' }));
		expect(prepared).toEqual({ ok: false, reason: 'unknown_peer' });
	});

	it('a skill the operator allows but the card no longer offers is refused', async () => {
		const served = await serve(v10rReviewAgent);
		const adapter = adapterFor([peerEntry(served, { skills: ['performance-review'] })]);
		expect(await adapter.prepare(request({ operation: 'performance-review' }))).toEqual({
			ok: false,
			reason: 'skill_not_offered',
		});
	});

	it('a peer that cannot be reached is refused at discovery, with the transport reason', async () => {
		const served = await serve(v10rReviewAgent);
		const adapter = adapterFor([peerEntry(served, { privateDestinations: [] })]);
		expect(await adapter.prepare(request())).toEqual({ ok: false, reason: 'card_unavailable:private_address' });
	});
});

describe('A2A delegation adapter — between approval and execution', () => {
	it('a card that changed after approval refuses at verify; the task is never sent', async () => {
		let version = '1.0.0';
		const served = await serve(async (req, origin) => {
			if (new URL(req.url).pathname === '/.well-known/agent-card.json') {
				return Response.json({ ...buildArchitectureReviewCard(origin), version });
			}
			return v10rReviewAgent(req, origin);
		});
		const domain = fakeExternalOperations(adapterFor([peerEntry(served)]));
		const proposed = await domain.propose(request());
		if (!proposed.ok) throw new Error(proposed.reason);
		domain.approve(proposed.id);
		version = '2.0.0';
		expect(await domain.execute(proposed.id, 'user-1')).toMatchObject({ outcome: 'refused', reason: 'card_changed' });
		expect(served.seen.filter((line) => line.startsWith('POST'))).toEqual([]);
	});

	it('a changed operator policy or an expired approval refuses at verify', async () => {
		const served = await serve(v10rReviewAgent);
		const first = adapterFor([peerEntry(served)]);
		const prepared = await first.prepare(request());
		if (!prepared.ok) throw new Error(prepared.reason);
		const widened = adapterFor([
			peerEntry(served, { skills: ['architecture-review', 'architecture-security-review'] }),
		]);
		expect(await widened.verify(prepared.binding)).toEqual({ ok: false, reason: 'policy_changed' });
		const later = adapterFor([peerEntry(served)], {
			now: () => new Date(Date.now() + A2A_DELEGATION_LIMITS.approvalTtlMs + 1000),
		});
		expect(await later.verify(prepared.binding)).toEqual({ ok: false, reason: 'expired' });
	});

	it('arguments that differ from the approved ones are refused, not sent', async () => {
		const served = await serve(v10rReviewAgent);
		const domain = fakeExternalOperations(adapterFor([peerEntry(served)]));
		const proposed = await domain.propose(request());
		if (!proposed.ok) throw new Error(proposed.reason);
		domain.approve(proposed.id);
		const other = { ...sampleReviewModel(), name: 'A different model' };
		const receipt = await domain.execute(proposed.id, 'user-1', undefined, { model: other });
		expect(receipt).toMatchObject({ outcome: 'refused', delivery: 'not_sent', reason: 'arguments_changed' });
		expect(served.seen.filter((line) => line.startsWith('POST'))).toEqual([]);
	});
});

describe('A2A delegation adapter — what the peer answers', () => {
	async function approvedRun(handler: A2aPeerHandler, extra: Partial<A2aDelegationAdapterOptions> = {}) {
		const served = await serve(handler);
		const domain = fakeExternalOperations(adapterFor([peerEntry(served)], extra));
		const proposed = await domain.propose(request());
		if (!proposed.ok) throw new Error(proposed.reason);
		domain.approve(proposed.id);
		return domain.execute(proposed.id, 'user-1');
	}

	it('a rejection is a failed, sent operation with the peer’s reason wrapped', async () => {
		const receipt = await approvedRun(
			scripted(() => ({
				task: {
					id: 't',
					contextId: 'c',
					status: { state: 'TASK_STATE_REJECTED', message: { role: 'ROLE_AGENT', parts: [{ text: 'not today' }] } },
				},
			})),
		);
		expect(receipt).toMatchObject({ outcome: 'failed', delivery: 'sent', reason: 'peer_declined' });
		expect(receipt.result).toContain('not today');
		expect(receipt.remoteTask).toEqual({ taskId: 't', contextId: 'c' });
	});

	it('an invalid result is a failed, sent operation — never a claim', async () => {
		const receipt = await approvedRun(
			scripted(() => ({
				task: {
					id: 't',
					contextId: 'c',
					status: { state: 'TASK_STATE_COMPLETED' },
					artifacts: [{ artifactId: 'a', parts: [{ data: { format: 99, findings: [] } }] }],
				},
			})),
		);
		expect(receipt).toMatchObject({ outcome: 'failed', delivery: 'sent', reason: 'invalid_answer' });
		expect(receipt.result).not.toContain('"status":"claimed"');
	});

	it('a timeout after the send is unknown and possibly sent — never retried', async () => {
		let posts = 0;
		const receipt = await approvedRun(
			scripted(() => {
				posts++;
				return new Promise(() => {});
			}),
			{ timeoutMs: 300 },
		);
		expect(receipt).toMatchObject({ outcome: 'unknown', delivery: 'possibly_sent', reason: 'timeout' });
		expect(posts).toBe(1);
	});

	it('an abort through the domain’s signal reaches the peer call', async () => {
		const served = await serve(scripted(() => new Promise(() => {})));
		const domain = fakeExternalOperations(adapterFor([peerEntry(served)]));
		const proposed = await domain.propose(request());
		if (!proposed.ok) throw new Error(proposed.reason);
		domain.approve(proposed.id);
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 150);
		const receipt = await domain.execute(proposed.id, 'user-1', controller.signal);
		expect(receipt).toMatchObject({ outcome: 'unknown', reason: 'aborted' });
	});
});

describe('delegation budget', () => {
	it('allows one delegation per turn', () => {
		const budget = createDelegationBudget({ depth: 0, proposedInConversation: 0 });
		expect(budget.take()).toEqual({ ok: true });
		expect(budget.take()).toEqual({ ok: false, refusal: 'turn_budget' });
		expect(budget.proposedThisTurn).toBe(1);
	});

	it('stops at the conversation budget', () => {
		const budget = createDelegationBudget({ depth: 0, proposedInConversation: A2A_DELEGATION_LIMITS.perConversation });
		expect(budget.take()).toEqual({ ok: false, refusal: 'conversation_budget' });
	});

	it('refuses any delegation from a turn that is itself delegated', () => {
		const budget = createDelegationBudget({ depth: 1, proposedInConversation: 0 });
		expect(budget.take()).toEqual({ ok: false, refusal: 'depth' });
	});
});
