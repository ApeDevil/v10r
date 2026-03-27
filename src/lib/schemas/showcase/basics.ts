import * as v from 'valibot';

export const contactSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('Name is required'), v.maxLength(100, 'Max 100 characters')),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Email is required'),
		v.toLowerCase(),
		v.email('Invalid email address'),
	),
	subject: v.pipe(v.string(), v.trim(), v.nonEmpty('Subject is required'), v.maxLength(200, 'Max 200 characters')),
	message: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Message is required'),
		v.minLength(10, 'At least 10 characters'),
		v.maxLength(2000, 'Max 2000 characters'),
	),
});

export type ContactInput = v.InferInput<typeof contactSchema>;
export type ContactOutput = v.InferOutput<typeof contactSchema>;

export const settingsSchema = v.object({
	displayName: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Display name is required'),
		v.maxLength(50, 'Max 50 characters'),
	),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Email is required'),
		v.toLowerCase(),
		v.email('Invalid email address'),
	),
	website: v.optional(
		v.pipe(
			v.string(),
			v.trim(),
			v.check((url) => url === '' || /^https?:\/\/.+/.test(url), 'Must start with http:// or https://'),
		),
		'',
	),
	timezone: v.picklist(['utc', 'est', 'cst', 'pst', 'cet'], 'Select a timezone'),
	language: v.picklist(['en', 'es', 'fr', 'de', 'ja'], 'Select a language'),
	emailNotifications: v.optional(v.boolean(), false),
	marketingEmails: v.optional(v.boolean(), false),
	publicProfile: v.optional(v.boolean(), true),
});

export type SettingsInput = v.InferInput<typeof settingsSchema>;
export type SettingsOutput = v.InferOutput<typeof settingsSchema>;
