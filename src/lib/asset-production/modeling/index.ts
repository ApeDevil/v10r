/**
 * Parametric modeling: the feature-graph generator's core — framework-free, runtime-free, the
 * same in a browser, a Web Worker, a serverless function and a CLI. See
 * docs/blueprint/3d/parametric-modeling.md.
 */
export { type EvaluateOptions, evaluateModel, ModelEvaluationError } from './evaluate.ts';
export { type CompiledExpression, compileExpression, ExpressionError } from './expression.ts';
export {
	loadModelingKernel,
	MODELING_KERNEL,
	type ModelingKernel,
	type ModelingKernelSource,
	modelingKernelLoadMs,
} from './kernel.ts';
export {
	decodeModelLink,
	encodeModelLink,
	MAX_MODEL_LINK_CHARS,
	MAX_MODEL_LINK_RATIO,
	MODEL_LINK_PREFIX,
	type ModelLinkFailure,
	modelViewerUrl,
	tryEncodeModelLink,
} from './model-link.ts';
export { applyModelPatch } from './patch.ts';
export {
	decodePreviewPrimitive,
	encodePreviewMesh,
	PREVIEW_MESH_FORMAT,
	type PreviewMesh,
	type PreviewPrimitive,
} from './preview-mesh.ts';
export { operandsOf, type ResolvedModel, type ResolvedOperation, resolveModel } from './resolve.ts';
export {
	type ModelComponentSummary,
	type ModelRun,
	type ModelRunOptions,
	modelDigest,
	modelTransform,
	type ParametricModelSummary,
	parseModel,
	runParametricModel,
} from './run.ts';
export {
	EXPRESSION_SYNTAX,
	MODELING_VOCABULARY,
	type OperationEntry,
	PLACEMENT_FIELDS,
	PROFILE_SHAPES,
	UNSUPPORTED_OPERATIONS,
} from './vocabulary.ts';
