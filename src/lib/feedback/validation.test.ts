import * as v from 'valibot';
import { describe, expect, it } from 'vitest';
import { feedbackSubmissionSchema } from './validation';

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
