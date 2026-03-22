import * as v from 'valibot';

export const flagCreateSchema = v.object({
	key: v.pipe(
		v.string('Key is required'),
		v.minLength(1, 'Key is required'),
		v.maxLength(100, 'Key must be 100 characters or fewer'),
		v.regex(/^[a-z][a-z0-9._]*$/, 'Key must be lowercase with dots/underscores (e.g., feature.dark_mode)'),
	),
	description: v.optional(v.pipe(v.string(), v.maxLength(500, 'Description must be 500 characters or fewer'))),
	enabled: v.optional(v.boolean(), false),
});
