import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { isFeedbackBandPath, sanitizeFeedbackSource } from './source';
import { feedbackSubmissionSchema } from './validation';

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

/**
 * The submission schema's wiring to the sanitiser above: a crafted `pageOfOrigin`
 * must DEGRADE to no-source rather than reject the whole submission — a visitor
 * should never lose their written feedback to a referrer they did not choose.
 */
const validBase = {
	subject: 'Broken layout on mobile',
	body: 'The cards overflow the viewport on a 375px screen.',
	rating: 4,
	contactEmail: 'someone@example.com',
	nonce: '5b2d9c1e-8f3a-4b7c-9d1e-2f3a4b5c6d7e',
	renderedAt: 1_700_000_000_000,
	bookmark: '',
};

describe('feedbackSubmissionSchema pageOfOrigin', () => {
	it('defaults to no-source when omitted', () => {
		const parsed = v.parse(feedbackSubmissionSchema, validBase);
		expect(parsed.pageOfOrigin).toBe('');
	});

	it('passes a valid internal path through', () => {
		const parsed = v.parse(feedbackSubmissionSchema, {
			...validBase,
			pageOfOrigin: '/showcases/ui/tokens',
		});
		expect(parsed.pageOfOrigin).toBe('/showcases/ui/tokens');
	});

	it('sanitizes a crafted value to no-source instead of rejecting the submission', () => {
		const parsed = v.parse(feedbackSubmissionSchema, {
			...validBase,
			pageOfOrigin: '//evil.com/phish',
		});
		expect(parsed.pageOfOrigin).toBe('');
	});
});
