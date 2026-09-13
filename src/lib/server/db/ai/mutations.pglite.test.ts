import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import type { TurnTrace } from '$lib/types/turn-trace';
import { conversation, message } from '../schema/ai/conversation';
import { modelCall, toolCall, turn } from '../schema/ai/turn';
import { user } from '../schema/auth/_better-auth';
import { chunk } from '../schema/retrieval/chunk';
import { document } from '../schema/retrieval/document';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const {
	createConversation,
	deleteConversation,
	refreshConversationTokens,
	saveMessages,
	saveTurnTrace,
	updateConversationTitle,
	updateMessageContent,
} = await import('./mutations');
const { getTurn, resolveGroundingBodies } = await import('./queries');
const { db } = await import('$lib/server/db');

/** A minimal but complete trace for one assistant message. */
function traceFor(conversationId: string, messageId: string, overrides: Partial<TurnTrace> = {}): TurnTrace {
	return {
		messageId,
		conversationId,
		surface: 'chatbot',
		requestId: `req_${messageId}`,
		profileVersion: 'sys:abc',
		outcome: 'ok',
		errorKind: null,
		timings: { preStreamMs: 12 },
		awareness: { locale: 'en', authCeiling: 'user', page: null },
		activations: [{ id: 'project-docs', active: true }],
		blocks: [{ id: 'role', section: 'identity', text: 'You are Vely.', chars: 13, stable: true }],
		grounding: [
			{
				id: 'project-docs',
				ran: true,
				pool: 12,
				cutoff: 4,
				items: [
					{ id: 'chk_1', kind: 'chunk', title: 'Auth', rank: 0, state: 'included', blockId: 'retrieval-context' },
				],
			},
		],
		history: { messages: [{ role: 'user', parts: [{ type: 'text', chars: 5 }] }], droppedMessages: 0 },
		toolset: [{ name: 'search_catalog', description: 'Find a page', inputSchema: { type: 'object' } }],
		modelCalls: [
			{
				id: 'mcl_1',
				attemptIndex: 0,
				stepIndex: 0,
				providerId: 'openai',
				modelId: 'gpt-4o-mini',
				inputTokens: 100,
				outputTokens: 50,
				durationMs: 1234,
				request: { systemHash: 'sys:abc', blockIds: ['role'], historyCount: 1, toolsOffered: ['search_catalog'] },
				response: {
					textChars: 40,
					toolCalls: [{ toolCallId: 'call_1', toolName: 'search_catalog' }],
					finishReason: 'tool-calls',
				},
				outcome: 'ok',
			},
		],
		toolExecutions: [
			{
				id: 'tcl_1',
				toolCallId: 'call_1',
				toolName: 'search_catalog',
				ordinal: 0,
				modelCallId: 'mcl_1',
				input: { query: 'auth' },
				output: { results: [] },
				status: 'success',
				durationMs: 40,
				compaction: null,
			},
		],
		attempts: [{ attemptIndex: 0, providerId: 'openai', modelId: 'gpt-4o-mini', outcome: 'ok' }],
		citations: [],
		proposalId: null,
		createdAt: new Date().toISOString(),
		bodies: 'inline',
		...overrides,
	};
}

const USER_A = makeUser({ id: 'user-a' });
const USER_B = makeUser({ id: 'user-b' });

describe('AI mutations', () => {
	beforeAll(async () => {
		await db.insert(user).values([USER_A, USER_B]);
	});

	afterAll(async () => {
		await testClient?.close();
	});

	beforeEach(async () => {
		await db.delete(message);
		await db.delete(conversation);
	});

	describe('createConversation', () => {
		it('creates with UUID and default title', async () => {
			const result = await createConversation(USER_A.id);
			expect(result).toBeDefined();
			expect(result.id).toBeTruthy();
			expect(result.title).toBe('New conversation');
			expect(result.userId).toBe(USER_A.id);
		});

		it('creates with custom title', async () => {
			const result = await createConversation(USER_A.id, 'My Chat');
			expect(result.title).toBe('My Chat');
		});
	});

	describe('deleteConversation', () => {
		it('deletes own conversation', async () => {
			const conv = await createConversation(USER_A.id);
			const deleted = await deleteConversation(conv.id, USER_A.id);
			expect(deleted).toBe(true);
		});

		it('returns false for wrong userId (IDOR protection)', async () => {
			const conv = await createConversation(USER_A.id);
			const deleted = await deleteConversation(conv.id, USER_B.id);
			expect(deleted).toBe(false);
		});

		it('returns false for nonexistent conversation', async () => {
			const deleted = await deleteConversation('nonexistent', USER_A.id);
			expect(deleted).toBe(false);
		});
	});

	describe('saveMessages', () => {
		it('inserts messages into conversation', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_A.id, [
				{ id: 'msg-1', role: 'user', content: 'Hello' },
				{ id: 'msg-2', role: 'assistant', content: 'Hi there' },
			]);

			const rows = await db.select().from(message);
			expect(rows).toHaveLength(2);
			expect(rows[0].conversationId).toBe(conv.id);
		});

		it('is idempotent on conflict', async () => {
			const conv = await createConversation(USER_A.id);
			const msgs = [{ id: 'msg-1', role: 'user', content: 'Hello' }];

			await saveMessages(conv.id, USER_A.id, msgs);
			await saveMessages(conv.id, USER_A.id, msgs);

			const rows = await db.select().from(message);
			expect(rows).toHaveLength(1);
		});

		it('is a no-op for wrong userId (ownership check)', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_B.id, [{ id: 'msg-1', role: 'user', content: 'Hello' }]);

			const rows = await db.select().from(message);
			expect(rows).toHaveLength(0);
		});

		it('handles empty array as no-op', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_A.id, []);

			const rows = await db.select().from(message);
			expect(rows).toHaveLength(0);
		});

		// A chat turn lands its user message and the empty assistant row the stream backfills
		// in ONE call: one ownership check, one insert, one `updatedAt` touch.
		it('lands both rows of a turn in one call, touching updatedAt once', async () => {
			const conv = await createConversation(USER_A.id);
			await new Promise((r) => setTimeout(r, 5));
			await saveMessages(conv.id, USER_A.id, [
				{ id: 'u-1', role: 'user', content: 'Hello', route: '/showcases' },
				{ id: 'a-1', role: 'assistant', content: '' },
			]);

			const rows = await db.select().from(message);
			expect(rows.map((r) => [r.role, r.content, r.route]).sort()).toEqual([
				['assistant', '', null],
				['user', 'Hello', '/showcases'],
			]);
			const [after] = await db.select().from(conversation);
			expect(after.updatedAt.getTime()).toBeGreaterThan(conv.updatedAt.getTime());
		});

		it('refuses both rows of a turn for a foreign conversation', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_B.id, [
				{ id: 'u-1', role: 'user', content: 'Hello' },
				{ id: 'a-1', role: 'assistant', content: '' },
			]);

			expect(await db.select().from(message)).toHaveLength(0);
			const [row] = await db.select().from(conversation);
			expect(row.updatedAt.getTime()).toBe(conv.updatedAt.getTime());
		});
	});

	describe('updateConversationTitle', () => {
		it('updates title for own conversation', async () => {
			const conv = await createConversation(USER_A.id);
			await updateConversationTitle(conv.id, USER_A.id, 'Updated Title');

			const [row] = await db.select().from(conversation);
			expect(row.title).toBe('Updated Title');
		});

		it('does not update for wrong userId', async () => {
			const conv = await createConversation(USER_A.id, 'Original');
			await updateConversationTitle(conv.id, USER_B.id, 'Hacked');

			const [row] = await db.select().from(conversation);
			expect(row.title).toBe('Original');
		});
	});

	describe('saveTurnTrace', () => {
		it('writes the turn, its model calls and its tool executions in one go, readable back by the owner', async () => {
			const conv = await createConversation(USER_A.id, 'T', 'chatbot');
			await saveMessages(conv.id, USER_A.id, [{ id: 'amsg-1', role: 'assistant', content: '' }]);

			await saveTurnTrace(traceFor(conv.id, 'amsg-1'), USER_A.id);

			const [row] = await db.select().from(turn);
			expect(row.messageId).toBe('amsg-1');
			expect(row.userId).toBe(USER_A.id);
			expect(row.blocks?.[0]?.text).toBe('You are Vely.');
			const [call] = await db.select().from(modelCall);
			expect(call).toMatchObject({
				id: 'mcl_1',
				providerId: 'openai',
				modelId: 'gpt-4o-mini',
				inputTokens: 100,
				outputTokens: 50,
			});
			const [exec] = await db.select().from(toolCall);
			expect(exec).toMatchObject({ id: 'tcl_1', modelCallId: 'mcl_1', toolCallId: 'call_1', status: 'success' });

			const read = await getTurn('amsg-1', USER_A.id);
			expect(read?.modelCalls).toHaveLength(1);
			expect(read?.toolExecutions[0]?.output).toEqual({ results: [] });
			expect(read?.bodies).toBe('inline');
			// Owner-scoped: another user reads nothing.
			expect(await getTurn('amsg-1', USER_B.id)).toBeNull();
		});

		it('is a no-op for a conversation the caller does not own, and idempotent for one they do', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_A.id, [{ id: 'amsg-2', role: 'assistant', content: '' }]);

			await saveTurnTrace(traceFor(conv.id, 'amsg-2'), USER_B.id);
			expect(await db.select().from(turn)).toHaveLength(0);

			await saveTurnTrace(traceFor(conv.id, 'amsg-2'), USER_A.id);
			await saveTurnTrace(traceFor(conv.id, 'amsg-2'), USER_A.id);
			expect(await db.select().from(turn)).toHaveLength(1);
			expect(await db.select().from(modelCall)).toHaveLength(1);
		});

		it('sums the conversation totals from the model calls, and cascades away with the conversation', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_A.id, [{ id: 'amsg-3', role: 'assistant', content: '' }]);
			await saveTurnTrace(traceFor(conv.id, 'amsg-3'), USER_A.id);
			await refreshConversationTokens(conv.id);
			const [row] = await db.select().from(conversation);
			expect(row.totalInputTokens).toBe(100);
			expect(row.totalOutputTokens).toBe(50);

			await deleteConversation(conv.id, USER_A.id);
			expect(await db.select().from(turn)).toHaveLength(0);
			expect(await db.select().from(modelCall)).toHaveLength(0);
			expect(await db.select().from(toolCall)).toHaveLength(0);
		});
	});

	describe('resolveGroundingBodies', () => {
		beforeAll(async () => {
			await db.insert(document).values({
				id: 'doc_a',
				userId: USER_A.id,
				title: 'Doc A',
				source: 'docs',
				sourceUri: '/docs/a',
				contentHash: 'h_doc_a',
				status: 'ready',
			});
			await db.insert(chunk).values([
				{
					id: 'chk_a_parent',
					documentId: 'doc_a',
					userId: USER_A.id,
					level: 'section',
					position: 0,
					content: 'the whole section',
					tokenCount: 3,
					contentHash: 'pc_a',
				},
				{
					id: 'chk_a',
					documentId: 'doc_a',
					userId: USER_A.id,
					parentId: 'chk_a_parent',
					level: 'paragraph',
					position: 1,
					content: 'the paragraph',
					contextPrefix: 'Doc A > Section',
					tokenCount: 2,
					contentHash: 'cc_a',
				},
			]);
		});

		const itemTrace = (contentHash: string) =>
			traceFor('conv', 'amsg-9', {
				grounding: [
					{
						id: 'project-docs',
						ran: true,
						items: [
							{
								id: 'chk_a',
								kind: 'chunk',
								title: 'Doc A',
								rank: 0,
								state: 'included',
								parentId: 'chk_a_parent',
								contentHash,
							},
						],
					},
				],
			});

		it('fills the body, flags drift against the recorded hash, and reads the parent as it stands now', async () => {
			const resolved = await resolveGroundingBodies(itemTrace('stale'), [USER_A.id]);
			const item = resolved.grounding[0].items[0];
			expect(item.body).toBe('Doc A > Section\nthe paragraph');
			expect(item.drifted).toBe(true);
			expect(item.parent).toEqual({ level: 'section', position: 0, chars: 'the whole section'.length });

			const fresh = await resolveGroundingBodies(itemTrace('cc_a'), [USER_A.id]);
			expect(fresh.grounding[0].items[0].drifted).toBe(false);
		});

		it('reads nothing — no body, no parent — for an owner the viewer may not read', async () => {
			const resolved = await resolveGroundingBodies(itemTrace('cc_a'), [USER_B.id]);
			const item = resolved.grounding[0].items[0];
			expect(item).not.toHaveProperty('body');
			expect(item).not.toHaveProperty('parent');
			expect(item.parentId).toBe('chk_a_parent');
		});
	});

	describe('updateMessageContent', () => {
		it('backfills the text and, when given, the parts', async () => {
			const conv = await createConversation(USER_A.id);
			await saveMessages(conv.id, USER_A.id, [{ id: 'amsg-4', role: 'assistant', content: '' }]);
			await updateMessageContent('amsg-4', 'Hello', [{ type: 'text', text: 'Hello' }]);
			const [row] = await db.select().from(message);
			expect(row.content).toBe('Hello');
			expect(row.parts).toEqual([{ type: 'text', text: 'Hello' }]);
		});
	});
});
