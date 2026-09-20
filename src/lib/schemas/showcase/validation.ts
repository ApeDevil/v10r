import * as v from 'valibot';

export const realtimeSchema = v.pipe(
	v.object({
		username: v.pipe(
			v.string(),
			v.nonEmpty('Required'),
			v.minLength(3, 'At least 3 characters'),
			v.maxLength(20, 'Max 20 characters'),
			v.regex(/^[a-z0-9_-]+$/, 'Lowercase letters, numbers, hyphens, underscores only'),
		),
		password: v.pipe(
			v.string(),
			v.nonEmpty('Required'),
			v.minLength(8, 'At least 8 characters'),
			v.regex(/[A-Z]/, 'Need at least one uppercase letter'),
			v.regex(/[0-9]/, 'Need at least one number'),
			v.regex(/[^A-Za-z0-9]/, 'Need at least one special character'),
		),
		confirmPassword: v.pipe(v.string(), v.nonEmpty('Please confirm your password')),
	}),
	v.forward(
		v.partialCheck(
			[['password'], ['confirmPassword']],
			(d) => d.password === d.confirmPassword,
			'Passwords do not match',
		),
		['confirmPassword'],
	),
);

export const asyncSchema = v.object({
	username: v.pipe(
		v.string(),
		v.nonEmpty('Required'),
		v.minLength(3, 'At least 3 characters'),
		v.maxLength(20, 'Max 20 characters'),
		v.regex(/^[a-z0-9_-]+$/, 'Lowercase letters, numbers, hyphens, underscores only'),
	),
	email: v.pipe(v.string(), v.trim(), v.nonEmpty('Required'), v.toLowerCase(), v.email('Invalid email address')),
});

export const serverSchema = v.object({
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Email is required'),
		v.toLowerCase(),
		v.email('Invalid email address'),
	),
	inviteCode: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Invite code is required'),
		v.minLength(4, 'At least 4 characters'),
	),
});
