/**
 * MCP 3D — the tool registry of the stateless parametric modeling service (`/api/mcp/3d`).
 *
 * A separate service, not a Pattern MCP extension: its own endpoint, identity, instructions,
 * rate limit and tool registry, served by the same protocol infrastructure (`#mcp/tool-server.ts`,
 * `../http.adapter.ts`). The Pattern MCP's registries never see these tools and this registry never
 * sees theirs (`tools.test.ts` pins both directions).
 *
 * The assistant sends a compact, typed model definition; the server validates it, evaluates it
 * through the asset production engine (`#lib/asset-production/modeling`), and answers with facts
 * and a reproducible viewer link. Nothing is kept: every call carries the whole model, the answer
 * carries the whole result, and the link carries the whole model in its fragment.
 *
 * - `describe_modeling` — the vocabulary, limits and a worked example. Free; read once.
 * - `generate_model {model}` — build, inspect, summarise; the 3D Viewer App renders it.
 * - `modify_model {model, patch}` — apply a patch to the supplied model, rebuild, return the new model.
 * - `render_model {model, format}` — app-only (`_meta.ui.visibility: ["app"]`): the preview mesh
 *   the App draws, or the exact GLB / STL it downloads. Never for the model's context.
 *
 * Model definitions are never logged or recorded: the endpoint mounts no telemetry observer, and
 * nothing here writes to a console, a log or a database.
 */

import * as v from 'valibot';
import { type AssetBudget, type AssetDiagnostic, hasAssetErrors } from '#lib/asset-production/index.ts';
import {
	applyModelPatch,
	EXPRESSION_SYNTAX,
	encodePreviewMesh,
	MODELING_KERNEL,
	MODELING_VOCABULARY,
	type ModelRun,
	modelViewerUrl,
	type ParametricModelSummary,
	PLACEMENT_FIELDS,
	PROFILE_SHAPES,
	parseModel,
	runParametricModel,
	UNSUPPORTED_OPERATIONS,
} from '#lib/asset-production/modeling/index.ts';
import { encodeStl, STL_MEDIA_TYPE } from '#lib/asset-production/stl.ts';
import {
	MODEL_MATERIALS,
	MODEL_UNITS,
	MODELING_LIMITS,
	modelPatchSchema,
	type ParametricModel,
} from '#lib/schemas/parametric-model.ts';
import { exampleModel } from '#lib/showcases/3d/mcp/example-models.ts';
import { canonicalJson } from '#lib/utils/canonical-json.ts';
import { MODEL_VIEWER_VIEW } from '../apps/model-viewer.ts';
import {
	errorResult,
	type NextAction,
	type ToolDef,
	type ToolRegistry,
	type ToolResult,
	withNextActions,
} from '../types';

export const MODELING_TOOL_NAMES = ['describe_modeling', 'generate_model', 'modify_model', 'render_model'] as const;
export type ModelingToolName = (typeof MODELING_TOOL_NAMES)[number];

/** What one call may spend. Tighter than the engine default: the answer has to fit a function response. */
export const MCP_3D_BUDGET: AssetBudget = { maxTriangles: 100_000, maxVertices: 120_000, maxGlbBytes: 2_500_000 };

/** Wall-clock ceiling for one evaluation, checked between operations. */
export const MCP_3D_RUN_MS = 8_000;

/**
 * The service's admission limits (`/api/mcp/3d`). Per-account counts are keyed by the
 * Velociraptor user id, never an IP: MCP hosts call from shared egress, and several clients
 * of one user share one allowance. The per-IP entry limit is only DoS hygiene in front of
 * authentication. In-flight bounds are per server instance.
 */
export const MCP_3D_QUOTA = {
	perAddressPerMinute: 300,
	perAccountPerMinute: 30,
	perAccountPerDay: 1_000,
	surfacePerMinute: 600,
	inFlightPerInstance: 4,
	inFlightPerAccount: 2,
} as const;

export const MCP_3D_INSTRUCTIONS =
	'Stateless parametric 3D modeling. Describe a solid as a typed feature graph — parameters, operations (primitives, profiles, Booleans, patterns, procedural surfaces), outputs — never as code. Call describe_modeling once for the vocabulary, then generate_model with the whole model. To change it, call modify_model with the model you hold and a patch; the server keeps nothing between calls, so always send the full current model. Every answer includes a viewer link that reproduces the model exactly (the model travels in the link fragment; the link is not private).';

const MODEL_ARGUMENT = {
	type: 'object',
	description:
		'A parametric model: { version: 1, name?, units: "mm"|"cm"|"m"|"in", parameters?: { name: number }, operations: [ { id, op, … } ], output: id | [ids] }. The vocabulary is in describe_modeling.',
} as const;

const TOOLS: readonly ToolDef[] = [
	{
		name: 'describe_modeling',
		description:
			'The parametric modeling vocabulary: every operation and its fields, profiles, placement, expressions, units, materials, limits, what is not supported, and a complete example model. Read once before generate_model.',
		inputSchema: { type: 'object', additionalProperties: false, properties: {} },
	},
	{
		name: 'generate_model',
		description:
			'Build a 3D solid from a parametric model definition (JSON, not code). Returns dimensions, triangle count, volume, closed-manifold status, findings and a viewer link to view, edit and export it (GLB, STL, JSON). Renders an interactive 3D view in hosts that support MCP Apps.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			required: ['model'],
			properties: { model: MODEL_ARGUMENT },
		},
	},
	{
		name: 'modify_model',
		description:
			'Change a model you already have: send the full current model and a patch ({ parameters?: {name: value}, operations?: {id: {field: value}}, remove?: [ids], add?: [operations], output?, name? }). Returns the new model, its summary and a new viewer link. The server keeps no model between calls.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			required: ['model', 'patch'],
			properties: {
				model: MODEL_ARGUMENT,
				patch: {
					type: 'object',
					description:
						'{ parameters?: { name: number }, operations?: { id: { field: value } }, remove?: [ids], add?: [operations], output?: id | [ids], name? }. id and op of an operation cannot change.',
				},
			},
		},
	},
	{
		name: 'render_model',
		description:
			'For the 3D viewer app only: the mesh it draws (format "preview") or the exact file it downloads ("glb", "stl"), base64-encoded. Agents use generate_model, whose answer carries a viewer link with the same exports.',
		inputSchema: {
			type: 'object',
			additionalProperties: false,
			required: ['model', 'format'],
			properties: { model: MODEL_ARGUMENT, format: { type: 'string', enum: ['preview', 'glb', 'stl'] } },
		},
	},
];

const DESCRIBE_NEXT: NextAction = { tool: 'describe_modeling', why: 'the vocabulary, limits and a complete example' };

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const dims = (size: readonly number[], units: string) => `${size.map(fmt).join(' × ')} ${units}`;

function findingLines(diagnostics: readonly AssetDiagnostic[]): string[] {
	return diagnostics.slice(0, 12).map((d) => `- ${d.severity} \`${d.code}\` at ${d.subject}: ${d.message}`);
}

function describeModeling(): string {
	const example = exampleModel('enclosure').model;
	const L = MODELING_LIMITS;
	const lines = [
		'# Parametric modeling vocabulary',
		'',
		'A model is JSON: `{ "version": 1, "name"?, "units", "parameters"?, "operations": [ … ], "output": id | [ids] }`. Operations run in order; each has a unique `id` and may reference only earlier ids, so the graph is acyclic by construction. Each output is one component (a separate solid, its own material).',
		'',
		'## Operations',
		'',
		...MODELING_VOCABULARY.map((entry) => `- \`${entry.op}\` ${entry.fields} — ${entry.summary}`),
		'',
		`Profiles: ${PROFILE_SHAPES}`,
		'',
		`Placement, on every operation, applied scale → rotate → translate: ${PLACEMENT_FIELDS}.`,
		'',
		`Expressions: ${EXPRESSION_SYNTAX}`,
		'',
		`Units: ${MODEL_UNITS.join(', ')} (Z is up; exports are glTF Y-up metres and STL millimetres). Materials: ${MODEL_MATERIALS.join(', ')}.`,
		'',
		'## Limits',
		'',
		`${L.maxModelBytes} bytes of JSON, ${L.maxOperations} operations, ${L.maxParameters} parameters, ${L.maxOutputs} outputs, graph depth ${L.maxGraphDepth}, ${L.maxPatternInstances} pattern copies in total, segments ${L.minSegments}–${L.maxSegments}, extent ${L.maxExtentMetres} m. Per call: ${MCP_3D_BUDGET.maxTriangles} triangles, ${MCP_3D_BUDGET.maxGlbBytes} GLB bytes, ${MCP_3D_RUN_MS / 1000} s. A model over a limit is refused before anything is built, with the path of the offending field.`,
		'',
		'## Not supported',
		'',
		...UNSUPPORTED_OPERATIONS.map((item) => `- ${item}`),
		'',
		`Kernel: ${MODELING_KERNEL.label}. Output is always a closed mesh; "closed manifold" is reported per component and is not a printability verdict.`,
		'',
		'## Example: cylindrical enclosure, removable lid, four mounting holes, 3 mm wall',
		'',
		'```json',
		canonicalJson(example),
		'```',
	];
	return lines.join('\n');
}

/**
 * The summary as the model reads it: the facts an assistant reasons with, nothing a viewer or a
 * benchmark needs (bounds, per-stage timing, surface areas, engine labels). Every field here is
 * paid for in tokens on every call.
 */
function modelFacts(summary: ParametricModelSummary): Record<string, unknown> {
	return {
		name: summary.name,
		units: summary.units,
		size: summary.size,
		triangles: summary.triangles,
		closedManifold: summary.closedManifold,
		components: summary.components.map(({ name, material, size, volume, genus }) => ({
			name,
			material,
			size,
			volume,
			genus,
		})),
		glbBytes: summary.glbBytes,
		glbSha256: summary.glbSha256,
		digest: summary.digest,
		ms: summary.timing.totalMs,
	};
}

/** The model-facing answer: facts only, no vertex data. Complete as text and as JSON. */
function modelAnswer(result: ModelRun, siteOrigin: string, heading: string, includeModel: boolean): ToolResult {
	const summary = result.summary as ParametricModelSummary;
	const viewerUrl = summary.link ? modelViewerUrl(siteOrigin, summary.link) : null;
	const u = summary.units;
	const lines = [
		`# ${heading}${summary.name ? `: ${summary.name}` : ''}`,
		'',
		`- ${summary.components.length} component${summary.components.length === 1 ? '' : 's'}, ${summary.triangles} triangles, overall ${dims(summary.size, u)}, ${summary.closedManifold ? 'every component a closed manifold' : 'NOT every component is a closed manifold'}`,
		...summary.components.map(
			(c) =>
				`- \`${c.name}\` (${c.material}): ${dims(c.size, u)}, volume ${fmt(c.volume)} ${u}³, genus ${c.genus}${c.genus > 0 ? ' (through-holes)' : ''}`,
		),
		viewerUrl
			? `- View, edit parameters, export GLB / STL / JSON: ${viewerUrl}`
			: `- No viewer link: the model is over the link budget. Shorten it (fewer literal digits, more parameters).`,
		`- GLB ${summary.glbBytes} bytes · model sha256 ${summary.digest.slice(0, 16)}… · ${summary.timing.totalMs} ms`,
	];
	if (result.diagnostics.length > 0) lines.push('', '## Findings', '', ...findingLines(result.diagnostics));
	if (includeModel)
		lines.push('', '## New model (send this one next time)', '', '```json', canonicalJson(result.model), '```');
	const text = withNextActions(lines.join('\n'), [
		{ tool: 'modify_model', why: 'change parameters or operations of this model' },
	]);
	return {
		content: [{ type: 'text', text }],
		structuredContent: {
			outcome: result.outcome,
			viewerUrl,
			summary: modelFacts(summary),
			findings: result.diagnostics.map(({ severity, code, subject, message }) => ({
				severity,
				code,
				subject,
				message,
			})),
			...(includeModel ? { model: result.model } : {}),
		},
	};
}

function failure(result: ModelRun): ToolResult {
	const refused = result.outcome === 'refused';
	const heading = refused
		? '# Model refused — nothing was built'
		: result.outcome === 'cancelled'
			? `# Model stopped — over the ${MCP_3D_RUN_MS / 1000} s budget`
			: '# Model failed to build';
	const body = [heading, '', ...findingLines(result.diagnostics)].join('\n');
	return errorResult(body, refused ? 'invalid_args' : 'empty', [DESCRIBE_NEXT]);
}

const objectArgs = (args: unknown): Record<string, unknown> =>
	typeof args === 'object' && args !== null && !Array.isArray(args) ? (args as Record<string, unknown>) : {};

async function evaluate(model: unknown): Promise<ModelRun> {
	return runParametricModel(model, { budget: MCP_3D_BUDGET, deadlineAt: performance.now() + MCP_3D_RUN_MS });
}

const toBase64 = (bytes: Uint8Array) =>
	Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');

async function renderModel(args: Record<string, unknown>): Promise<ToolResult> {
	const format = args.format;
	if (format !== 'preview' && format !== 'glb' && format !== 'stl') {
		return errorResult('`format` must be "preview", "glb" or "stl".', 'invalid_args', [DESCRIBE_NEXT]);
	}
	const result = await evaluate(args.model);
	if (result.outcome !== 'succeeded' || !result.summary || !result.run?.glb || !result.run.mesh) return failure(result);
	const summary = result.summary;
	if (format === 'preview') {
		return {
			content: [{ type: 'text', text: `Preview mesh for the viewer app (${summary.triangles} triangles).` }],
			structuredContent: {
				format,
				summary: summary as unknown as Record<string, unknown>,
				findings: result.diagnostics.map(({ severity, code, subject, message }) => ({
					severity,
					code,
					subject,
					message,
				})),
				preview: encodePreviewMesh(result.run.mesh) as unknown as Record<string, unknown>,
			},
		};
	}
	const bytes = format === 'glb' ? result.run.glb : encodeStl(result.run.mesh);
	const base =
		(summary.name ?? 'model')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '') || 'model';
	return {
		content: [{ type: 'text', text: `${format.toUpperCase()} file for the viewer app (${bytes.byteLength} bytes).` }],
		structuredContent: {
			format,
			filename: `${base}.${format}`,
			mediaType: format === 'glb' ? 'model/gltf-binary' : STL_MEDIA_TYPE,
			bytes: bytes.byteLength,
			base64: toBase64(bytes),
		},
	};
}

/** The MCP 3D registry for one request; `siteOrigin` is the deployment the viewer links point at. */
export function modelingRegistry(siteOrigin: string): ToolRegistry {
	return {
		tools: TOOLS,
		views: [MODEL_VIEWER_VIEW],
		async dispatch(name, rawArgs): Promise<ToolResult> {
			const args = objectArgs(rawArgs);
			switch (name as ModelingToolName) {
				case 'describe_modeling':
					return { content: [{ type: 'text', text: describeModeling() }] };
				case 'generate_model': {
					if (args.model === undefined) return errorResult('`model` is required.', 'invalid_args', [DESCRIBE_NEXT]);
					const result = await evaluate(args.model);
					if (result.outcome !== 'succeeded' || hasAssetErrors(result.diagnostics)) return failure(result);
					return modelAnswer(result, siteOrigin, 'Model built', false);
				}
				case 'modify_model': {
					// A patch on an invalid model is refused as such, before the patch is looked at.
					const parsedModel = parseModel(args.model);
					if (!parsedModel.model) return failure({ outcome: 'refused', diagnostics: parsedModel.diagnostics });
					const patch = v.safeParse(modelPatchSchema, args.patch);
					if (!patch.success) {
						const issue = patch.issues[0];
						return errorResult(
							`\`patch\` is invalid at ${v.getDotPath(issue) ?? 'patch'}: ${issue.message}`,
							'invalid_args',
							[{ tool: 'describe_modeling', why: 'the patch shape is in the modify_model description' }],
						);
					}
					const patched = applyModelPatch(parsedModel.model as ParametricModel, patch.output);
					if (!patched.ok) return errorResult(patched.message, 'invalid_args', [DESCRIBE_NEXT]);
					const result = await evaluate(patched.value);
					if (result.outcome !== 'succeeded' || hasAssetErrors(result.diagnostics)) return failure(result);
					return modelAnswer(result, siteOrigin, 'Model modified', true);
				}
				case 'render_model':
					return renderModel(args);
				default:
					return errorResult(`Unknown tool: ${name}`, 'unknown_tool', [DESCRIBE_NEXT]);
			}
		},
	};
}
