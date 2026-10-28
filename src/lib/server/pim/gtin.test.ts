import { describe, expect, it } from 'vitest';
import { isValidGtin, normalizeGtin } from './gtin';

describe('isValidGtin', () => {
	it('accepts GTIN-8/12/13/14 with a correct check digit', () => {
		for (const gtin of ['96385074', '036000291452', '4006381333931', '10012345678902'])
			expect(isValidGtin(gtin)).toBe(true);
	});

	it('refuses a wrong check digit, a wrong length, or non-digits', () => {
		expect(isValidGtin('4006381333932')).toBe(false);
		expect(isValidGtin('400638133393')).toBe(false);
		expect(isValidGtin('40063813339a1')).toBe(false);
	});
});

describe('normalizeGtin', () => {
	it('restores leading zeros a numeric cell dropped', () => {
		expect(normalizeGtin('12345678905')).toBe('0012345678905');
		expect(normalizeGtin('40063813339')).toBe('0040063813339');
	});

	it('pads a UPC-A to GTIN-13 and strips spaces and hyphens', () => {
		expect(normalizeGtin('036000291452')).toBe('0036000291452');
		expect(normalizeGtin('400-6381 333931')).toBe('4006381333931');
	});

	it('refuses scientific notation and a padded number whose check digit fails — never a guess', () => {
		expect(normalizeGtin('4.01235E+12')).toBeNull();
		expect(normalizeGtin('12345678906')).toBeNull();
		expect(normalizeGtin('1234567')).toBeNull();
	});
});
