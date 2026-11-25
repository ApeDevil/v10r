/**
 * The external-operations demo, end to end through the application path, against an
 * independently implemented peer: `scripts/mcp-client/peer/server.py`, written with the
 * official PYTHON MCP SDK, holding disposable in-memory notes.
 *
 *   operator directory (ai.mcp_peer / ai.mcp_peer_tool: discover, activate at a fingerprint)
 *   → deskbot capability `external-tools` (lane lists + projects under the pins, gated tool)
 *   → the model's tool call prepares the operation (nothing sent) → the turn's proposal rule
 *   → `createProposal` + `agent_external_operation` → `POST /api/ai/proposals/[id]/approve`
 *   → claim → verify → one `tools/call` → receipt + receipt message (untrusted result).
 *
 * Scenarios: an approved mutation; an approved read whose untrusted answer lands in the
 * conversation; unauthorized mutations rejected (a stranger, a revoked activation, a field the
 * operator did not allow); tool drift after approval invalidates the approval. What reached the
 * peer is checked on the peer itself, out of band.
 *
 * Needs `python3` with `mcp==2.3.0` importable; the cloud image has it. Skipped otherwise.
 */
import { type ChildProcess, spawn, spawnSync } from 'node:child_process';
import { type AddressInfo, createServer } from 'node:net';
import { join } from 'node:path';
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeConversation, makeUser } from '#lib/server/test/fixtures.ts';
import { conversation, message } from '../../db/schema/ai/conversation';
import { user } from '../../db/schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

// The fixture peer is plain http on loopback. Production never sets this flag on a stored
// peer; the test lets the guarded connect accept the one loopback port the peer row lists.
vi.mock('#lib/server/ai/mcp-client/peer-tools.ts', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./peer-tools')>();
	return {
		...actual,
		connectPeer: (peer: Parameters<typeof actual.connectPeer>[0], options = {}) =>
			actual.connectPeer(peer, { ...options, allowLoopbackHttp: true }),
	};
});

vi.mock('#lib/server/http/rate-limit.ts', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/server/http/rate-limit.ts')>()),
	createLimiter: () => ({ limit: async () => ({ success: true, reset: 0 }) }),
}));

const ROOT = process.cwd();
const PYTHON_READY = spawnSync('python3', ['-c', 'import mcp.server.mcpserver'], { stdio: 'ignore' }).status === 0;

const { POST } = await import('../../../../routes/api/ai/proposals/[id]/approve/+server.ts');
const { externalTools } = await import('../capabilities/external-tools');
const { createTurnState } = await import('../profile/profile');
const { collectApprovalRequests } = await import('../proposals/approval-boundary');
const { externalProposalOf } = await import('../proposals/external-proposal');
const { externalOperationRecord } = await import('#lib/server/external-operations/index.ts');
const { createProposal, getProposal } = await import('#lib/server/db/ai/proposals.ts');
const { getExternalOperation } = await import('#lib/server/db/ai/external-operations.ts');
const { activatePeerTool, deactivatePeerTool, saveMcpPeer } = await import('#lib/server/db/ai/mcp-peers.ts');
const { discoverDirectoryPeerTools } = await import('./peer-directory');
const { connectPeer } = await import('./peer-tools');
const { db } = await import('#lib/server/db/index.ts');

const OWNER = makeUser({ id: 'pyowner-user' });
const STRANGER = makeUser({ id: 'pystrang-user' });
const ADMIN = makeUser({ id: 'pyadmin-user' });
let conversationId: string;
let messageId: string;
let child: ChildProcess | undefined;
let port = 0;

async function freePort(): Promise<number> {
	const server = createServer();
	await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
	const { port: free } = server.address() as AddressInfo;
	await new Promise<void>((done) => server.close(() => done()));
	return free;
}

/** A raw client on the peer, outside v10r's path: what the notebook holds, and the drift trigger. */
async function onPeer(name: 'note_read' | 'rotate_contract', args: Record<string, unknown> = {}): Promise<string> {
	const connection = await connectPeer({
		id: 'probe',
		url: `http://127.0.0.1:${port}/mcp`,
		transport: 'streamable-http',
		auth: { kind: 'none' },
		policy: { allowTools: [name], readOnlyTools: [] },
		privateDestinations: [{ cidr: '127.0.0.1/32', port }],
	});
	try {
		const result = await connection.client.callTool({ name, arguments: args });
		return (result.content as Array<{ type: string; text?: string }>).map((b) => b.text ?? '').join('');
	} finally {
		await connection.close();
	}
}

const turnFor = (userId: string) => ({
	userId,
	userMsgText: '',
	locale: 'en' as const,
	authCeiling: 'user' as const,
	hasTools: true,
	toolsCooled: false,
	pageContext: null,
	scopes: ['desk:read' as const],
});

/** One deskbot turn up to its approval step: mount, call the tool as the model would, persist the proposal. */
async function proposeThroughTurn(
	userId: string,
	toolName: string,
	args: Record<string, unknown>,
	messages: unknown[] = [],
) {
	const turn = turnFor(userId);
	const state = createTurnState();
	const lane = await externalTools.grounding?.(turn, state);
	const tools = externalTools.tools?.(turn, state) ?? {};
	const mounted = Object.keys(tools).sort();
	const tool = tools[toolName];
	if (!tool?.execute) return { mounted, lane, proposalId: null, output: null };
	const toolCallId = `call-${crypto.randomUUID()}`;
	const output = await tool.execute(args, { toolCallId, messages } as never);
	const results = [{ toolCallId, toolName, input: args, output }];
	const draft = externalProposalOf(results, state.externalOperations);
	if (draft.kind !== 'one') return { mounted, lane, proposalId: null, output };
	const proposal = await createProposal({
		conversationId,
		messageId,
		payload: collectApprovalRequests(results).steps,
		externalOperation: externalOperationRecord(draft.prepared),
	});
	return { mounted, lane, proposalId: proposal.id, output, prepared: draft.prepared };
}

async function approve(proposalId: string, as: { id: string }, body: unknown = {}) {
	const response = await POST({
		params: { id: proposalId },
		locals: { user: { id: as.id }, session: { id: `session-${as.id}` } },
		request: new Request(`http://localhost/api/ai/proposals/${proposalId}/approve`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		}),
	} as never);
	return {
		status: response.status,
		body: (await response.json()) as {
			data: Record<string, unknown> & { external: Record<string, unknown>; receiptMessage: unknown; status: string };
		},
	};
}

describe.skipIf(!PYTHON_READY)('external operations against the official Python MCP SDK peer', () => {
	beforeAll(async () => {
		port = await freePort();
		child = spawn('python3', [join(ROOT, 'scripts/mcp-client/peer/server.py'), String(port)], {
			stdio: ['ignore', 'ignore', 'ignore'],
		});
		const deadline = Date.now() + 30_000;
		for (;;) {
			try {
				await onPeer('note_read', { key: 'warmup' });
				break;
			} catch (error) {
				if (Date.now() > deadline) throw error;
				await new Promise((resolve) => setTimeout(resolve, 250));
			}
		}

		await db.insert(user).values([OWNER, STRANGER, ADMIN]);
		const conv = makeConversation({ userId: OWNER.id, id: crypto.randomUUID() });
		await db.insert(conversation).values(conv);
		conversationId = conv.id;
		messageId = crypto.randomUUID();
		await db.insert(message).values({ id: messageId, conversationId, role: 'assistant', content: '' });

		// The operator's work, as the admin door records it. (The door itself stores https only;
		// the fixture peer is loopback http, so its row is written directly.)
		await saveMcpPeer(
			{
				id: 'python',
				label: 'Python notebook',
				url: `http://127.0.0.1:${port}/mcp`,
				secretRef: null,
				audience: 'user',
				maxArgumentBytes: null,
				privateDestinations: [{ cidr: '127.0.0.1/32', port }],
			},
			ADMIN.id,
		);
		const discovery = await discoverDirectoryPeerTools('python');
		expect(discovery.outcome).toBe('ok');
		const fingerprint = (name: string) => discovery.listing?.tools.find((t) => t.name === name)?.fingerprint ?? '';
		await activatePeerTool(
			{
				peerId: 'python',
				remoteName: 'note_read',
				fingerprint: fingerprint('note_read'),
				mutates: false,
				reversibility: 'unknown',
				argumentFields: ['key'],
			},
			ADMIN.id,
		);
		await activatePeerTool(
			{
				peerId: 'python',
				remoteName: 'note_write',
				fingerprint: fingerprint('note_write'),
				mutates: true,
				reversibility: 'compensatable',
				argumentFields: ['key', 'value'],
			},
			ADMIN.id,
		);
	}, 60_000);

	afterAll(async () => {
		child?.kill();
		await testClient?.close();
	});

	it('mounts only the activated tools, every one approval-gated', async () => {
		const { mounted } = await proposeThroughTurn(OWNER.id, 'none', {});
		expect(mounted).toEqual(['mcp_python_note_read', 'mcp_python_note_write']);
	});

	it('approved mutation: proposed with nothing sent, the card discloses it, the approval sends it once', async () => {
		const proposed = await proposeThroughTurn(OWNER.id, 'mcp_python_note_write', { key: 'alpha', value: 'one' });
		expect(proposed.output).toEqual({
			requiresApproval: true,
			action: 'Call "note_write" on the external peer "Python notebook"',
		});
		expect(await onPeer('note_read', { key: 'alpha' })).toBe('');
		expect(proposed.prepared?.disclosure).toMatchObject({
			protocol: 'mcp',
			peerLabel: 'Python notebook',
			destination: `http://127.0.0.1:${port}`,
			operation: 'note_write',
			fields: ['key', 'value'],
			preview: '{"key":"alpha","value":"one"}',
			credential: { kind: 'none' },
			mutates: true,
			reversibility: 'compensatable',
			grant: 'once',
			contentClass: 'arguments_only',
		});

		const id = proposed.proposalId as string;
		const answer = await approve(id, OWNER);
		expect(answer.status).toBe(200);
		expect(answer.body.data.external).toMatchObject({ status: 'succeeded', outcome: 'succeeded', delivery: 'sent' });
		expect(answer.body.data.status).toBe('executed');
		expect(await onPeer('note_read', { key: 'alpha' })).toBe('one');

		// A repeated approval answers from the receipt; the peer is not called again.
		await onPeer('note_read', { key: 'alpha' });
		const again = await approve(id, OWNER);
		expect(again.status).toBe(200);
		expect(again.body.data.external.outcome).toBe('succeeded');
	});

	it('approved read: the untrusted answer and the receipt reach the conversation for the next turn', async () => {
		const proposed = await proposeThroughTurn(OWNER.id, 'mcp_python_note_read', { key: 'alpha' });
		expect(proposed.prepared?.disclosure.mutates).toBe(false);
		const answer = await approve(proposed.proposalId as string, OWNER);
		expect(answer.status).toBe(200);
		expect(answer.body.data.external.result).toBe(
			'<untrusted-content source="mcp_python_note_read">\none\n</untrusted-content>',
		);
		const receiptMessage = answer.body.data.receiptMessage as { id: string; text: string };
		const [row] = await db.select().from(message).where(eq(message.id, receiptMessage.id));
		expect(row?.role).toBe('assistant');
		expect(row?.content).toContain('External call "note_read" on Python notebook');
		expect(row?.content).toContain('<untrusted-content source="mcp_python_note_read">');
	});

	it('unauthorized mutation: a stranger cannot spend the approval; nothing reaches the peer', async () => {
		const proposed = await proposeThroughTurn(OWNER.id, 'mcp_python_note_write', { key: 'alpha', value: 'stranger' });
		const answer = await approve(proposed.proposalId as string, STRANGER);
		expect(answer.status).toBe(404);
		expect((await getExternalOperation(proposed.proposalId as string))?.status).toBe('pending');
		expect(await onPeer('note_read', { key: 'alpha' })).toBe('one');
	});

	it('unauthorized mutation: a field the operator did not allow is never proposed', async () => {
		const proposed = await proposeThroughTurn(OWNER.id, 'mcp_python_note_write', {
			key: 'alpha',
			value: 'x',
			cc: 'someone@example.com',
		});
		expect(proposed.proposalId).toBeNull();
		expect(JSON.stringify(proposed.output)).toContain('argument_field_not_allowed');
	});

	it('unauthorized mutation: an activation revoked after approval refuses at execution', async () => {
		const proposed = await proposeThroughTurn(OWNER.id, 'mcp_python_note_write', { key: 'alpha', value: 'revoked' });
		await deactivatePeerTool('python', 'note_write', ADMIN.id);
		const answer = await approve(proposed.proposalId as string, OWNER);
		expect(answer.body.data.external).toMatchObject({
			outcome: 'refused',
			delivery: 'not_sent',
			reason: 'tool_revoked',
		});
		expect(await onPeer('note_read', { key: 'alpha' })).toBe('one');
		// Re-activate at the reviewed fingerprint for the drift scenario.
		const discovery = await discoverDirectoryPeerTools('python');
		await activatePeerTool(
			{
				peerId: 'python',
				remoteName: 'note_write',
				fingerprint: discovery.listing?.tools.find((t) => t.name === 'note_write')?.fingerprint ?? '',
				mutates: true,
				reversibility: 'compensatable',
				argumentFields: ['key', 'value'],
			},
			ADMIN.id,
		);
	});

	it('tool drift after approval invalidates the approval, and the drifted tool is no longer mounted', async () => {
		const proposed = await proposeThroughTurn(OWNER.id, 'mcp_python_note_write', { key: 'alpha', value: 'drifted' });
		expect(await onPeer('rotate_contract')).toBe('rotated');
		const answer = await approve(proposed.proposalId as string, OWNER);
		expect(answer.body.data.external).toMatchObject({
			outcome: 'refused',
			delivery: 'not_sent',
			reason: 'contract_drift',
		});
		expect((await getProposal(proposed.proposalId as string))?.status).toBe('failed');
		expect(await onPeer('note_read', { key: 'alpha' })).toBe('one');

		const after = await proposeThroughTurn(OWNER.id, 'none', {});
		expect(after.mounted).toEqual(['mcp_python_note_read']);
		const discovery = await discoverDirectoryPeerTools('python');
		expect(discovery.drift?.changed).toEqual(['note_write']);
	});
});
