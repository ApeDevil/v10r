import { describe, expect, it } from 'vitest';
import { isFeedbackBandPath, sanitizeFeedbackSource } from './source';

describe('sanitizeFeedbackSource', () => {
	it('passes a plain internal path through unchanged', () => {
		expect(sanitizeFeedbackSource('/showcases/ui/tokens')).toBe('/showcases/ui/tokens');
		expect(sanitizeFeedbackSource('/docs/stack/viz')).toBe('/docs/stack/viz');
		expect(sanitizeFeedbackSource('/')).toBe('/');
	});

	it('degrades missing or empty input to no-source', () => {
		expect(sanitizeFeedbackSource(null)).toBe('');
		expect(sanitizeFeedbackSource(undefined)).toBe('');
		expect(sanitizeFeedbackSource('')).toBe('');
		expect(sanitizeFeedbackSource('   ')).toBe('');
	});

	it('rejects protocol-relative and absolute URLs', () => {
		expect(sanitizeFeedbackSource('//evil.com/phish')).toBe('');
		expect(sanitizeFeedbackSource('https://evil.com')).toBe('');
		expect(sanitizeFeedbackSource('javascript:alert(1)')).toBe('');
		expect(sanitizeFeedbackSource('docs/stack')).toBe('');
	});

	it('rejects backslash-disguised foreign origins (WHATWG folds \\ to /)', () => {
		expect(sanitizeFeedbackSource('/\\evil.com')).toBe('');
		expect(sanitizeFeedbackSource('/\\\\evil.com')).toBe('');
		expect(sanitizeFeedbackSource('///evil.com')).toBe('');
	});

	it('trims surrounding whitespace before checking the shape', () => {
		expect(sanitizeFeedbackSource('  /docs/stack/viz  ')).toBe('/docs/stack/viz');
	});

	it('caps overlong values at 512 characters', () => {
		const long = `/${'a'.repeat(600)}`;
		expect(sanitizeFeedbackSource(long)).toHaveLength(512);
		expect(sanitizeFeedbackSource(long)).toBe(long.slice(0, 512));
	});
});

describe('isFeedbackBandPath', () => {
	it('matches the showcases and docs hubs and their leaves', () => {
		expect(isFeedbackBandPath('/showcases')).toBe(true);
		expect(isFeedbackBandPath('/showcases/ui/tokens')).toBe(true);
		expect(isFeedbackBandPath('/docs')).toBe(true);
		expect(isFeedbackBandPath('/docs/stack/viz')).toBe(true);
	});

	it('rejects everything else, including prefix look-alikes', () => {
		expect(isFeedbackBandPath('/')).toBe(false);
		expect(isFeedbackBandPath('/feedback')).toBe(false);
		expect(isFeedbackBandPath('/blog')).toBe(false);
		expect(isFeedbackBandPath('/showcasesfoo')).toBe(false);
		expect(isFeedbackBandPath('/docsish')).toBe(false);
	});
});
