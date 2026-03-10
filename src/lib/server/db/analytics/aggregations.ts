/**
 * Analytics aggregation queries — reads from rollup tables + computed aggregates.
 * These power the dashboard overview and breakdown views.
 */

import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type {
	BrowserSplit,
	ConsentSplit,
	CountrySplit,
	DeviceSplit,
	FunnelStep,
	OverviewMetrics,
	TopPage,
	TrafficTrendPoint,
} from '$lib/server/analytics/types';
import { db } from '$lib/server/db';
import { dailyPageStats, events, sessions } from '$lib/server/db/schema/analytics';

// ── Date helpers ─────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().slice(0, 10);
}

function dateRange(days: number) {
	return { from: daysAgo(days), to: daysAgo(0) };
}

// ── Overview metrics ─────────────────────────────────────────────────────────

export async function getOverviewMetrics(days: number): Promise<OverviewMetrics> {
	const { from, to } = dateRange(days);

	const result = await db
		.select({
			totalPageviews: sql<number>`coalesce(sum(${dailyPageStats.pageviews}), 0)`,
			uniqueVisitors: sql<number>`coalesce(sum(${dailyPageStats.uniqueVisitors}), 0)`,
			avgDuration: sql<number>`coalesce(avg(${dailyPageStats.avgDurationMs}), 0)`,
			avgBounce: sql<number>`coalesce(avg(${dailyPageStats.bounceRate}), 0)`,
		})
		.from(dailyPageStats)
		.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to)));

	const row = result[0];
	return {
		totalPageviews: Number(row?.totalPageviews ?? 0),
		uniqueVisitors: Number(row?.uniqueVisitors ?? 0),
		avgSessionDuration: Math.round(Number(row?.avgDuration ?? 0)),
		bounceRate: Math.round(Number(row?.avgBounce ?? 0)),
	};
}

// ── Traffic trend ────────────────────────────────────────────────────────────

export async function getTrafficTrend(days: number): Promise<TrafficTrendPoint[]> {
	const { from, to } = dateRange(days);

	return db
		.select({
			date: dailyPageStats.date,
			pageviews: sql<number>`sum(${dailyPageStats.pageviews})`,
			uniqueVisitors: sql<number>`sum(${dailyPageStats.uniqueVisitors})`,
		})
		.from(dailyPageStats)
		.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to)))
		.groupBy(dailyPageStats.date)
		.orderBy(dailyPageStats.date);
}

// ── Top pages ────────────────────────────────────────────────────────────────

export async function getTopPages(days: number, limit = 10): Promise<TopPage[]> {
	const { from, to } = dateRange(days);

	return db
		.select({
			path: dailyPageStats.path,
			pageviews: sql<number>`sum(${dailyPageStats.pageviews})`,
			uniqueVisitors: sql<number>`sum(${dailyPageStats.uniqueVisitors})`,
			avgDurationMs: sql<number | null>`avg(${dailyPageStats.avgDurationMs})::integer`,
			bounceRate: sql<number | null>`avg(${dailyPageStats.bounceRate})::integer`,
		})
		.from(dailyPageStats)
		.where(and(gte(dailyPageStats.date, from), lte(dailyPageStats.date, to)))
		.groupBy(dailyPageStats.path)
		.orderBy(desc(sql`sum(${dailyPageStats.pageviews})`))
		.limit(limit);
}

// ── Device / Browser / Country splits ────────────────────────────────────────

export async function getDeviceSplit(days: number): Promise<DeviceSplit[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({
			device: sql<string>`coalesce(${sessions.device}, 'unknown')`,
			count: sql<number>`count(*)`,
		})
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sessions.device)
		.orderBy(desc(sql`count(*)`));
}

export async function getBrowserSplit(days: number): Promise<BrowserSplit[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({
			browser: sql<string>`coalesce(${sessions.browser}, 'unknown')`,
			count: sql<number>`count(*)`,
		})
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sessions.browser)
		.orderBy(desc(sql`count(*)`));
}

export async function getCountrySplit(days: number): Promise<CountrySplit[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({
			country: sql<string>`coalesce(${sessions.country}, '??')`,
			count: sql<number>`count(*)`,
		})
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sessions.country)
		.orderBy(desc(sql`count(*)`));
}

// ── Consent distribution ─────────────────────────────────────────────────────

export async function getConsentSplit(days: number): Promise<ConsentSplit[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	return db
		.select({
			tier: sessions.consentTier,
			count: sql<number>`count(*)`,
		})
		.from(sessions)
		.where(gte(sessions.startedAt, cutoff))
		.groupBy(sessions.consentTier)
		.orderBy(desc(sql`count(*)`));
}

// ── Funnel analysis ──────────────────────────────────────────────────────────

export async function getFunnelSteps(days: number, steps: { label: string; path: string }[]): Promise<FunnelStep[]> {
	const cutoff = new Date(Date.now() - days * 86400000);

	const paths = steps.map((s) => s.path);

	// Single query: count distinct sessions per path
	const rows = await db
		.select({
			path: events.path,
			count: sql<number>`count(distinct ${events.sessionId})`,
		})
		.from(events)
		.where(and(inArray(events.path, paths), eq(events.eventType, 'pageview'), gte(events.timestamp, cutoff)))
		.groupBy(events.path);

	// Map results back to ordered steps
	const countByPath = new Map(rows.map((r) => [r.path, Number(r.count)]));
	const results: FunnelStep[] = steps.map((step) => ({
		label: step.label,
		path: step.path,
		count: countByPath.get(step.path) ?? 0,
		rate: 0,
	}));

	// Calculate conversion rates relative to first step
	const topOfFunnel = results[0]?.count ?? 1;
	for (const step of results) {
		step.rate = topOfFunnel > 0 ? Math.round((step.count / topOfFunnel) * 100) : 0;
	}

	return results;
}

// ── Data age stats (for privacy page) ────────────────────────────────────────

export async function getDataAgeStats() {
	const result = await db
		.select({
			totalEvents: sql<number>`count(*)`,
			oldestEvent: sql<string>`min(${events.timestamp})::text`,
			newestEvent: sql<string>`max(${events.timestamp})::text`,
			totalSessions: sql<number>`(SELECT count(*) FROM analytics.sessions)`,
		})
		.from(events);

	return result[0] ?? { totalEvents: 0, oldestEvent: null, newestEvent: null, totalSessions: 0 };
}
