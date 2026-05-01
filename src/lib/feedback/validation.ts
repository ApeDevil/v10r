import * as v from 'valibot';

export const feedbackSubmissionSchema = v.object({
	subject: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(3, 'At least 3 characters'),
		v.maxLength(120, 'Max 120 characters'),
	),
	body: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(10, 'At least 10 characters'),
		v.maxLength(4000, 'Max 4000 characters'),
	),
	rating: v.nullish(
		v.pipe(
			v.union([v.string(), v.number()]),
			v.transform((value) => (value === '' || value == null ? null : Number(value))),
			v.union([v.null(), v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5))]),
		),
	),
	contactEmail: v.nullish(
		v.pipe(
			v.string(),
			v.trim(),
			v.transform((value) => (value === '' ? null : value)),
			v.union([v.null(), v.pipe(v.string(), v.email('Enter a valid email or leave blank'))]),
		),
	),
	pageOfOrigin: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(512)), '/'),
	nonce: v.pipe(v.string(), v.uuid('Invalid form token')),
	renderedAt: v.pipe(
		v.union([v.string(), v.number()]),
		v.transform((value) => Number(value)),
		v.number(),
		v.integer(),
		v.minValue(0),
	),
	/** Honeypot — must remain empty. Bots fill all visible fields. */
	website: v.optional(v.literal(''), ''),
});

export type FeedbackSubmissionInput = v.InferInput<typeof feedbackSubmissionSchema>;
export type FeedbackSubmissionOutput = v.InferOutput<typeof feedbackSubmissionSchema>;
