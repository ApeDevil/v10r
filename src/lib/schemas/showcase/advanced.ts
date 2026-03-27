import * as v from 'valibot';

export const confirmSchema = v.object({
	confirmation: v.pipe(
		v.string(),
		v.nonEmpty('Type DELETE to confirm'),
		v.check((val) => val === 'DELETE', 'You must type DELETE exactly'),
	),
});

export type ConfirmInput = v.InferInput<typeof confirmSchema>;
export type ConfirmOutput = v.InferOutput<typeof confirmSchema>;

export const feedbackSchema = v.object({
	rating: v.pipe(v.number(), v.integer(), v.minValue(1, 'Please select a rating'), v.maxValue(5, 'Max rating is 5')),
	comment: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Please leave a comment'),
		v.minLength(10, 'At least 10 characters'),
		v.maxLength(500, 'Max 500 characters'),
	),
	recommend: v.optional(v.boolean(), false),
});

export type FeedbackInput = v.InferInput<typeof feedbackSchema>;
export type FeedbackOutput = v.InferOutput<typeof feedbackSchema>;

export const profileEditSchema = v.object({
	name: v.pipe(v.string(), v.trim(), v.nonEmpty('Name is required'), v.maxLength(100)),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Email is required'),
		v.toLowerCase(),
		v.email('Invalid email address'),
	),
	role: v.picklist(['viewer', 'editor', 'admin', 'owner'], 'Select a role'),
	bio: v.optional(v.pipe(v.string(), v.maxLength(300, 'Max 300 characters')), ''),
	active: v.optional(v.boolean(), true),
});

export type ProfileEditInput = v.InferInput<typeof profileEditSchema>;
export type ProfileEditOutput = v.InferOutput<typeof profileEditSchema>;
