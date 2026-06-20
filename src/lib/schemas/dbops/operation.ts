import * as v from 'valibot';

/**
 * Client-safe schema for starting a dbops operation. v1 has a single kind
 * (reset dev branch from parent); the field exists so the contract is
 * extensible and so Superforms has a schema to validate.
 */
export const startOperationSchema = v.object({
	kind: v.optional(v.picklist(['reset_from_parent']), 'reset_from_parent'),
});

export type StartOperationForm = v.InferOutput<typeof startOperationSchema>;
