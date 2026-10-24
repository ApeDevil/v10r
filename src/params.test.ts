import { describe, expect, it } from 'vitest';
import { params } from './params';

/** The router's own call: a matcher is a Standard Schema, and only `issues` refuses. */
const match = (segment: string) => params.locale['~standard'].validate(segment);

describe('locale param matcher', () => {
	it('returns the segment for a supported locale', () => {
		for (const locale of ['en', 'de', 'ru']) expect(match(locale)).toEqual({ value: locale });
	});

	// A boolean result would be a matched value (`false`), and `[[locale=locale]]` would then
	// swallow the first segment of every unprefixed URL.
	it('refuses every other first segment', () => {
		for (const segment of ['blog', 'admin', 'api', 'EN', 'de-DE', '']) {
			expect(match(segment)).toHaveProperty('issues');
		}
	});
});
