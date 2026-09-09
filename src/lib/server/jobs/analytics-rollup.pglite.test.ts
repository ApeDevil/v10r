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
		// Single-page, no engagement → bounce. Confirmed: the headline columns
		// count confirmed sessions only.
		{
			id: 's_bounce',
			visitorId: 'v1',
			pageCount: 1,
			entryPath: '/a',
			startedAt: yesterdayAt(9),
			humanConfirmedAt: yesterdayAt(9),
		},
		// Multi-page, engaged → not a bounce.
		{
			id: 's_engaged',
			visitorId: 'v2',
			pageCount: 2,
			entryPath: '/a',
			startedAt: yesterdayAt(10),
			humanConfirmedAt: yesterdayAt(10),
		},
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

	it('splits unconfirmed traffic into its own column — a crawler-only path still gets a row', async () => {
		await db.insert(sessions).values([
			// Never corroborated by client JS — the spoofed-header crawler shape.
			{ id: 's_crawler', visitorId: 'v_crawler', pageCount: 1, entryPath: '/c', startedAt: yesterdayAt(12) },
		]);
		await db.insert(events).values([
			{ sessionId: 's_crawler', visitorId: 'v_crawler', eventType: 'pageview', path: '/c', timestamp: yesterdayAt(12) },
			{ sessionId: 's_crawler', visitorId: 'v_crawler', eventType: 'pageview', path: '/a', timestamp: yesterdayAt(12) },
		]);

		await analyticsRollup();
		const rows = await db.select().from(dailyPageStats);
		const byPath = new Map(rows.map((r) => [r.path, r]));

		// /c saw only the crawler: zeroed headline columns, its own count carried.
		const c = byPath.get('/c');
		expect(c?.pageviews).toBe(0);
		expect(c?.uniqueVisitors).toBe(0);
		expect(c?.unconfirmedPageviews).toBe(1);

		// /a keeps its confirmed numbers untouched by the crawler's visit there.
		const a = byPath.get('/a');
		expect(a?.pageviews).toBe(2);
		expect(a?.uniqueVisitors).toBe(2);
		expect(a?.unconfirmedPageviews).toBe(1);
		expect(a?.bounceRate).toBe(50);
	});

	it('excludes debug-owned events entirely', async () => {
		const { user } = await import('$lib/server/db/schema');
		await db.insert(user).values({ id: 'admin-ro', name: 'A', email: 'ro@example.com' }).onConflictDoNothing();
		await db.insert(events).values([
			{
				sessionId: 's_engaged',
				visitorId: 'v2',
				eventType: 'pageview',
				path: '/a',
				debugOwnerId: 'admin-ro',
				timestamp: yesterdayAt(12),
			},
		]);

		await analyticsRollup();
		const rows = await db.select().from(dailyPageStats);
		const pathA = rows.find((r) => r.path === '/a');
		expect(pathA?.pageviews).toBe(2); // unchanged — the tagged event never reached the CTE
	});
});
