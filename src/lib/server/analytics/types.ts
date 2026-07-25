import type { InferSelectModel } from 'drizzle-orm';
import type { dailyPageStats, events, sessions } from '$lib/server/db/schema/analytics';

export type AnalyticsEvent = InferSelectModel<typeof events>;
export type Session = InferSelectModel<typeof sessions>;
export type DailyPageStat = InferSelectModel<typeof dailyPageStats>;

export interface TrafficTrendPoint {
	date: string;
	pageviews: number;
	uniqueVisitors: number;
}

export interface TopPage {
	path: string;
	pageviews: number;
	uniqueVisitors: number;
	avgDurationMs: number | null;
	bounceRate: number | null;
}

export interface DeviceSplit {
	device: string;
	count: number;
}

export interface BrowserSplit {
	browser: string;
	count: number;
}

export interface CountrySplit {
	country: string;
	count: number;
}

export interface ConsentSplit {
	tier: string;
	count: number;
}

export interface FunnelStep {
	label: string;
	path: string;
	count: number;
	rate: number;
}

export interface OverviewMetrics {
	totalPageviews: number;
	uniqueVisitors: number;
	avgSessionDuration: number;
	bounceRate: number;
}

/** One page-to-page navigation, aggregated across sessions. */
export interface TransitionRow {
	source: string;
	target: string;
	count: number;
}

/** A path with a session count — entry pages, exit pages. */
export interface PageCount {
	path: string;
	count: number;
}

/**
 * One Web Vital, summarised at the 75th percentile — the threshold Google's own
 * scoring uses, and the reason the mean is the wrong statistic here: a long tail
 * of slow interactions is exactly what the mean hides.
 */
export interface VitalSummary {
	metric: string;
	p75: number;
	samples: number;
	/** Most frequently blamed element, from the attribution build. */
	worstTarget: string | null;
}

/** An aggregated friction signal — rage clicks, dead clicks. */
export interface FrictionSignal {
	event: string;
	target: string;
	route: string;
	count: number;
}

/** Authenticated-lane usage summary. */
export interface UserLaneStats {
	activeUsers: number;
	events: number;
	topRoutes: { route: string; count: number }[];
}
