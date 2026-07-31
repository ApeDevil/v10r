/**
 * Art 17 erasure against the FOUR foreign keys that do NOT cascade.
 *
 * A bare `DELETE FROM auth.user` raises 23503 for any user who ever wrote a post,
 * issued a grant, commented, or had an llmwiki page compiled — i.e. for every admin
 * and most real users. These tests pin the reassign-then-delete transaction that
 * makes erasure actually complete, and the one case where it must REFUSE instead.
 *
 * Real PGlite (not mocks) so the actual RESTRICT/CASCADE evaluation order is exercised —
 * mocked FKs would prove nothing here. Only the two out-of-band sweeps (R2, Neo4j) are
 * stubbed, so the assertions are purely about the relational path.
 */
import type { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { user } from '$lib/server/db/schema/auth/_better-auth';
import { grant } from '$lib/server/db/schema/auth/grant';
import { comment } from '$lib/server/db/schema/blog/comment';
import { post } from '$lib/server/db/schema/blog/post';
import { publishedRevision } from '$lib/server/db/schema/blog/published-revision';
import { revision } from '$lib/server/db/schema/blog/revision';
import { chunk } from '$lib/server/db/schema/rag/chunk';
import { document } from '$lib/server/db/schema/rag/document';
import { embeddingModel } from '$lib/server/db/schema/rag/embedding-model';
import { llmwikiPage } from '$lib/server/db/schema/rag/llmwiki-page';
import { llmwikiPageSource } from '$lib/server/db/schema/rag/llmwiki-page-source';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

// The two best-effort sweeps are out of scope here — and left real they attempt a live
// Neo4j/R2 connection on every case.
vi.mock('$lib/server/graph/rag/mutations', () => ({ deleteUserGraph: async () => {} }));
vi.mock('$lib/server/store', () => ({ s3: null, BUCKET: '' }));
vi.mock('$lib/server/store/showcase/image', () => ({ deleteImagemetaObject: async () => {} }));

const { db } = await import('$lib/server/db');
const { deleteUserData, SoleAdminBlockedError } = await import('./mutations');

afterAll(async () => {
	await testClient?.close();
});

const ADMIN_1 = 'usr_admin1';
const ADMIN_2 = 'usr_admin2';
const AUTHOR = 'usr_author';

/** Delete children before parents — the RESTRICT FKs under test block a plain user wipe. */
async function wipe() {
	await db.delete(llmwikiPageSource);
	await db.delete(comment);
	await db.delete(publishedRevision);
	await db.delete(revision);
	await db.delete(post);
	await db.delete(grant);
	await db.delete(llmwikiPage);
	await db.delete(chunk);
	await db.delete(document);
	await db.delete(embeddingModel);
	await db.delete(user);
}

async function seedUsers(ids: string[]) {
	await db.insert(user).values(ids.map((id) => ({ id, name: id, email: `${id}@example.com` })));
}

/** A post plus the published_revision row that a comment's composite FK requires. */
async function seedPost(postId: string, authorId: string, slug: string) {
	await db.insert(post).values({ id: postId, slug, authorId, status: 'published' });
	await db.insert(revision).values({
		id: `rev_${postId}`,
		postId,
		revisionNumber: 1,
		title: 'T',
		markdown: '# body',
		locale: 'en',
		contentHash: 'hash1',
	});
	await db.insert(publishedRevision).values({ postId, locale: 'en', revisionId: `rev_${postId}` });
}

beforeEach(async () => {
	await wipe();
	vi.stubEnv('ADMIN_USER_ID', `${ADMIN_1},${ADMIN_2}`);
});

afterEach(() => {
	vi.unstubAllEnvs();
});

// ── the ordinary case: an author with all three RESTRICT references ───────────

describe('deleteUserData — reassigns what survives, deletes what does not', () => {
	it('erases a user who authored a post, issued a grant, and commented', async () => {
		await seedUsers([ADMIN_1, ADMIN_2, AUTHOR]);
		await seedPost('pst_1', AUTHOR, 'my-post');
		await db.insert(grant).values({ id: 'grt_1', userId: ADMIN_2, kind: 'blog-author', grantedBy: AUTHOR });
		await db.insert(comment).values({
			id: 'cmt_1',
			postId: 'pst_1',
			locale: 'en',
			authorId: AUTHOR,
			body: 'my own words',
			clientNonce: 'n1',
		});

		await expect(deleteUserData(AUTHOR)).resolves.toBeUndefined();

		// The article survives under a new owner — it is not the erasing user's data alone.
		const [postRow] = await db.select().from(post).where(eq(post.id, 'pst_1'));
		expect(postRow.authorId).toBe(ADMIN_1);

		// The grant is a record of an act on ADMIN_2's account; it must not vanish with the actor.
		const [grantRow] = await db.select().from(grant).where(eq(grant.id, 'grt_1'));
		expect(grantRow.grantedBy).toBe(ADMIN_1);
		expect(grantRow.userId).toBe(ADMIN_2); // the beneficiary is untouched

		// The comment is the user's own speech — Art 17 takes it.
		expect(await db.select().from(comment)).toHaveLength(0);
		expect(await db.select().from(user).where(eq(user.id, AUTHOR))).toHaveLength(0);
	});

	it('an admin erasing themselves hands their post to the OTHER admin, never back to themselves', async () => {
		await seedUsers([ADMIN_1, ADMIN_2]);
		await seedPost('pst_2', ADMIN_1, 'admin-post');

		await deleteUserData(ADMIN_1);

		const [postRow] = await db.select().from(post).where(eq(post.id, 'pst_2'));
		expect(postRow.authorId).toBe(ADMIN_2);
		expect(await db.select().from(user).where(eq(user.id, ADMIN_1))).toHaveLength(0);
	});
});

// ── the refusal: nobody left to inherit ──────────────────────────────────────

describe('deleteUserData — sole configured admin', () => {
	it('refuses with SoleAdminBlockedError and rolls back, leaving the account intact', async () => {
		vi.stubEnv('ADMIN_USER_ID', 'usr_only');
		await seedUsers(['usr_only']);
		await seedPost('pst_3', 'usr_only', 'only-post');

		await expect(deleteUserData('usr_only')).rejects.toBeInstanceOf(SoleAdminBlockedError);

		// A 500 with a half-erased account would be the real failure mode — assert the rollback.
		expect(await db.select().from(user).where(eq(user.id, 'usr_only'))).toHaveLength(1);
		expect(await db.select().from(post)).toHaveLength(1);
	});

	it('still erases a sole admin who has nothing to reassign', async () => {
		vi.stubEnv('ADMIN_USER_ID', 'usr_only');
		await seedUsers(['usr_only']);

		await expect(deleteUserData('usr_only')).resolves.toBeUndefined();
		expect(await db.select().from(user)).toHaveLength(0);
	});
});

// ── the probe: RAG-active user, where the cascade trips its own junction ─────

describe('deleteUserData — RAG-active user (llmwiki_page_source RESTRICT)', () => {
	it('erases a user with a compiled llmwiki page over their own chunks', async () => {
		await seedUsers([ADMIN_1, ADMIN_2, AUTHOR]);
		await db.insert(embeddingModel).values({
			id: 'emb_1',
			provider: 'google',
			modelName: 'text-embedding-004',
			dimensions: 1536,
		});
		await db.insert(document).values({
			id: 'doc_1',
			userId: AUTHOR,
			title: 'Notes',
			source: 'desk',
			contentHash: 'dh1',
			status: 'ready',
		});
		await db.insert(chunk).values({
			id: 'chk_1',
			documentId: 'doc_1',
			userId: AUTHOR,
			level: 'paragraph',
			position: 0,
			content: 'chunk body',
			tokenCount: 2,
			contentHash: 'ch1',
			embeddingModelId: 'emb_1',
		});
		await db.insert(llmwikiPage).values({
			id: 'lwp_1',
			userId: AUTHOR,
			slug: 'notes',
			title: 'Notes',
			tldr: 'tldr',
			tldrHash: 'th1',
			body: 'page body',
			sourceHash: 'sh1',
			compiledByModel: 'gemini-flash',
		});
		// The junction is the trap: it cascades from the PAGE but RESTRICTs the CHUNK and the
		// DOCUMENT, both of which the user cascade also reaches.
		await db.insert(llmwikiPageSource).values({
			llmwikiPageId: 'lwp_1',
			chunkId: 'chk_1',
			documentId: 'doc_1',
			sourceHashAtCompile: 'ch1',
		});

		await expect(deleteUserData(AUTHOR)).resolves.toBeUndefined();

		expect(await db.select().from(user).where(eq(user.id, AUTHOR))).toHaveLength(0);
		expect(await db.select().from(llmwikiPageSource)).toHaveLength(0);
		expect(await db.select().from(llmwikiPage)).toHaveLength(0);
		expect(await db.select().from(chunk)).toHaveLength(0);
		expect(await db.select().from(document)).toHaveLength(0);
	});
});
