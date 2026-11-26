/**
 * Check a parsed parametric model before any geometry exists: resolve every expression to a
 * number, check every reference points at an earlier operation, every value is in range, the
 * graph is shallow enough, and estimate what each operation will cost. A model that fails here
 * costs one pass over its JSON — the kernel never sees it.
 *
 * The estimate is exact for primitives and profile solids (the kernel's own tessellation
 * formulas, measured against manifold-3d 3.5.5) and a stated heuristic for operations whose
 * output size depends on the geometry (Booleans, hull, blend). That is why the evaluator also
 * checks the real triangle count after every operation: the estimate refuses the obviously
 * oversized model for free, the running count stops the rest.
 */
import {
	type FeatureOperation,
	type FeatureOperationKind,
	MODELING_LIMITS,
	type ParametricModel,
} from '#lib/schemas/parametric-model.ts';
import { type AssetDiagnostic, assetDiagnostic } from '../diagnostics.ts';
import { compileExpression, ExpressionError } from './expression.ts';

const L = MODELING_LIMITS;

/** Operation fields that are names or enums, never numbers. `z` is a heightfield's own expression. */
const LITERAL_KEYS = new Set(['id', 'op', 'of', 'from', 'remove', 'material', 'shape', 'kind', 'axis', 'z']);

/** `T` with every numeric value (`number | string`) resolved to a number. */
type Resolved<T> = [T] extends [string | number | boolean | undefined]
	? [Exclude<T, undefined>] extends [string] | [boolean]
		? T
		: number | Extract<T, undefined>
	: T extends readonly unknown[]
		? { [K in keyof T]: Resolved<T[K]> }
		: T extends object
			? { [K in keyof T]: Resolved<T[K]> }
			: T extends string
				? number
				: T;

/** An operation with numbers only (the heightfield `z` stays its source text). */
export type ResolvedOperation = Resolved<FeatureOperation>;

export interface ResolvedModel {
	units: ParametricModel['units'];
	parameters: Record<string, number>;
	operations: ResolvedOperation[];
	outputs: string[];
	/** Estimated triangles per operation id. */
	estimate: Record<string, number>;
	/** Estimated triangles summed over the outputs. */
	estimatedTriangles: number;
	/** Estimated triangles summed over every operation: the work the kernel does. */
	estimatedWork: number;
}

/** Ids an operation reads, in order. */
export function operandsOf(operation: { op: FeatureOperationKind } & Record<string, unknown>): string[] {
	const ids: string[] = [];
	if (typeof operation.from === 'string') ids.push(operation.from);
	if (typeof operation.of === 'string') ids.push(operation.of);
	if (Array.isArray(operation.of)) ids.push(...(operation.of as string[]));
	if (Array.isArray(operation.remove)) ids.push(...(operation.remove as string[]));
	return ids;
}

const sphereTriangles = (segments: number) => {
	const n = Math.max(8, Math.ceil(segments / 4) * 4);
	return (n * n) / 2;
};

const DEFAULT_SEGMENTS = 32;

/** Triangles an extruded or revolved outline has, from its vertex count. */
function profileVertices(profile: ResolvedOperation & { profile?: unknown }): number {
	const p = (profile as { profile: { shape: string; segments?: number; round?: number; points?: unknown[] } }).profile;
	if (p.shape === 'polygon') return (p.points as unknown[]).length;
	if (p.shape === 'circle') return p.segments ?? DEFAULT_SEGMENTS;
	return p.round && p.round > 0 ? 4 + 4 * 8 : 4;
}

function estimateOperation(operation: ResolvedOperation, known: Record<string, number>): number {
	const sum = (ids: string[]) => ids.reduce((total, ref) => total + (known[ref] ?? 0), 0);
	switch (operation.op) {
		case 'box':
			return 12;
		case 'sphere':
			return sphereTriangles(operation.segments ?? DEFAULT_SEGMENTS);
		case 'cylinder': {
			const n = operation.segments ?? DEFAULT_SEGMENTS;
			return operation.r2 === 0 ? 2 * n - 2 : 4 * n - 4;
		}
		case 'torus':
			return 2 * (operation.segments ?? DEFAULT_SEGMENTS) * (operation.sides ?? 16);
		case 'extrude': {
			const p = profileVertices(operation);
			return 2 * p * ((operation.divisions ?? 0) + 1) + 2 * (p - 2);
		}
		case 'revolve': {
			const p = profileVertices(operation);
			return 2 * p * (operation.segments ?? DEFAULT_SEGMENTS) + 4 * (p - 2);
		}
		case 'union':
		case 'intersect':
		case 'hull':
			return Math.ceil(sum(operation.of) * 1.5);
		case 'subtract':
			return Math.ceil(sum([operation.from, ...operation.remove]) * 1.5);
		case 'transform':
			return known[operation.of] ?? 0;
		case 'mirror':
			return (known[operation.of] ?? 0) * (operation.keep === false ? 1 : 2);
		case 'pattern.linear':
		case 'pattern.radial':
			return (known[operation.of] ?? 0) * operation.count;
		case 'heightfield': {
			const r = operation.resolution ?? 32;
			return 12 * r * r;
		}
		case 'blend': {
			const r = operation.resolution ?? 48;
			return 16 * r * r;
		}
		case 'smooth':
			return (known[operation.of] ?? 0) * operation.refine * operation.refine;
		case 'deform':
			return (known[operation.of] ?? 0) * (operation.refine ?? 1) ** 2;
	}
}

/** Value rules the schema cannot state: positive lengths, sane ratios, non-zero normals. */
function checkValues(op: ResolvedOperation, path: string, add: (subject: string, message: string) => void) {
	const positive = (value: number | undefined, field: string) => {
		if (value !== undefined && !(value > 0)) add(`${path}.${field}`, `${field} must be greater than 0 (got ${value}).`);
	};
	const checkProfile = (profile: Resolved<Extract<FeatureOperation, { op: 'extrude' }>['profile']>) => {
		if (profile.shape === 'rect') {
			positive(profile.size[0], 'profile.size[0]');
			positive(profile.size[1], 'profile.size[1]');
			if (profile.round !== undefined && (profile.round < 0 || profile.round * 2 >= Math.min(...profile.size))) {
				add(`${path}.profile.round`, 'round must be at least 0 and less than half the shorter side.');
			}
		} else if (profile.shape === 'circle') positive(profile.r, 'profile.r');
	};
	switch (op.op) {
		case 'box':
			for (const [i, s] of op.size.entries()) positive(s, `size[${i}]`);
			break;
		case 'sphere':
			positive(op.r, 'r');
			break;
		case 'cylinder':
			positive(op.r, 'r');
			positive(op.h, 'h');
			if (op.r2 !== undefined && op.r2 < 0) add(`${path}.r2`, 'r2 must be 0 (a cone) or more.');
			break;
		case 'torus':
			positive(op.r, 'r');
			positive(op.R, 'R');
			if (op.r >= op.R) add(`${path}.r`, 'the tube radius r must be smaller than R.');
			break;
		case 'extrude':
			positive(op.h, 'h');
			checkProfile(op.profile);
			if (op.scaleTop !== undefined && op.scaleTop < 0) add(`${path}.scaleTop`, 'scaleTop must be 0 or more.');
			break;
		case 'revolve':
			checkProfile(op.profile);
			if (op.angle !== undefined && !(op.angle > 0 && op.angle <= 360))
				add(`${path}.angle`, 'angle must be in (0, 360].');
			break;
		case 'mirror':
			if (op.normal.every((c) => c === 0)) add(`${path}.normal`, 'the mirror normal cannot be zero.');
			break;
		case 'heightfield':
			positive(op.size[0], 'size[0]');
			positive(op.size[1], 'size[1]');
			positive(op.base, 'base');
			break;
		case 'blend':
			positive(op.k, 'k');
			for (const [i, sphere] of op.spheres.entries()) positive(sphere[3], `spheres[${i}][3]`);
			break;
		case 'pattern.linear':
		case 'pattern.radial':
			if (!Number.isInteger(op.count) || op.count < 1 || op.count > L.maxPatternCount) {
				add(`${path}.count`, `count must be a whole number from 1 to ${L.maxPatternCount} (got ${op.count}).`);
			}
			if (op.op === 'pattern.radial' && op.angle !== undefined && !(op.angle > 0 && op.angle <= 360))
				add(`${path}.angle`, 'angle must be in (0, 360].');
			break;
	}
	if (op.scale !== undefined) {
		const factors = typeof op.scale === 'number' ? [op.scale] : op.scale;
		if (factors.some((f) => f === 0)) add(`${path}.scale`, 'a scale factor cannot be 0.');
	}
}

/**
 * Resolve and check `model`. Returns the resolved model when no error was found; the
 * diagnostics always (they may hold warnings on success).
 */
export function resolveModel(model: ParametricModel): { resolved?: ResolvedModel; diagnostics: AssetDiagnostic[] } {
	const diagnostics: AssetDiagnostic[] = [];
	const parameters = { ...(model.parameters ?? {}) };
	for (const [name, value] of Object.entries(parameters)) {
		if (Math.abs(value) > L.maxMagnitude) {
			diagnostics.push(
				assetDiagnostic('model.invalid-value', `parameters.${name}`, `|value| exceeds ${L.maxMagnitude}.`),
			);
		}
	}

	const resolveValue = (value: unknown, path: string, key?: string): unknown => {
		if (key !== undefined && LITERAL_KEYS.has(key)) return value;
		if (typeof value === 'string') {
			try {
				const result = compileExpression(value, parameters)();
				if (!Number.isFinite(result)) throw new ExpressionError('the result is not a finite number');
				if (Math.abs(result) > L.maxMagnitude) throw new ExpressionError(`|result| exceeds ${L.maxMagnitude}`);
				return result;
			} catch (error) {
				const reason = error instanceof ExpressionError ? error.message : 'cannot be evaluated';
				diagnostics.push(assetDiagnostic('model.invalid-expression', path, `"${value}": ${reason}.`));
				return 0;
			}
		}
		if (typeof value === 'number') {
			if (Math.abs(value) > L.maxMagnitude) {
				diagnostics.push(assetDiagnostic('model.invalid-value', path, `|value| exceeds ${L.maxMagnitude}.`));
			}
			return value;
		}
		if (Array.isArray(value)) return value.map((item, i) => resolveValue(item, `${path}[${i}]`));
		if (value !== null && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).map(([inner, item]) => [inner, resolveValue(item, `${path}.${inner}`, inner)]),
			);
		}
		return value;
	};

	const seen = new Map<string, number>();
	const depth: Record<string, number> = {};
	const estimate: Record<string, number> = {};
	const operations: ResolvedOperation[] = [];
	let patternInstances = 0;

	model.operations.forEach((operation, index) => {
		const path = `operations[${index}]`;
		if (seen.has(operation.id)) {
			diagnostics.push(assetDiagnostic('model.unknown-reference', `${path}.id`, `id "${operation.id}" is used twice.`));
		}
		const refs = operandsOf(operation as never);
		for (const ref of refs) {
			if (!seen.has(ref)) {
				diagnostics.push(
					assetDiagnostic(
						'model.unknown-reference',
						path,
						`"${ref}" is not an earlier operation id (an operation can only use ids listed before it).`,
					),
				);
			}
		}
		if (operation.op === 'heightfield') {
			try {
				compileExpression(operation.z, parameters, ['x', 'y']);
			} catch (error) {
				const reason = error instanceof ExpressionError ? error.message : 'cannot be parsed';
				diagnostics.push(assetDiagnostic('model.invalid-expression', `${path}.z`, `"${operation.z}": ${reason}.`));
			}
		}
		const before = diagnostics.length;
		const resolved = resolveValue(operation, path) as ResolvedOperation;
		// A value that failed to resolve stands in as 0; its range check would only repeat the finding.
		if (diagnostics.length === before) {
			checkValues(resolved, path, (subject, message) =>
				diagnostics.push(assetDiagnostic('model.invalid-value', subject, message)),
			);
		}
		if (resolved.op === 'pattern.linear' || resolved.op === 'pattern.radial') patternInstances += resolved.count;
		depth[operation.id] = 1 + Math.max(0, ...refs.map((ref) => depth[ref] ?? 0));
		estimate[operation.id] = estimateOperation(resolved, estimate);
		seen.set(operation.id, index);
		operations.push(resolved);
	});

	const outputs = typeof model.output === 'string' ? [model.output] : [...model.output];
	for (const output of outputs) {
		if (!seen.has(output)) {
			diagnostics.push(
				assetDiagnostic('model.unknown-reference', 'output', `output "${output}" is not an operation id.`),
			);
		}
	}
	if (new Set(outputs).size !== outputs.length) {
		diagnostics.push(assetDiagnostic('model.unknown-reference', 'output', 'an output id is listed twice.'));
	}
	const deepest = Math.max(0, ...Object.values(depth));
	if (deepest > L.maxGraphDepth) {
		diagnostics.push(
			assetDiagnostic('model.limit', 'operations', `the graph is ${deepest} deep; at most ${L.maxGraphDepth}.`),
		);
	}
	if (patternInstances > L.maxPatternInstances) {
		diagnostics.push(
			assetDiagnostic(
				'model.limit',
				'operations',
				`patterns make ${patternInstances} copies; at most ${L.maxPatternInstances}.`,
			),
		);
	}

	if (diagnostics.some((d) => d.severity === 'error')) return { diagnostics };
	const estimatedTriangles = outputs.reduce((total, output) => total + (estimate[output] ?? 0), 0);
	const estimatedWork = Object.values(estimate).reduce((total, count) => total + count, 0);
	return {
		resolved: { units: model.units, parameters, operations, outputs, estimate, estimatedTriangles, estimatedWork },
		diagnostics,
	};
}
