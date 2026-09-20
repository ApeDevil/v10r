/**
 * The name-check query contract, shared by the showcase form and the JSON route.
 *
 * Lives in `$lib/schemas/` rather than `schemas/showcase/`: the JSON route is a product
 * surface (agents call it), and the same object is what `checkName()` accepts, so a
 * `showcase/` path would misreport a real contract as demo data.
 */
import * as v from 'valibot';

/** Where the user intends to use the name. Selects which sources are in scope. */
export const NAME_CHECK_TERRITORIES = ['de', 'eu', 'worldwide'] as const;
export type NameCheckTerritory = (typeof NAME_CHECK_TERRITORIES)[number];

/** Coarse product category; mapped to Nice classes for trademark relevance. */
export const NAME_CHECK_CATEGORIES = ['software', 'entertainment', 'publishing', 'other'] as const;
export type NameCheckCategory = (typeof NAME_CHECK_CATEGORIES)[number];

export const NAME_CHECK_QUERY_MIN_LENGTH = 2;
export const NAME_CHECK_QUERY_MAX_LENGTH = 80;

/** A `<Select>` submits `''` for "no category"; the JSON route may omit it or send null. */
const categoryField = v.nullish(
	v.pipe(
		v.string(),
		v.transform((value) => (value === '' ? null : value)),
		v.union([v.null(), v.picklist(NAME_CHECK_CATEGORIES)]),
	),
);

export const nameCheckQuerySchema = v.object({
	query: v.pipe(
		v.string(),
		v.trim(),
		v.minLength(NAME_CHECK_QUERY_MIN_LENGTH, 'At least 2 characters'),
		v.maxLength(NAME_CHECK_QUERY_MAX_LENGTH, 'Max 80 characters'),
		v.regex(/[\p{L}\p{N}]/u, 'Needs at least one letter or digit'),
	),
	territory: v.optional(v.picklist(NAME_CHECK_TERRITORIES), 'worldwide'),
	category: categoryField,
});

export type NameCheckQueryOutput = v.InferOutput<typeof nameCheckQuerySchema>;

/** The form variant adds the honeypot trio the feedback form established. */
export const nameCheckFormSchema = v.object({
	...nameCheckQuerySchema.entries,
	nonce: v.pipe(v.string(), v.uuid('Invalid form token')),
	renderedAt: v.pipe(v.number(), v.integer(), v.minValue(0)),
	/** Honeypot — must remain empty. Bots fill all visible fields. */
	bookmark: v.optional(v.literal(''), ''),
});
