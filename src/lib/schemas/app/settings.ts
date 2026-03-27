import * as v from 'valibot';

export const userSettingsSchema = v.object({
	displayName: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Display name is required'),
		v.maxLength(50, 'Max 50 characters'),
	),
	theme: v.picklist(['light', 'dark', 'system'], 'Select a theme'),
	displayDensity: v.picklist(['compact', 'comfortable', 'spacious'], 'Select a density'),
	locale: v.picklist(['en', 'es', 'fr', 'de', 'ja'], 'Select a language'),
	timezone: v.pipe(v.string(), v.trim(), v.nonEmpty('Timezone is required')),
	dateFormat: v.picklist(['relative', 'absolute', 'iso'], 'Select a date format'),
	sidebarWidth: v.optional(
		v.pipe(
			v.union([v.string(), v.number()]),
			v.transform(Number),
			v.integer(),
			v.minValue(160),
			v.maxValue(320),
		),
		240,
	),
	reduceMotion: v.optional(v.boolean(), false),
	highContrast: v.optional(v.boolean(), false),
});

export type UserSettingsInput = v.InferInput<typeof userSettingsSchema>;
export type UserSettingsOutput = v.InferOutput<typeof userSettingsSchema>;
