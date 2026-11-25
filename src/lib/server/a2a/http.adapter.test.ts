/**
 * The review agent's JSON-RPC binding, end to end through `respondToA2aPost` — the same function
 * the route and the interop harness call. Wire shapes are A2A 1.0 proto-JSON, as a peer sends them.
 */
import { describe, expect, it } from 'vitest';
import { checkArchitecture, checkSecurity } from '#patterns/architecture-engineering/index.ts';
import { buildArchitectureReviewCard, REVIEW_SKILL_IDS } from './agent-card.ts';
import { A2A_PROTOCOL_VERSION, A2A_SERVER_LIMITS, ARCHITECTURE_REVIEW_AGENT_VERSION } from './config.ts';
import { respondToA2aPost } from './http.adapter.ts';
import { sampleReviewModel } from './review-sample.ts';

const ORIGIN = 'https://v10r.test';

let nextId = 1;

function rpc(method: string, params: unknown, init: { version?: string | null; contentType?: string } = {}): Request {
	const headers: Record<string, string> = { 'content-type': init.contentType ?? 'application/json' };
	if (init.version !== null) headers['A2A-Version'] = init.version ?? A2A_PROTOCOL_VERSION;
	return new Request(`${ORIGIN}/api/a2a`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ jsonrpc: '2.0', id: nextId++, method, params }),
	});
}

function send(data: unknown, metadata?: Record<string, unknown>, extraParts: unknown[] = []) {
	return {
		message: {
			messageId: crypto.randomUUID(),
			role: 'ROLE_USER',
			parts: [{ data, mediaType: 'application/json' }, ...extraParts],
			...(metadata && { metadata }),
		},
	};
}

/** Proto-JSON as it arrives on the wire; the tests walk it by path. */
// biome-ignore lint/suspicious/noExplicitAny: wire JSON is read by path in assertions, typed by the expectations
type WireTask = Record<string, any>;

async function json(response: Response) {
	return (await response.json()) as {
		result?: { task?: WireTask; tasks?: unknown[] };
		error?: { code: number; message: string };
	};
}

describe('Agent Card', () => {
	it('carries the A2A 1.0 fields and both skills', () => {
		const card = buildArchitectureReviewCard(ORIGIN);
		expect(card.version).toBe(ARCHITECTURE_REVIEW_AGENT_VERSION);
		expect(card.supportedInterfaces).toEqual([
			{ url: `${ORIGIN}/api/a2a`, protocolBinding: 'JSONRPC', protocolVersion: '1.0', tenant: '' },
		]);
		expect(card.capabilities).toMatchObject({ streaming: true, pushNotifications: false, extendedAgentCard: false });
		expect(card.skills.map((skill) => skill.id)).toEqual([...REVIEW_SKILL_IDS]);
		for (const skill of card.skills) {
			expect(skill.name).toBeTruthy();
			expect(skill.description).toBeTruthy();
			expect(skill.inputModes).toEqual(['application/json']);
		}
		expect(card.defaultInputModes).toEqual(['application/json']);
		// The wire form a peer reads is plain JSON with no `kind` discriminators (removed in 1.0).
		expect(JSON.stringify(card)).not.toContain('"kind"');
	});
});

describe('SendMessage', () => {
	it('completes with a report artifact: findings as a data part plus a text summary', async () => {
		const model = sampleReviewModel();
		const response = await respondToA2aPost(rpc('SendMessage', send(model)), ORIGIN);
		expect(response.status).toBe(200);
		const task = (await json(response)).result?.task;
		expect(task?.status.state).toBe('TASK_STATE_COMPLETED');
		const [artifact] = task?.artifacts ?? [];
		expect(artifact.name).toBe('architecture-review-report');
		const [data, text] = artifact.parts;
		expect(data.data.format).toBe(1);
		expect(data.data.skill).toBe('architecture-review');
		expect(data.data.findings).toEqual(JSON.parse(JSON.stringify(checkArchitecture(model))));
		expect(text.text).toMatch(/^architecture-review of "A2A interop sample": \d+ findings/);
	});

	it('runs only the security checks for architecture-security-review', async () => {
		const model = sampleReviewModel();
		const response = await respondToA2aPost(
			rpc('SendMessage', send(model, { skill: 'architecture-security-review' })),
			ORIGIN,
		);
		const findings = (await json(response)).result?.task?.artifacts[0].parts[0].data.findings;
		expect(findings.map((entry: { code: string }) => entry.code)).toEqual(
			checkSecurity(model).map((entry) => entry.code),
		);
		expect(findings.every((entry: { category: string }) => entry.category === 'security')).toBe(true);
	});

	it('is deterministic: the same model yields the same findings', async () => {
		const model = sampleReviewModel();
		const first = (await json(await respondToA2aPost(rpc('SendMessage', send(model)), ORIGIN))).result?.task;
		const second = (await json(await respondToA2aPost(rpc('SendMessage', send(model)), ORIGIN))).result?.task;
		expect(first?.artifacts[0].parts[0].data).toEqual(second?.artifacts[0].parts[0].data);
	});

	it('rejects an invalid model with the parser issues', async () => {
		const response = await respondToA2aPost(rpc('SendMessage', send({ format: 1, id: 'Not An Id' })), ORIGIN);
		const task = (await json(response)).result?.task;
		expect(task?.status.state).toBe('TASK_STATE_REJECTED');
		expect(task?.artifacts ?? []).toEqual([]);
		const [text, data] = task?.status.message.parts ?? [];
		expect(text.text).toMatch(/not a valid architecture model/);
		expect(data.data.issues.length).toBeGreaterThan(0);
		expect(data.data.issues[0]).toHaveProperty('path');
	});

	it('rejects an unknown skill, a missing data part and too many parts', async () => {
		const model = sampleReviewModel();
		const unknown = await respondToA2aPost(rpc('SendMessage', send(model, { skill: 'rm -rf' })), ORIGIN);
		expect((await json(unknown)).result?.task?.status.state).toBe('TASK_STATE_REJECTED');

		const textOnly = await respondToA2aPost(
			rpc('SendMessage', { message: { messageId: 'm', role: 'ROLE_USER', parts: [{ text: 'review please' }] } }),
			ORIGIN,
		);
		expect((await json(textOnly)).result?.task?.status.state).toBe('TASK_STATE_REJECTED');

		const many = Array.from({ length: A2A_SERVER_LIMITS.messageParts }, () => ({ text: 'x' }));
		const tooMany = await respondToA2aPost(rpc('SendMessage', send(model, undefined, many)), ORIGIN);
		const task = (await json(tooMany)).result?.task;
		expect(task?.status.state).toBe('TASK_STATE_REJECTED');
		expect(task?.status.message.parts[0].text).toMatch(/at most 4/);
	});
});

describe('SendStreamingMessage', () => {
	it('answers text/event-stream frames ending in a completed status', async () => {
		const response = await respondToA2aPost(rpc('SendStreamingMessage', send(sampleReviewModel())), ORIGIN);
		expect(response.headers.get('content-type')).toBe('text/event-stream');
		const body = await response.text();
		const frames = body
			.split('\n\n')
			.filter(Boolean)
			.map((frame) => {
				expect(frame.startsWith('data: ')).toBe(true);
				return JSON.parse(frame.slice('data: '.length)).result;
			});
		expect(frames[0].task.status.state).toBe('TASK_STATE_WORKING');
		expect(frames.some((frame) => frame.artifactUpdate?.artifact.name === 'architecture-review-report')).toBe(true);
		expect(frames.at(-1).statusUpdate.status.state).toBe('TASK_STATE_COMPLETED');
	});
});

describe('protocol errors come from the SDK, as JSON-RPC envelopes', () => {
	it('unknown method → -32601', async () => {
		const response = await respondToA2aPost(rpc('tasks/explode', {}), ORIGIN);
		expect((await json(response)).error?.code).toBe(-32601);
	});

	it('malformed JSON → -32700', async () => {
		const request = new Request(`${ORIGIN}/api/a2a`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' },
			body: '{"jsonrpc":',
		});
		expect((await json(await respondToA2aPost(request, ORIGIN))).error?.code).toBe(-32700);
	});

	it('a missing A2A-Version means 0.3, which this agent does not speak', async () => {
		const response = await respondToA2aPost(rpc('SendMessage', send(sampleReviewModel()), { version: null }), ORIGIN);
		expect((await json(response)).error?.message).toMatch(/version '0\.3' is not supported/);
	});

	it('an oversized body is refused with 413 before parsing', async () => {
		const padding = 'x'.repeat(A2A_SERVER_LIMITS.requestBytes);
		const response = await respondToA2aPost(rpc('SendMessage', send({ padding })), ORIGIN);
		expect(response.status).toBe(413);
		expect((await json(response)).error?.code).toBe(-32600);
	});

	it('a non-JSON content type is refused', async () => {
		const response = await respondToA2aPost(rpc('SendMessage', {}, { contentType: 'text/plain' }), ORIGIN);
		expect(response.status).toBe(415);
	});
});

describe('no task outlives its request', () => {
	it('GetTask and CancelTask for a finished task answer TaskNotFound; ListTasks is empty', async () => {
		const sent = await json(await respondToA2aPost(rpc('SendMessage', send(sampleReviewModel())), ORIGIN));
		const id = sent.result?.task?.id;
		expect(id).toBeTruthy();
		expect((await json(await respondToA2aPost(rpc('GetTask', { id }), ORIGIN))).error?.code).toBe(-32001);
		expect((await json(await respondToA2aPost(rpc('CancelTask', { id }), ORIGIN))).error?.code).toBe(-32001);
		expect((await json(await respondToA2aPost(rpc('ListTasks', {}), ORIGIN))).result?.tasks).toEqual([]);
	});
});
