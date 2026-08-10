import { describe, expect, it } from 'vitest';
import { isQuietNow, minutesOfDayInTz, parseHhMm } from './quiet-hours';

describe('parseHhMm', () => {
	it('accepts valid HH:MM', () => {
		expect(parseHhMm('00:00')).toBe(0);
		expect(parseHhMm('08:30')).toBe(510);
		expect(parseHhMm('23:59')).toBe(1439);
		expect(parseHhMm(' 22:00 ')).toBe(1320);
	});

	it('rejects anything else — fail closed', () => {
		for (const bad of [null, undefined, '', 'garbage', '24:00', '23:60', '7:30', '07:5', '07:30:00', '-1:00']) {
			expect(parseHhMm(bad as string | null)).toBeNull();
		}
	});
});

describe('minutesOfDayInTz', () => {
	// 2026-08-10T12:00:00Z — Berlin is CEST (+2), Los Angeles PDT (-7).
	const instant = new Date('2026-08-10T12:00:00Z');

	it('resolves the same instant differently per zone', () => {
		expect(minutesOfDayInTz('UTC', instant)).toBe(12 * 60);
		expect(minutesOfDayInTz('Europe/Berlin', instant)).toBe(14 * 60);
		expect(minutesOfDayInTz('America/Los_Angeles', instant)).toBe(5 * 60);
	});

	it('follows DST rather than a fixed offset', () => {
		// January: Berlin is CET (+1), not CEST (+2).
		const winter = new Date('2026-01-10T12:00:00Z');
		expect(minutesOfDayInTz('Europe/Berlin', winter)).toBe(13 * 60);
		expect(minutesOfDayInTz('Europe/Berlin', instant)).toBe(14 * 60);
	});

	it('treats an unknown zone as UTC instead of throwing', () => {
		expect(minutesOfDayInTz('Not/AZone', instant)).toBe(12 * 60);
	});
});

describe('isQuietNow', () => {
	const at = (utcHour: number, min = 0) => new Date(Date.UTC(2026, 7, 10, utcHour, min)); // 2026-08-10

	it('a same-day window contains only its own span', () => {
		// 09:00 → 17:00 UTC
		expect(isQuietNow('09:00', '17:00', 'UTC', at(8, 59))).toBe(false);
		expect(isQuietNow('09:00', '17:00', 'UTC', at(9))).toBe(true);
		expect(isQuietNow('09:00', '17:00', 'UTC', at(12))).toBe(true);
		// End is exclusive — the window closes AT 17:00.
		expect(isQuietNow('09:00', '17:00', 'UTC', at(17))).toBe(false);
	});

	it('a wrap-around window spans midnight — the common configuration', () => {
		// 22:00 → 08:00 UTC
		expect(isQuietNow('22:00', '08:00', 'UTC', at(21, 59))).toBe(false);
		expect(isQuietNow('22:00', '08:00', 'UTC', at(22))).toBe(true);
		expect(isQuietNow('22:00', '08:00', 'UTC', at(23, 30))).toBe(true);
		expect(isQuietNow('22:00', '08:00', 'UTC', at(0))).toBe(true);
		expect(isQuietNow('22:00', '08:00', 'UTC', at(7, 59))).toBe(true);
		expect(isQuietNow('22:00', '08:00', 'UTC', at(8))).toBe(false);
	});

	it('is evaluated in the user timezone, not the server one', () => {
		// 23:00 UTC is 01:00 in Berlin (CEST) → inside a 22:00–08:00 window
		// either way; 20:00 UTC is 22:00 Berlin → quiet in Berlin, NOT in UTC.
		expect(isQuietNow('22:00', '08:00', 'UTC', at(20))).toBe(false);
		expect(isQuietNow('22:00', '08:00', 'Europe/Berlin', at(20))).toBe(true);
	});

	it('start === end is disabled (ambiguous between zero-length and 24h)', () => {
		expect(isQuietNow('09:00', '09:00', 'UTC', at(9))).toBe(false);
		expect(isQuietNow('09:00', '09:00', 'UTC', at(3))).toBe(false);
	});

	it('null / empty / garbage disables quiet hours', () => {
		expect(isQuietNow(null, '08:00', 'UTC', at(3))).toBe(false);
		expect(isQuietNow('22:00', null, 'UTC', at(3))).toBe(false);
		expect(isQuietNow(undefined, undefined, 'UTC', at(3))).toBe(false);
		expect(isQuietNow('', '', 'UTC', at(3))).toBe(false);
		expect(isQuietNow('garbage', '08:00', 'UTC', at(3))).toBe(false);
		expect(isQuietNow('25:00', '08:00', 'UTC', at(3))).toBe(false);
	});

	it('a missing timezone falls back to UTC rather than disabling', () => {
		expect(isQuietNow('22:00', '08:00', null, at(23))).toBe(true);
		expect(isQuietNow('22:00', '08:00', undefined, at(12))).toBe(false);
	});
});
