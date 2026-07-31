import * as v from 'valibot';
import { sanitizeFeedbackSource } from './source';

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
	/** Sanitized, never rejected — a crafted value degrades to '' (no source).
	 * Wrapped so the transform's parameter is exactly `string` (the pipe's
	 * output type); passing the wider-typed function directly fails to infer. */
	pageOfOrigin: v.optional(
		v.pipe(
			v.string(),
			v.transform((value: string) => sanitizeFeedbackSource(value)),
		),
		'',
	),
	nonce: v.pipe(v.string(), v.uuid('Invalid form token')),
	renderedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
	/** Honeypot — must remain empty. Bots fill all visible fields. */
	bookmark: v.optional(v.literal(''), ''),
});

export type FeedbackSubmissionInput = v.InferInput<typeof feedbackSubmissionSchema>;
export type FeedbackSubmissionOutput = v.InferOutput<typeof feedbackSubmissionSchema>;
