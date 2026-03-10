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

export interface JourneyPath {
	source: string;
	target: string;
	count: number;
	avgDurationMs: number;
}
