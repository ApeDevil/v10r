/**
 * A2A delegation through the real persistent path: the `delegate_architecture_review` tool
 * prepares (content screen + the real A2A adapter reading a real loopback peer's card), the
 * prepared operation is persisted as a proposal with its `agent_external_operation` row, and two
 * independent executors race the approval — the peer receives exactly one SendMessage, the row
 * records the claim and the remote task, and a third executor answers from the row.
 *
 * The peer is v10r's own review agent on a loopback socket (`a2a/peer-fixture.ts`); the Python
 * peer runs the same adapter in `bun run a2a:interop`.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeConversation, makeUser } from '#lib/server/test/fixtures.ts';

let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createA2aDelegationAdapter, createDelegationBudget, sampleReviewModel } = await import(
	'#lib/server/a2a/index.ts'
);
const { serveA2aPeer, v10rReviewAgent } = await import('#lib/server/a2a/peer-fixture.ts');
const { createExternalOperationExecutor, externalOperationRecord } = await import(
	'#lib/server/external-operations/index.ts'
);
const { createProposal, getProposal } = await import('#lib/server/db/ai/proposals.ts');
const { countConversationExternalOperations, getExternalOperation } = await import(
	'#lib/server/db/ai/external-operations.ts'
);
const { db } = await import('#lib/server/db/index.ts');
const { conversation, message } = await import('#lib/server/db/schema/ai/conversation.ts');
const { user } = await import('#lib/server/db/schema/auth/_better-auth.ts');
const { createDelegateReviewTool } = await import('../tools/delegate-review');
const { wrapUntrusted } = await import('../untrusted-content');
type Prepared = import('#lib/server/external-operations/index.ts').PreparedExternalOperation;

const OWNER = makeUser({ id: 'delegator-user' });
const owner = { userId: OWNER.id, role: 'user' as const };
let conversationId: string;
let messageId: string;
let peer: Awaited<ReturnType<typeof serveA2aPeer>>;
let adapter: ReturnType<typeof createA2aDelegationAdapter>;

describe('A2A delegation — tool → proposal → persistent claim → one send', () => {
	beforeAll(async () => {
		await db.insert(user).values([OWNER]);
		const conv = makeConversation({ userId: OWNER.id, id: crypto.randomUUID() });
		await db.insert(conversation).values(conv);
		conversationId = conv.id;
		messageId = crypto.randomUUID();
		await db.insert(message).values({ id: messageId, conversationId, role: 'assistant', content: '' });
		peer = await serveA2aPeer(v10rReviewAgent);
		adapter = createA2aDelegationAdapter({
			peers: [
				{
					id: 'reviewer',
					label: 'Independent reviewer',
					origin: peer.origin,
					skills: ['architecture-review'],
					auth: { kind: 'none' },
					privateDestinations: peer.destinations,
				},
			],
			resolveSecret: () => undefined,
			wrapResult: wrapUntrusted,
			allowLoopbackHttp: true,
		});
	});
	afterAll(async () => {
		await peer?.close();
		await testClient?.close();
	});

	it('runs once across racing executors and records the remote task', async () => {
		const stash = new Map<string, Prepared>();
		const tool = createDelegateReviewTool(
			OWNER.id,
			{
				adapter,
				peers: [{ id: 'reviewer', label: 'Independent reviewer', skills: ['architecture-review'] }],
				budget: createDelegationBudget({ depth: 0, proposedInConversation: 0 }),
				conversationId,
			},
			stash,
		);
		const sentinel = await tool.execute?.(
			{ peer_id: 'reviewer', skill: 'architecture-review', model: sampleReviewModel() },
			{ toolCallId: 'call-1', messages: [], abortSignal: new AbortController().signal, context: {} },
		);
		expect(sentinel).toMatchObject({ requiresApproval: true });
		// Proposing read the card and sent no task.
		expect(peer.seen).toEqual(['GET /.well-known/agent-card.json']);
		const prepared = stash.get('call-1');
		if (!prepared) throw new Error('nothing prepared');
		expect(prepared.disclosure).toMatchObject({ protocol: 'a2a', contentClass: 'arguments_only', grant: 'once' });

		const proposal = await createProposal({
			conversationId,
			messageId,
			payload: [
				{
					toolName: prepared.toolName,
					args: prepared.request.arguments as Record<string, unknown>,
					action: 'Delegate',
				},
			],
			externalOperation: externalOperationRecord(prepared),
		});
		expect(await countConversationExternalOperations(conversationId, 'a2a')).toBe(1);

		const first = createExternalOperationExecutor({ adapters: { a2a: adapter } });
		const second = createExternalOperationExecutor({ adapters: { a2a: adapter } });
		await Promise.all([first.approve(proposal.id, owner), second.approve(proposal.id, owner)]);
		const sends = peer.seen.filter((line) => line.startsWith('POST '));
		expect(sends).toHaveLength(1);

		const row = await getExternalOperation(proposal.id);
		expect([row?.status, row?.delivery]).toEqual(['succeeded', 'sent']);
		expect(row?.result?.text).toMatch(/^<untrusted-content source="delegate_architecture_review">/);
		expect(row?.result?.text).toContain('"verified":false');
		expect(row?.result?.remoteTask?.taskId).toMatch(/^[A-Za-z0-9._:-]+$/);
		expect((await getProposal(proposal.id))?.status).toBe('executed');

		const third = await createExternalOperationExecutor({ adapters: { a2a: adapter } }).approve(proposal.id, owner);
		expect(third.kind).toBe('receipt');
		expect(peer.seen.filter((line) => line.startsWith('POST '))).toHaveLength(1);
	});
});
