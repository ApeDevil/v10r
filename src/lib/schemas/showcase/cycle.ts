import * as v from 'valibot';

export const cycleSchema = v.object({
	label: v.pipe(v.string(), v.trim(), v.nonEmpty('Label is required'), v.maxLength(100)),
	description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(500)), ''),
	simulateError: v.optional(v.picklist(['validation', 'domain', 'db'])),
});

export type CycleInput = v.InferInput<typeof cycleSchema>;
export type CycleOutput = v.InferOutput<typeof cycleSchema>;
