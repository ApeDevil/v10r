import * as v from 'valibot';

export const wizardStep1Schema = v.object({
	firstName: v.pipe(v.string(), v.trim(), v.nonEmpty('First name is required'), v.maxLength(50)),
	lastName: v.pipe(v.string(), v.trim(), v.nonEmpty('Last name is required'), v.maxLength(50)),
	email: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('Email is required'),
		v.toLowerCase(),
		v.email('Invalid email address'),
	),
});

export const wizardStep2Schema = v.object({
	street: v.pipe(v.string(), v.trim(), v.nonEmpty('Street is required'), v.maxLength(200)),
	city: v.pipe(v.string(), v.trim(), v.nonEmpty('City is required'), v.maxLength(100)),
	state: v.picklist(['CA', 'NY', 'TX', 'FL', 'IL'], 'Select a state'),
	zip: v.pipe(
		v.string(),
		v.trim(),
		v.nonEmpty('ZIP code is required'),
		v.regex(/^\d{5}(-\d{4})?$/, 'Invalid ZIP code (e.g. 12345 or 12345-6789)'),
	),
});

export const wizardStep3Schema = v.object({
	plan: v.picklist(['free', 'pro', 'enterprise'], 'Select a plan'),
	terms: v.pipe(
		v.boolean(),
		v.check((val) => val === true, 'You must accept the terms'),
	),
});

export const wizardSchema = v.object({
	...wizardStep1Schema.entries,
	...wizardStep2Schema.entries,
	...wizardStep3Schema.entries,
});

export type WizardInput = v.InferInput<typeof wizardSchema>;
export type WizardOutput = v.InferOutput<typeof wizardSchema>;

export const dynamicSchema = v.object({
	title: v.pipe(v.string(), v.trim(), v.nonEmpty('Title is required'), v.maxLength(100)),
	tags: v.pipe(
		v.array(v.pipe(v.string(), v.trim(), v.nonEmpty('Tag cannot be empty'), v.maxLength(30))),
		v.minLength(1, 'At least one tag is required'),
		v.maxLength(10, 'Max 10 tags'),
	),
});

export type DynamicInput = v.InferInput<typeof dynamicSchema>;
export type DynamicOutput = v.InferOutput<typeof dynamicSchema>;

export const dependentSchema = v.object({
	country: v.picklist(['US', 'DE', 'JP'], 'Select a country'),
	state: v.pipe(v.string(), v.nonEmpty('Select a state')),
	city: v.pipe(v.string(), v.nonEmpty('Select a city')),
});

export type DependentInput = v.InferInput<typeof dependentSchema>;
export type DependentOutput = v.InferOutput<typeof dependentSchema>;
