import type { InferSelectModel } from 'drizzle-orm';
import type { dailyPageStats, events, sessions } from '$lib/server/db/schema/analytics';

/**
 * Re-exported from `db/analytics/constants.ts`, which owns the definitions
 * (db is the allowed downward-import target for domain modules; see
 * docs/codebase-organization.md, Import-direction rule #4).
 */
export { UNKNOWN_CLIENT, UNKNOWN_COUNTRY } from '$lib/server/db/analytics/constants';

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

/**
 * One row of an audience breakdown — a dimension value and how many distinct
 * visitors carry it.
 *
 * `visitors` counts distinct `visitor_id`, which is the honest "how many people"
 * number. `sessions` is kept alongside because `sessions / visitors` is the
 * return rate, and a country with many sessions per visitor is a different
 * finding from one with many visitors making a single visit each.
 */
export interface AudienceSplit {
	/** ISO-3166-1 alpha-2 country, device class, or browser family. */
	key: string;
	visitors: number;
	sessions: number;
}

/**
 * Who the visitors are and where they came from, over one date range.
 *
 * Every visitor appears exactly once in each of the three arrays, so each array
 * sums to `totalVisitors` and a row's share is `visitors / totalVisitors`.
 *
 * The two coverage counts are not decoration — they are what stops the reader
 * drawing a false conclusion. `country` is resolved at the edge from the
 * connection and is therefore populated at every consent tier, while
 * `device`/`browser` are derived from the User-Agent (terminal configuration)
 * and exist only for visitors at the `analytics` tier. A device chart is
 * therefore a chart of *consenting* visitors, and saying so is the difference
 * between a breakdown and a misleading one.
 */
export interface AudienceBreakdown {
	countries: AudienceSplit[];
	devices: AudienceSplit[];
	browsers: AudienceSplit[];
	/** Distinct visitors in range — the denominator for every row above. */
	totalVisitors: number;
	/** Visitors with a resolved country. Near-total; low only off-Vercel. */
	locatedVisitors: number;
	/** Visitors with a known device/browser. Bounded by the consent rate. */
	classifiedVisitors: number;
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
