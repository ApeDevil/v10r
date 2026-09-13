/**
 * The corpus boundary inside a tenant, against the real tier SQL: the deskbot's lane
 * (`source: 'desk'`) never returns a chunk of the same user's web upload, the chatbot's
 * unscoped call still sees every source, and a soft-deleted document is out of both.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeUser } from '$lib/server/test/fixtures';
import { user } from '../../db/schema/auth/_better-auth';
import { chunk } from '../../db/schema/retrieval/chunk';
import { document } from '../../db/schema/retrieval/document';
import { embeddingModel } from '../../db/schema/retrieval/embedding-model';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { searchContextual } = await import('./contextual');
const { searchParentChild } = await import('./parent-child');
const { db } = await import('$lib/server/db');

const OWNER = makeUser({ id: 'user-scope' });
const OTHER = makeUser({ id: 'user-other' });

/** A unit vector along one axis; documents get distinct but nearby directions. */
function vectorAlong(axis: number, lean = 0): number[] {
	const v = new Array(1536).fill(0);
	v[axis] = 1;
	if (lean) v[(axis + 1) % 1536] = lean;
	return v;
}
const QUERY = vectorAlong(0);

async function seed(id: string, userId: string, source: 'desk' | 'upload', deletedAt: Date | null = null) {
	await db.insert(document).values({
		id: `doc_${id}`,
		userId,
		title: `Doc ${id}`,
		source,
		sourceUri: source === 'desk' ? `desk_file_${id}` : null,
		contentHash: `h_${id}`,
		status: 'ready',
		deletedAt,
	});
	// A section parent and a paragraph child, both embedded near the query.
	await db.insert(chunk).values({
		id: `chk_${id}_parent`,
		documentId: `doc_${id}`,
		userId,
		level: 'section',
		position: 0,
		content: `parent ${id} budget total`,
		tokenCount: 3,
		contentHash: `pc_${id}`,
		embeddingModelId: 'emb',
		embedding: vectorAlong(0, 0.2),
	});
	await db.insert(chunk).values({
		id: `chk_${id}`,
		documentId: `doc_${id}`,
		userId,
		parentId: `chk_${id}_parent`,
		level: 'paragraph',
		position: 1,
		content: `child ${id} budget total`,
		tokenCount: 3,
		contentHash: `cc_${id}`,
		embeddingModelId: 'emb',
		embedding: vectorAlong(0, 0.1),
	});
}

describe('sourceScope in the tier SQL', () => {
	beforeAll(async () => {
		await db.insert(user).values([OWNER, OTHER]);
		await db
			.insert(embeddingModel)
			.values({ id: 'emb', provider: 'google', modelName: 'text-embedding-004', dimensions: 1536 });
		await seed('desk1', OWNER.id, 'desk');
		await seed('desk2', OWNER.id, 'desk');
		await seed('upload', OWNER.id, 'upload');
		await seed('gone', OWNER.id, 'desk', new Date());
		await seed('foreign', OTHER.id, 'desk');
	});
	afterAll(async () => {
		await testClient?.close();
	});

	it("tier 1 scoped to 'desk' returns only the owner's live desk documents", async () => {
		const hits = await searchContextual('budget total', QUERY, 10, OWNER.id, 'desk');
		const docs = new Set(hits.map((h) => h.documentId));
		expect(docs).toEqual(new Set(['doc_desk1', 'doc_desk2']));
	});

	it('tier 1 unscoped keeps every source the owner has — the chatbot lane is unchanged', async () => {
		const hits = await searchContextual('budget total', QUERY, 10, OWNER.id);
		const docs = new Set(hits.map((h) => h.documentId));
		expect(docs).toEqual(new Set(['doc_desk1', 'doc_desk2', 'doc_upload', 'doc_gone']));
	});

	it('tier 1 carries each hit’s place in its document — parent, level, position, hash, source uri', async () => {
		const hits = await searchContextual('budget total', QUERY, 10, OWNER.id, 'desk');
		const child = hits.find((h) => h.chunkId === 'chk_desk1');
		expect(child).toMatchObject({
			parentId: 'chk_desk1_parent',
			level: 'paragraph',
			position: 1,
			contentHash: 'cc_desk1',
			sourceUri: 'desk_file_desk1',
		});
		const parent = hits.find((h) => h.chunkId === 'chk_desk1_parent');
		expect(parent).toMatchObject({ parentId: null, level: 'section', position: 0, contentHash: 'pc_desk1' });
	});

	it("tier 2 scoped to 'desk' returns only desk parents", async () => {
		const hits = await searchParentChild(QUERY, 10, OWNER.id, 'desk');
		const docs = new Set(hits.map((h) => h.documentId));
		expect(docs).toEqual(new Set(['doc_desk1', 'doc_desk2']));
	});
});
