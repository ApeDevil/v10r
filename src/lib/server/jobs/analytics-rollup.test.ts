/**
 * Analytics rollup — the daily (date, path) upsert cron.
 *
 * Real PGlite so the recursive CTE + INSERT … ON CONFLICT … RETURNING runs the
 * actual SQL. The count assertion doubles as a pin on `rowCountOf(RETURNING)`:
 * the previous raw `.rowCount` read existed only on the pg QueryResult shape
 * and silently reported 0 under pglite, making this job untestable.
 */
import type { PGlite } from '@electric-sql/pglite';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyPageStats, events, sessions } from '$lib/server/db/schema/analytics';

let testClient: PGlite;

vi.mock('$lib/server/db', async () => {
	const { createTestDb } = await import('$lib/server/test/db');
	const { db, client } = await createTestDb();
	testClient = client;
	return { db };
});

const { db } = await import('$lib/server/db');
const { analyticsRollup } = await import('./analytics-rollup');

afterAll(async () => {
	await testClient?.close();
});

function yesterdayAt(hour: number): Date {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	d.setHours(hour, 0, 0, 0);
	return d;
}

beforeEach(async () => {
	await db.delete(dailyPageStats);
	await db.delete(events);
	await db.delete(sessions);

	await db.insert(sessions).values([
		// Single-page, no engagement → bounce.
		{ id: 's_bounce', visitorId: 'v1', pageCount: 1, entryPath: '/a', startedAt: yesterdayAt(9) },
		// Multi-page, engaged → not a bounce.
		{ id: 's_engaged', visitorId: 'v2', pageCount: 2, entryPath: '/a', startedAt: yesterdayAt(10) },
	]);

	await db.insert(events).values([
		{ sessionId: 's_bounce', visitorId: 'v1', eventType: 'pageview', path: '/a', timestamp: yesterdayAt(9) },
		{ sessionId: 's_engaged', visitorId: 'v2', eventType: 'pageview', path: '/a', timestamp: yesterdayAt(10) },
		{ sessionId: 's_engaged', visitorId: 'v2', eventType: 'pageview', path: '/b', timestamp: yesterdayAt(11) },
		{
			sessionId: 's_engaged',
			visitorId: 'v2',
			eventType: 'action',
			path: '/a',
			metadata: { event: 'engagement', seconds: '45' },
			timestamp: yesterdayAt(10),
		},
	]);
});

describe('analyticsRollup', () => {
	it('rolls up yesterday into one row per path and reports the upserted count', async () => {
		const count = await analyticsRollup();
		expect(count).toBe(2); // /a and /b

		const rows = await db.select().from(dailyPageStats);
		const byPath = new Map(rows.map((r) => [r.path, r]));

		const a = byPath.get('/a');
		expect(a?.pageviews).toBe(2);
		expect(a?.uniqueVisitors).toBe(2);
		expect(a?.avgDurationMs).toBe(45_000);

		const b = byPath.get('/b');
		expect(b?.pageviews).toBe(1);
		expect(b?.uniqueVisitors).toBe(1);
	});

	it('is idempotent — a re-run upserts the same rows instead of duplicating them', async () => {
		expect(await analyticsRollup()).toBe(2);
		expect(await analyticsRollup()).toBe(2);
		expect(await db.select().from(dailyPageStats)).toHaveLength(2);
	});

	it('computes bounce rate from single-page unengaged sessions only', async () => {
		await analyticsRollup();
		const rows = await db.select().from(dailyPageStats);
		const pathA = rows.find((r) => r.path === '/a');
		// Two sessions touched /a; only s_bounce (single page, no engagement) bounces.
		expect(pathA?.bounceRate).toBe(50);
	});
});
