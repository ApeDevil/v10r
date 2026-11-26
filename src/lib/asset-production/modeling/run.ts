/**
 * One parametric model through the asset production engine, as every surface runs it — the MCP
 * 3D tools, the export route, the model viewer's Web Worker and the tests. It parses the model
 * (so findings name paths inside the model, not inside the asset request around it), runs the
 * engine, and condenses the run into a `ParametricModelSummary`: the compact, model-facing facts. Raw
 * vertex data never appears in a summary.
 */
import * as v from 'valibot';
import { ASSET_REQUEST_FORMAT } from '#lib/schemas/asset-production.ts';
import { type ParametricModel, parametricModelSchema } from '#lib/schemas/parametric-model.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { type AssetDiagnostic, assetDiagnostic } from '../diagnostics.ts';
import { type AssetBudget, type EngineRun, proceduralEngine } from '../engine.ts';
import { parametricModelGenerator } from '../generators/parametric-model.ts';
import { MODELING_KERNEL } from './kernel.ts';
import { tryEncodeModelLink } from './model-link.ts';

type Vec3 = [number, number, number];

export interface ModelComponentSummary {
	name: string;
	material: string;
	triangles: number;
	vertices: number;
	/** Extent along X, Y, Z in model units (Z up). */
	size: Vec3;
	closedManifold: boolean;
	genus: number;
	volume: number;
	surfaceArea: number;
}

export interface ParametricModelSummary {
	/** sha256 of the canonical model JSON: the model's identity on every surface. */
	digest: string;
	name?: string;
	units: ParametricModel['units'];
	parameters: Record<string, number>;
	components: ModelComponentSummary[];
	bounds: { min: Vec3; max: Vec3 };
	size: Vec3;
	triangles: number;
	vertices: number;
	volume: number;
	surfaceArea: number;
	/** Every component is a closed, oriented 2-manifold. Not a printability verdict. */
	closedManifold: boolean;
	glbBytes: number;
	/** sha256 of the GLB: equal on every surface that evaluates the same model with the same engine. */
	glbSha256: string;
	/** Canonical JSON bytes of the model. */
	modelBytes: number;
	/** `m1.…` fragment payload, or null when the model is over the link budget. */
	link: string | null;
	engine: { kernel: string; generator: string; pipeline: string };
	timing: { totalMs: number; stageMs: EngineRun['stageMs'] };
}

export interface ModelRun {
	outcome: EngineRun['outcome'];
	diagnostics: AssetDiagnostic[];
	model?: ParametricModel;
	summary?: ParametricModelSummary;
	run?: EngineRun;
}

export interface ModelRunOptions {
	budget: AssetBudget;
	signal?: AbortSignal;
	deadlineAt?: number;
}

export function modelDigest(model: ParametricModel): Promise<string> {
	return sha256(new TextEncoder().encode(canonicalJson(model)));
}

/** Parse untrusted input as a parametric model, with findings named by path inside the model. */
export function parseModel(input: unknown): { model?: ParametricModel; diagnostics: AssetDiagnostic[] } {
	const parsed = v.safeParse(parametricModelSchema, input);
	if (parsed.success) return { model: parsed.output, diagnostics: [] };
	return {
		diagnostics: parsed.issues.slice(0, 12).map((issue) => {
			const path = v.getDotPath(issue) ?? 'model';
			const expected = issue.expected ? ` (expected ${issue.expected})` : '';
			return assetDiagnostic('request.invalid', path, `${issue.message}${expected}`);
		}),
	};
}

const round = (n: number) => Math.round(n * 1e4) / 1e4;

async function sha256(bytes: Uint8Array): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>));
	return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** `procedural-ts@1/parametric-model@1` — the asset production transform, as the server derivation names it. */
export const modelTransform = () =>
	`${proceduralEngine.id}@${proceduralEngine.version}/${parametricModelGenerator.id}@${parametricModelGenerator.version}`;

export async function runParametricModel(input: unknown, options: ModelRunOptions): Promise<ModelRun> {
	const started = performance.now();
	const { model, diagnostics } = parseModel(input);
	if (!model) return { outcome: 'refused', diagnostics };
	const digest = await modelDigest(model);
	// The same provenance on every surface, so the GLB bytes — and their sha256 — match between
	// the MCP service, the viewer's worker and the CLI.
	const extras = {
		v10r: {
			transform: modelTransform(),
			kernel: `${MODELING_KERNEL.id}@${MODELING_KERNEL.version}`,
			modelDigest: digest,
		},
	};
	const run = await proceduralEngine.produce(
		{ format: ASSET_REQUEST_FORMAT, generator: 'parametric-model', parameters: model },
		{ budget: options.budget, signal: options.signal, deadlineAt: options.deadlineAt, extras: () => extras },
	);
	if (run.outcome !== 'succeeded' || !run.inspection || !run.solids || !run.glb) {
		return { outcome: run.outcome, diagnostics: run.diagnostics, model, run };
	}
	const components = run.solids.map((solid, i): ModelComponentSummary => {
		const primitive = run.inspection?.primitives[i];
		return {
			name: solid.name,
			material: primitive?.material ?? 'plastic',
			triangles: primitive?.triangles ?? 0,
			vertices: primitive?.vertices ?? 0,
			size: [0, 1, 2].map((a) => round(solid.bounds.max[a] - solid.bounds.min[a])) as Vec3,
			closedManifold: solid.closedManifold,
			genus: solid.genus,
			volume: round(solid.volume),
			surfaceArea: round(solid.surfaceArea),
		};
	});
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (const solid of run.solids) {
		for (let a = 0; a < 3; a++) {
			min[a] = Math.min(min[a], solid.bounds.min[a]);
			max[a] = Math.max(max[a], solid.bounds.max[a]);
		}
	}
	const canonical = canonicalJson(model);
	const summary: ParametricModelSummary = {
		digest,
		name: model.name,
		units: model.units,
		parameters: { ...(model.parameters ?? {}) },
		components,
		bounds: { min: min.map(round) as Vec3, max: max.map(round) as Vec3 },
		size: [0, 1, 2].map((a) => round(max[a] - min[a])) as Vec3,
		triangles: run.inspection.triangles,
		vertices: run.inspection.vertices,
		volume: round(components.reduce((sum, c) => sum + c.volume, 0)),
		surfaceArea: round(components.reduce((sum, c) => sum + c.surfaceArea, 0)),
		closedManifold:
			components.every((c) => c.closedManifold) && !run.diagnostics.some((d) => d.code === 'mesh.open-shell'),
		glbBytes: run.glb.byteLength,
		glbSha256: await sha256(run.glb),
		modelBytes: new TextEncoder().encode(canonical).byteLength,
		link: tryEncodeModelLink(model),
		engine: {
			kernel: MODELING_KERNEL.label,
			generator: `${parametricModelGenerator.id}@${parametricModelGenerator.version}`,
			pipeline: `${proceduralEngine.id}@${proceduralEngine.version}`,
		},
		timing: { totalMs: Math.round((performance.now() - started) * 10) / 10, stageMs: run.stageMs },
	};
	return { outcome: 'succeeded', diagnostics: run.diagnostics, model, summary, run };
}
