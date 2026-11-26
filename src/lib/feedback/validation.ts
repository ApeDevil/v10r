import * as v from 'valibot';
import { FEEDBACK_CATEGORIES } from './category';
import { sanitizeFeedbackErrorId, sanitizeFeedbackRoute, sanitizeFeedbackSource } from './source';

/** A hidden technical field: sanitized, never rejected — a crafted value degrades to ''. */
const degradingText = (sanitize: (value: string) => string) =>
	v.optional(
		v.pipe(
			v.string(),
			v.transform((value: string) => sanitize(value)),
		),
		'',
	);

export const feedbackSubmissionSchema = v.object({
	category: v.optional(v.picklist(FEEDBACK_CATEGORIES, 'Choose a category'), 'general'),
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
	// One plain type: superforms parses FormData per field and refuses unions, so the empty
	// "no rating" option ('') arrives as null through its nullable-number coercion.
	rating: v.nullish(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(5))),
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
	/** The submitter's explicit yes to attaching `routeId`, `errorId`, the app version and the
	 * analytics-journey link. Unticked, none of them is stored. */
	includeContext: v.optional(v.boolean(), false),
	routeId: degradingText(sanitizeFeedbackRoute),
	errorId: degradingText(sanitizeFeedbackErrorId),
	nonce: v.pipe(v.string(), v.uuid('Invalid form token')),
	renderedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
	/** Honeypot — must remain empty. Bots fill all visible fields. */
	bookmark: v.optional(v.literal(''), ''),
});
