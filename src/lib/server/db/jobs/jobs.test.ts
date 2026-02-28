import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { jobExecution } from '../schema/jobs/job-execution';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');

describe('jobs schema (PGlite smoke test)', () => {
	afterAll(async () => {
		await testClient?.close();
	});

	it('inserts and reads a job execution', async () => {
		const now = new Date();
		const [row] = await db
			.insert(jobExecution)
			.values({
				jobSlug: 'session-cleanup',
				status: 'success',
				trigger: 'scheduler',
				startedAt: now,
				finishedAt: now,
				durationMs: 42,
				resultCount: 5,
			})
			.returning();

		expect(row).toBeDefined();
		expect(row.jobSlug).toBe('session-cleanup');
		expect(row.status).toBe('success');
		expect(row.durationMs).toBe(42);
		expect(row.resultCount).toBe(5);
		expect(row.id).toBeGreaterThan(0);
	});

	it('enforces NOT NULL on required columns', async () => {
		await expect(
			db.insert(jobExecution).values({
				jobSlug: 'test',
				status: 'success',
				trigger: 'manual',
				startedAt: new Date(),
				// durationMs missing — NOT NULL
			} as never),
		).rejects.toThrow();
	});
});
