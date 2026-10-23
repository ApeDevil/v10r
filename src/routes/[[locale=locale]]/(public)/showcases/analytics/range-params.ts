import { urlParam } from '$lib/state/url-state';

export const ANALYTICS_SHOWCASE_RANGES = ['7', '30', '90'] as const;
export type AnalyticsShowcaseRange = (typeof ANALYTICS_SHOWCASE_RANGES)[number];

/**
 * `?range=` for one analytics showcase page. The page's load and its `DateRangePresets` build
 * the spec with the same fallback, so the range left out of the URL means the same on both.
 */
export const rangeParams = (fallback: AnalyticsShowcaseRange) => ({
	range: urlParam.oneOf(ANALYTICS_SHOWCASE_RANGES, fallback),
});
