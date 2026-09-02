import { describe, expect, it } from 'vitest';
import { ANALYTICS_RANGES, parseAnalyticsRange } from './analytics-range';

describe('parseAnalyticsRange', () => {
	it.each(ANALYTICS_RANGES)('accepts %s', (range) => {
		const parsed = parseAnalyticsRange(new URL(`https://x.test/admin/perf?range=${range}`));
		expect(parsed).toEqual({ range, days: Number(range) });
	});

	it('falls back to 30 when the param is missing', () => {
		expect(parseAnalyticsRange(new URL('https://x.test/admin/perf'))).toEqual({ range: '30', days: 30 });
	});

	it('falls back to 30 on values outside the allowlist rather than erroring', () => {
		for (const bad of ['14', '0', '-7', '9999', 'month', '']) {
			expect(parseAnalyticsRange(new URL(`https://x.test/a?range=${bad}`)).range).toBe('30');
		}
	});

	it('returns days as the numeric twin of range', () => {
		const { range, days } = parseAnalyticsRange(new URL('https://x.test/a?range=90'));
		expect(days).toBe(Number(range));
		expect(typeof days).toBe('number');
	});
});
