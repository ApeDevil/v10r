/** Shared Valibot schema fragments reused across domain modules. */
import * as v from 'valibot';

export const UuidParam = v.pipe(v.string(), v.uuid());

export const SlugParam = v.pipe(
	v.string(),
	v.minLength(1),
	v.maxLength(200),
	v.regex(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/),
);

export const Markdown = v.pipe(v.string(), v.minLength(1));

export const LocaleParam = v.optional(v.pipe(v.string(), v.minLength(2), v.maxLength(10)), 'en');
