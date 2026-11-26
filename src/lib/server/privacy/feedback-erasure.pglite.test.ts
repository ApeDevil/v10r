/**
 * Account erasure and export for feedback (docs/blueprint/feedback/request-driven-development.md
 * §R.1). A row that never held engineering state goes with the account; a row that does is
 * kept as a non-personal shell, so erasure cannot free the development slot or drop what a
 * pending release needs. Real PGlite, so the CASCADE / SET NULL order is the database's own.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '#lib/server/db/schema/auth/_better-auth.ts';
import { feedback } from '#lib/server/db/schema/feedback/index.ts';

let testClient: PGlite;

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});
vi.mock('#lib/server/graph/retrieval/mutations.ts', () => ({ deleteUserGraph: async () => {} }));
vi.mock('#lib/server/store/index.ts', () => ({ s3: null, BUCKET: '' }));
vi.mock('#lib/server/store/image.ts', () => ({ deleteImagemetaObject: async () => {} }));

const { db } = await import('#lib/server/db/index.ts');
const { deleteUserData } = await import('./mutations');
const { collectUserData } = await import('./report');

afterAll(async () => {
	await testClient?.close();
});

const ERASED = 'usr_erased';
const OTHER = 'usr_other';

type Row = typeof feedback.$inferInsert;

function row(id: string, overrides: Partial<Row> = {}): Row {
	return {
		id,
		userId: ERASED,
		subject: `subject of ${id}`,
		body: `personal words in ${id}`,
		contactEmail: 'erased@example.com',
		sessionId: 'sess_1',
		pageOfOrigin: '/blog/my-post',
		routeId: '/blog/[slug]',
		appVersion: 'abc123',
		errorId: 'err-1',
		triageNote: 'Admin quoted: personal words',
		nonce: crypto.randomUUID(),
		...overrides,
	};
}

beforeEach(async () => {
	vi.stubEnv('ADMIN_USER_ID', 'usr_admin');
	await db.delete(feedback);
	await db.delete(user);
	await db.insert(user).values([
		{ id: ERASED, name: 'Erased', email: 'erased@example.com' },
		{ id: OTHER, name: 'Other', email: 'other@example.com' },
	]);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('deleteUserData — feedback', () => {
	it('deletes rows that never held engineering state, whatever their triage state', async () => {
		await db
			.insert(feedback)
			.values([
				row('fbk_received'),
				row('fbk_deferred', { status: 'deferred' }),
				row('fbk_accepted', { status: 'accepted' }),
				row('fbk_closed', { status: 'closed', closeReason: 'rejected' }),
				row('fbk_other', { userId: OTHER }),
				row('fbk_anon', { userId: null }),
			]);
		await deleteUserData(ERASED);
		const ids = (await db.select({ id: feedback.id }).from(feedback)).map((r) => r.id).sort();
		expect(ids).toEqual(['fbk_anon', 'fbk_other']);
	});

	it('keeps an engineering row as a shell: nothing that identifies or correlates, engineering state intact', async () => {
		const submittedAt = new Date('2026-11-20T14:37:21.456Z');
		const nonces = [crypto.randomUUID(), crypto.randomUUID()];
		await db
			.insert(feedback)
			.values([
				row('fbk_active', { status: 'in_development', submittedAt, nonce: nonces[0], rating: 2 }),
				row('fbk_released', { status: 'released', submittedAt, nonce: nonces[1], rating: 5 }),
			]);
		await deleteUserData(ERASED);

		const shells = await db.select().from(feedback).orderBy(feedback.id);
		expect(shells).toHaveLength(2);
		for (const shell of shells) {
			expect(shell).toMatchObject({
				userId: null,
				subject: '',
				body: '',
				contactEmail: null,
				sessionId: null,
				pageOfOrigin: '',
				triageNote: null,
				rating: null,
				// The error reference joins to log lines about the person's request.
				errorId: null,
				routeId: '/blog/[slug]',
				appVersion: 'abc123',
			});
			expect(nonces).not.toContain(shell.nonce);
			// Coarsened to the day: the exact second correlates with request logs.
			expect(shell.submittedAt.toISOString()).toBe('2026-11-20T00:00:00.000Z');
			expect(shell.erasedAt).toBeInstanceOf(Date);
			expect(JSON.stringify(shell)).not.toContain('personal');
		}
		expect(shells.map((s) => s.status).sort()).toEqual(['in_development', 'released']);
	});

	it('cannot free the single development slot', async () => {
		await db.insert(feedback).values(row('fbk_active', { status: 'in_development' }));
		await db.insert(feedback).values(row('fbk_waiting', { userId: OTHER, status: 'accepted' }));
		await deleteUserData(ERASED);

		const err = await db
			.update(feedback)
			.set({ status: 'in_development' })
			.where(eq(feedback.id, 'fbk_waiting'))
			.then(() => null)
			.catch((e: unknown) => e);
		expect(err).not.toBeNull();
	});

	it('leaves duplicates of an erased row closed as duplicates with no target, and links to a shell intact', async () => {
		await db.insert(feedback).values([row('fbk_original'), row('fbk_shell', { status: 'released' })]);
		await db.insert(feedback).values([
			row('fbk_dup_of_deleted', {
				userId: OTHER,
				status: 'closed',
				closeReason: 'duplicate',
				duplicateOf: 'fbk_original',
			}),
			row('fbk_dup_of_shell', {
				userId: OTHER,
				status: 'closed',
				closeReason: 'duplicate',
				duplicateOf: 'fbk_shell',
			}),
		]);
		await deleteUserData(ERASED);

		const [toDeleted] = await db.select().from(feedback).where(eq(feedback.id, 'fbk_dup_of_deleted'));
		const [toShell] = await db.select().from(feedback).where(eq(feedback.id, 'fbk_dup_of_shell'));
		expect(toDeleted).toMatchObject({ status: 'closed', closeReason: 'duplicate', duplicateOf: null });
		expect(toShell).toMatchObject({ duplicateOf: 'fbk_shell' });
	});
});

describe('collectUserData — feedback', () => {
	it('exports the user’s own feedback in full, without the admin note or other people’s rows', async () => {
		await db
			.insert(feedback)
			.values([
				row('fbk_mine'),
				row('fbk_bare', { pageOfOrigin: '', routeId: null, appVersion: null, errorId: null, sessionId: null }),
				row('fbk_theirs', { userId: OTHER }),
			]);
		const report = await collectUserData(ERASED);
		expect(report.feedback).toMatchObject({ available: true, portable: true });
		expect(report.feedback.data?.count).toBe(2);
		const bare = report.feedback.data?.items.find((item) => item.id === 'fbk_bare');
		expect(bare?.technicalContext).toBeNull();
		const mine = report.feedback.data?.items.find((item) => item.id === 'fbk_mine');
		expect(mine?.technicalContext).toEqual({
			page: '/blog/my-post',
			route: '/blog/[slug]',
			errorId: 'err-1',
			appVersion: 'abc123',
			journeyLinked: true,
		});
		expect(JSON.stringify(report.feedback)).not.toContain('sess_1');
		expect(mine).toMatchObject({
			id: 'fbk_mine',
			body: 'personal words in fbk_mine',
			contactEmail: 'erased@example.com',
		});
		expect(mine).not.toHaveProperty('triageNote');
	});
});
