/**
 * `deskCorpusState` against real rows: the three answers the desk-ask capability keys its
 * activation on, and the boundaries that make them honest — another user's file, a
 * soft-deleted one and a web upload never count, and an `error` document is as good as
 * absent.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import { user } from '../schema/auth/_better-auth';
import { document } from '../schema/retrieval/document';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { deskCorpusState } = await import('./queries');
const { db } = await import('$lib/server/db');

const OWNER = makeUser({ id: 'user-corpus' });
const OTHER = makeUser({ id: 'user-elsewhere' });

type Status = 'pending' | 'processing' | 'ready' | 'error';

async function seed(
	id: string,
	userId: string,
	status: Status,
	source: 'desk' | 'upload' = 'desk',
	deletedAt: Date | null = null,
) {
	await db.insert(document).values({
		id: `doc_${id}`,
		userId,
		title: `Doc ${id}`,
		source,
		sourceUri: source === 'desk' ? `desk_file_${id}` : null,
		contentHash: `h_${id}`,
		status,
		deletedAt,
	});
}

beforeAll(async () => {
	await db.insert(user).values([OWNER, OTHER]);
});

afterAll(async () => {
	await testClient.close();
});

describe('deskCorpusState', () => {
	it('is none for a user with nothing opted into AI context', async () => {
		expect(await deskCorpusState(OWNER.id)).toBe('none');
	});

	it('ignores what is not the user’s own live desk corpus: other users, uploads, soft-deleted and errored rows', async () => {
		await seed('theirs', OTHER.id, 'ready');
		await seed('upload', OWNER.id, 'ready', 'upload');
		await seed('gone', OWNER.id, 'ready', 'desk', new Date());
		await seed('broken', OWNER.id, 'error');
		expect(await deskCorpusState(OWNER.id)).toBe('none');
	});

	it('is indexing while the desk sync still owes an embedding, ready once one document can be searched', async () => {
		await seed('fresh', OWNER.id, 'pending');
		expect(await deskCorpusState(OWNER.id)).toBe('indexing');
		await seed('midway', OWNER.id, 'processing');
		expect(await deskCorpusState(OWNER.id)).toBe('indexing');
		await seed('done', OWNER.id, 'ready');
		expect(await deskCorpusState(OWNER.id)).toBe('ready');
	});
});
