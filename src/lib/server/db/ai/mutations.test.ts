import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import { conversation, message } from '../schema/ai/conversation';
import { user } from '../schema/auth/_better-auth';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { createConversation, deleteConversation, saveMessages, updateConversationTitle } = await import('./mutations');
const { db } = await import('$lib/server/db');

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
});
