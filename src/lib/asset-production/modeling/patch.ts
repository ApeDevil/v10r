/**
 * Apply a `ModelPatch` to an explicitly supplied model. Pure and stateless: the server keeps no
 * model to patch, so the caller always sends the model it means. The result is untrusted until
 * it passes the model schema again — a patch can produce an invalid model (a removed operation
 * still referenced), and that is reported like any other invalid model.
 */
import type { ModelPatch, ParametricModel } from '#lib/schemas/parametric-model.ts';

export type PatchFailure = { ok: false; message: string };

export function applyModelPatch(
	model: ParametricModel,
	patch: ModelPatch,
): { ok: true; value: unknown } | PatchFailure {
	const next: Record<string, unknown> = structuredClone(model) as unknown as Record<string, unknown>;
	if (patch.name !== undefined) next.name = patch.name;
	if (patch.parameters) {
		const known = (model.parameters ?? {}) as Record<string, number>;
		const unknown = Object.keys(patch.parameters).filter((name) => !Object.hasOwn(known, name));
		if (unknown.length > 0) {
			return {
				ok: false,
				message: `patch.parameters names parameters the model does not have: ${unknown.join(', ')}. Add them to the model instead.`,
			};
		}
		next.parameters = { ...known, ...patch.parameters };
	}
	let operations = [...model.operations] as Record<string, unknown>[];
	for (const [id, fields] of Object.entries(patch.operations ?? {})) {
		const index = operations.findIndex((operation) => operation.id === id);
		if (index === -1) return { ok: false, message: `patch.operations.${id}: no operation has that id.` };
		if ('id' in fields || 'op' in fields) {
			return {
				ok: false,
				message: `patch.operations.${id}: id and op cannot change; remove the operation and add a new one.`,
			};
		}
		operations[index] = { ...operations[index], ...fields };
	}
	if (patch.remove?.length) {
		const missing = patch.remove.filter((id) => !operations.some((operation) => operation.id === id));
		if (missing.length > 0)
			return { ok: false, message: `patch.remove: no operation has the id ${missing.join(', ')}.` };
		operations = operations.filter((operation) => !patch.remove?.includes(operation.id as string));
	}
	if (patch.add?.length) operations = [...operations, ...(patch.add as Record<string, unknown>[])];
	next.operations = operations;
	if (patch.output !== undefined) next.output = patch.output;
	return { ok: true, value: next };
}
