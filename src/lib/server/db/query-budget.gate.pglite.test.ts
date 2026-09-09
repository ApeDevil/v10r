/**
 * QUERY BUDGET / N+1 GATE.
 *
 * N+1 is not "this statement ran twice". It is "the number of statements grew with the
 * number of rows", and that is a claim about two data sizes — which is why no amount of
 * inspecting a single request can settle it, and why this gate runs every registered
 * operation over a SMALL and a LARGE fixture and requires the counts to match.
 *
 * A flat count is the assertion that carries. The declared `maxQueries` is the second,
 * weaker one: it stops an operation quietly acquiring a sixth round trip that happens
 * not to scale. Both come from measurement, not from a guess — the numbers in
 * `query-budget.ts` are what this test measured on the day they were accepted.
 *
 * The last case is the control. A detector that has never seen a failure is not known to
 * work, so the file contains one deliberately N+1 access pattern and requires the census
 * to catch it. If that test ever passes by reporting a flat count, the gate above it is
 * measuring nothing.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { makeFile, makeFolder, makeUser } from '$lib/server/test/fixtures';
import { type BudgetedOperation, budgetedOperations, QUERY_BUDGETS, scoreQueryCensus } from './query-budget';
import { type QueryCensus, startQueryCensus } from './query-census';
import { user } from './schema/auth/_better-auth';
import { domain, post, postTag, revision, tag } from './schema/blog';
import { file } from './schema/desk/file';
import { folder } from './schema/desk/folder';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { queryCensusLogger } = await import('$lib/server/db/query-census');
	// The same logger the production `db` wires up. Wiring a different one here would
	// prove that a test double counts, which is not the claim.
	const { db, client } = await createTestDb({ logger: queryCensusLogger });
	testClient = client;
	return { db };
});

const { listPosts } = await import('$lib/server/blog/queries');
const { countFolderContents, getFile, listFiles, listFolders } = await import('./desk/queries');
const { db } = await import('$lib/server/db');

const OWNER = makeUser({ id: 'query-budget-owner' });
const DOMAIN_ID = 'dom-query-budget';
const ROOT_FOLDER = 'fol_query_budget_root';

/** Two sizes far enough apart that a per-row round trip cannot hide in the noise. */
const SMALL = 3;
const LARGE = 30;

/**
 * Replace the fixture set with exactly `size` posts, files and subfolders.
 *
 * Every post gets two revisions and a tag, because the shapes at risk in `listPosts`
 * are the revision and tag reads — a per-post fetch of either is the classic form, and
 * a single-revision fixture would let a `DISTINCT ON` regression pass unnoticed.
 */
async function seed(size: number) {
	await db.delete(postTag);
	await db.delete(revision);
	await db.delete(post);
	await db.delete(tag);
	await db.delete(file);
	await db.delete(folder);

	await db.insert(folder).values(makeFolder({ id: ROOT_FOLDER, userId: OWNER.id }));

	const posts = Array.from({ length: size }, (_, i) => ({
		id: `pst-${i}`,
		slug: `post-${i}`,
		authorId: OWNER.id,
		domainId: DOMAIN_ID,
		status: 'published' as const,
	}));
	await db.insert(post).values(posts);

	await db.insert(revision).values(
		posts.flatMap((p, i) =>
			[0, 1].map((n) => ({
				id: `rev-${i}-${n}`,
				postId: p.id,
				revisionNumber: n + 1,
				title: `Post ${i} revision ${n}`,
				markdown: 'body',
				contentHash: `hash-${i}-${n}`,
				createdAt: new Date(2026, 0, 1 + n),
			})),
		),
	);

	const tags = Array.from({ length: size }, (_, i) => ({ id: `tg-${i}`, slug: `tag-${i}`, name: `Tag ${i}` }));
	await db.insert(tag).values(tags);
	await db.insert(postTag).values(posts.map((p, i) => ({ postId: p.id, tagId: tags[i].id })));

	await db
		.insert(file)
		.values(
			Array.from({ length: size }, (_, i) => makeFile({ id: `fil_${i}`, userId: OWNER.id, folderId: ROOT_FOLDER })),
		);
	await db
		.insert(folder)
		.values(
			Array.from({ length: size }, (_, i) =>
				makeFolder({ id: `fol_${i}`, userId: OWNER.id, parentId: ROOT_FOLDER, name: `Sub ${i}` }),
			),
		);
}

/**
 * Every registered operation, driven at a caller-chosen size.
 *
 * `size` is passed as the page size on purpose: an operation asked for three rows and
 * an operation asked for thirty must cost the same, and capping the page at a constant
 * would test nothing but the cap.
 */
const OPERATIONS: Record<BudgetedOperation, (size: number) => Promise<unknown>> = {
	'blog.listPosts': (size) => listPosts({ pageSize: size }),
	'desk.listFiles': (size) => listFiles(OWNER.id, undefined, 0, size),
	'desk.listFolders': () => listFolders(OWNER.id),
	'desk.countFolderContents': () => countFolderContents(ROOT_FOLDER, OWNER.id),
};

async function census(work: () => Promise<unknown>): Promise<QueryCensus> {
	const counting = startQueryCensus();
	await counting.run(work);
	return counting;
}

describe('query budgets', () => {
	beforeAll(async () => {
		await db.insert(user).values(OWNER);
		await db.insert(domain).values({ id: DOMAIN_ID, slug: 'domain-a', name: 'Domain A' });
	});

	afterAll(async () => {
		await testClient?.close();
	});

	it('drives every registered operation', () => {
		// Registering a budget and never exercising it is worse than not registering it:
		// the registry then claims coverage the gate does not have.
		expect(Object.keys(OPERATIONS).sort()).toEqual([...budgetedOperations].sort());
	});

	it.each(budgetedOperations)('%s costs the same at three rows and at thirty', async (operation) => {
		await seed(SMALL);
		const small = await census(() => OPERATIONS[operation](SMALL));
		await seed(LARGE);
		const large = await census(() => OPERATIONS[operation](LARGE));

		expect(
			large.count,
			`${operation} made ${small.count} queries for ${SMALL} rows and ${large.count} for ${LARGE}. ` +
				'A count that grows with the row count is N+1: batch the per-row read by its ids.\n' +
				`Most repeated shape: ${large.worst()?.shape ?? '(none)'}`,
		).toBe(small.count);
	});

	it.each(budgetedOperations)('%s stays inside its declared budget', async (operation) => {
		await seed(LARGE);
		const verdict = scoreQueryCensus(operation, await census(() => OPERATIONS[operation](LARGE)));

		expect(
			verdict.overBudget,
			`${operation} made ${verdict.count} round trips against a budget of ${verdict.maxQueries}.\n` +
				`Budget rationale: ${QUERY_BUDGETS[operation].note}\n` +
				'Either remove the extra round trip, or raise the budget in query-budget.ts as a decision someone reviewed.',
		).toBe(false);
	});

	// The control. Everything above only means something if this fails to stay flat.
	it('catches a per-row read that the batched operations avoid', async () => {
		const perRow = async (size: number) => {
			await seed(size);
			const ids = Array.from({ length: size }, (_, i) => `fil_${i}`);
			return census(async () => {
				for (const id of ids) await getFile(id, OWNER.id);
			});
		};

		const small = await perRow(SMALL);
		const large = await perRow(LARGE);

		expect(large.count).toBeGreaterThan(small.count);
		expect(large.worst()).toEqual({ shape: expect.stringContaining('desk"."file"'), times: LARGE });
	});
});
