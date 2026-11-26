import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import {
	feedbackFormHref,
	feedbackRouteFromRouteId,
	isFeedbackBandPath,
	sanitizeFeedbackErrorId,
	sanitizeFeedbackRoute,
	sanitizeFeedbackSource,
} from './source';
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

	it('drops a query string and fragment — only the pathname is ever stored', () => {
		expect(sanitizeFeedbackSource('/account/settings?token=abc#x')).toBe('/account/settings');
		expect(sanitizeFeedbackSource('/search?q=private')).toBe('/search');
	});

	it('caps overlong values at 512 characters', () => {
		const long = `/${'a'.repeat(600)}`;
		expect(sanitizeFeedbackSource(long)).toHaveLength(512);
		expect(sanitizeFeedbackSource(long)).toBe(long.slice(0, 512));
	});
});

describe('isFeedbackBandPath', () => {
	it('matches the showcases, workflows and docs hubs and their leaves', () => {
		expect(isFeedbackBandPath('/showcases')).toBe(true);
		expect(isFeedbackBandPath('/showcases/ui/tokens')).toBe(true);
		expect(isFeedbackBandPath('/workflows')).toBe(true);
		expect(isFeedbackBandPath('/workflows/excel-with-ai')).toBe(true);
		expect(isFeedbackBandPath('/docs')).toBe(true);
		expect(isFeedbackBandPath('/docs/stack/viz')).toBe(true);
	});

	it('rejects everything else, including prefix look-alikes', () => {
		expect(isFeedbackBandPath('/')).toBe(false);
		expect(isFeedbackBandPath('/feedback')).toBe(false);
		expect(isFeedbackBandPath('/blog')).toBe(false);
		expect(isFeedbackBandPath('/showcasesfoo')).toBe(false);
		expect(isFeedbackBandPath('/docsish')).toBe(false);
		expect(isFeedbackBandPath('/workflowsish')).toBe(false);
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

describe('feedback route patterns', () => {
	it('strips the locale segment and layout groups from a route id', () => {
		expect(feedbackRouteFromRouteId('/[[locale=locale]]/(public)/blog/[slug]')).toBe('/blog/[slug]');
		expect(feedbackRouteFromRouteId('/[[locale=locale]]/(public)')).toBe('/');
		expect(feedbackRouteFromRouteId(null)).toBe('');
	});

	it('accepts a plain pattern and degrades anything else to no-area', () => {
		expect(sanitizeFeedbackRoute('/blog/[slug]')).toBe('/blog/[slug]');
		expect(sanitizeFeedbackRoute('/blog/my-post?x=1')).toBe('');
		expect(sanitizeFeedbackRoute('//evil.com')).toBe('');
		expect(sanitizeFeedbackRoute('https://evil.com')).toBe('');
		expect(sanitizeFeedbackRoute(`/${'a'.repeat(250)}`)).toBe('');
	});

	it('keeps an error id only in its shape', () => {
		expect(sanitizeFeedbackErrorId('a1b2-c3_d4')).toBe('a1b2-c3_d4');
		expect(sanitizeFeedbackErrorId('<script>')).toBe('');
		expect(sanitizeFeedbackErrorId('x'.repeat(65))).toBe('');
	});

	it('builds the form link with path, area and error id', () => {
		expect(feedbackFormHref('/blog/x', '/[[locale=locale]]/(public)/blog/[slug]', 'e1')).toBe(
			'/feedback?from=%2Fblog%2Fx&route=%2Fblog%2F%5Bslug%5D&err=e1',
		);
		expect(feedbackFormHref('/docs', null)).toBe('/feedback?from=%2Fdocs');
	});
});

describe('feedbackSubmissionSchema technical context', () => {
	it('defaults to no context and the general category', () => {
		const parsed = v.parse(feedbackSubmissionSchema, validBase);
		expect(parsed.includeContext).toBe(false);
		expect(parsed.category).toBe('general');
		expect(parsed.routeId).toBe('');
		expect(parsed.errorId).toBe('');
	});

	it('degrades crafted hidden fields instead of rejecting the submission', () => {
		const parsed = v.parse(feedbackSubmissionSchema, {
			...validBase,
			includeContext: true,
			routeId: '/x?token=1',
			errorId: '"><img>',
		});
		expect(parsed).toMatchObject({ includeContext: true, routeId: '', errorId: '' });
	});

	it('rejects an unknown category', () => {
		expect(v.safeParse(feedbackSubmissionSchema, { ...validBase, category: 'urgent' }).success).toBe(false);
	});
});

describe('feedbackSubmissionSchema as the form posts it', () => {
	// The form always posts its hidden rating input, '' when unrated. A union-typed rating made
	// superforms throw on FormData, so every submission ended in a 500.
	async function post(fields: Record<string, string>) {
		const data = new FormData();
		const base = { subject: 'A subject', body: 'A body long enough', nonce: crypto.randomUUID(), renderedAt: '1' };
		for (const [key, value] of Object.entries({ ...base, ...fields })) data.set(key, value);
		return superValidate(data, valibot(feedbackSubmissionSchema));
	}

	it('parses an unrated, a rated and an out-of-range rating without throwing', async () => {
		expect((await post({ rating: '' })).data.rating).toBeNull();
		expect((await post({ rating: '4' })).data.rating).toBe(4);
		expect((await post({ rating: '9' })).valid).toBe(false);
	});

	it('reads the context checkbox and the category from FormData', async () => {
		const form = await post({ rating: '', includeContext: 'on', category: 'bug' });
		expect(form.valid).toBe(true);
		expect(form.data).toMatchObject({ includeContext: true, category: 'bug' });
		expect((await post({ rating: '' })).data).toMatchObject({ includeContext: false, category: 'general' });
	});
});
