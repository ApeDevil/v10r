export const ANALYTICS_RANGES = ['7', '30', '90'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

/** `?range=7|30|90` for the analytics-family dashboards, default 30. Invalid values fall back rather than error — a mistyped bookmark should still render a dashboard. */
export function parseAnalyticsRange(url: URL): { range: AnalyticsRange; days: number } {
	const raw = url.searchParams.get('range');
	const range = ANALYTICS_RANGES.includes(raw as AnalyticsRange) ? (raw as AnalyticsRange) : '30';
	return { range, days: Number(range) };
}
