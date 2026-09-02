import type { InferSelectModel } from 'drizzle-orm';
import type { dailyPageStats, events, sessions } from '$lib/server/db/schema/analytics';

/**
 * Re-exported from `db/analytics/sentinels.ts`, which owns the definitions
 * (db is the allowed downward-import target for domain modules; see
 * docs/codebase-organization.md, Import-direction rule #4).
 */
export { UNKNOWN_CLIENT, UNKNOWN_COUNTRY } from '$lib/server/db/analytics/sentinels';

export type AnalyticsEvent = InferSelectModel<typeof events>;
export type AnalyticsSession = InferSelectModel<typeof sessions>;
export type DailyPageStat = InferSelectModel<typeof dailyPageStats>;

export interface TrafficTrendPoint {
	date: string;
	pageviews: number;
	uniqueVisitors: number;
}

/**
 * No `uniqueVisitors` here on purpose: this table is fed by summing the
 * per-day rollup, and summing `daily_page_stats.unique_visitors` across days
 * multiplies every returning visitor by the number of days they came back —
 * the exact documented error `getOverviewMetrics` and `getTrafficTrend` were
 * cured of. A per-path distinct count over a range needs the raw events; until
 * a panel actually needs one, the honest move is not to show the number.
 */
export interface TopPage {
	path: string;
	pageviews: number;
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

/**
 * Headline numbers are CONFIRMED-only: sessions the client-side confirm ping
 * (or any beacon batch) corroborated. Unconfirmed traffic — browser-shaped
 * requests that never ran JS, which is where spoofed-header crawlers land — is
 * carried alongside, never merged: one production week measured 588 of 612
 * "visitors" as unconfirmed.
 */
export interface OverviewMetrics {
	/** Pageviews from confirmed sessions. */
	totalPageviews: number;
	/** Distinct visitors with at least one confirmed session in range. */
	uniqueVisitors: number;
	avgSessionDuration: number;
	bounceRate: number;
	/** Pageviews from sessions never corroborated by client-side JS. */
	unconfirmedPageviews: number;
	/** Distinct visitors with only unconfirmed sessions in range. */
	unconfirmedVisitors: number;
}

/**
 * The three honestly-labelled buckets the composition panel renders. Bots are
 * counted in HITS (bot_hits carries no visitor identity by design), so the
 * bucket is not on the same axis as the two visitor counts — the panel copy
 * must say so rather than implying a like-for-like comparison.
 */
export interface TrafficComposition {
	confirmed: { pageviews: number; visitors: number };
	unconfirmed: {
		pageviews: number;
		visitors: number;
		/** Distinct unconfirmed visitors ranked by connection origin. */
		byIpClass: { datacenter: number; icloudRelay: number; unclassified: number };
	};
	bots: {
		hits: number;
		/** ai_agent category — a human reading through an AI, split out on purpose. */
		aiMediatedHits: number;
		byCategory: { category: string; hits: number }[];
	};
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
