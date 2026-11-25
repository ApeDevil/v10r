// The generative UI contract: catalog, limits, policy, messages and the surface action.
// Client-safe and web_core-free — `load-catalog.ts` (web_core) is imported by file, only by
// the server compiler and the lazily loaded renderer. Fixtures are imported by file too.
export {
	GENERATIVE_UI_CATALOG,
	GENERATIVE_UI_CATALOG_ID,
	GENERATIVE_UI_COMPONENTS,
	GENERATIVE_UI_PROTOCOL_VERSION,
	type GenerativeUiComponentName,
	isGenerativeUiComponent,
} from './catalog.ts';
export { GENERATIVE_SURFACE_LIMITS, type GenerativeSurfaceLimits } from './limits.ts';
export type { GenerativeSurfaceComponent, GenerativeSurfaceMessage } from './messages.ts';
export {
	checkGenerativeSurfaceBatch,
	EMPTY_GENERATIVE_SURFACE_GRAPH,
	type GenerativeSurfaceGraph,
	type GenerativeSurfacePolicyOptions,
	type GenerativeSurfacePolicyResult,
	type GenerativeSurfaceRefusal,
	type GenerativeSurfaceRefusalCode,
	isSurfaceDataPath,
	isUnsafeUrlText,
} from './policy.ts';
export {
	GENERATIVE_SURFACE_ACTION_RISK,
	type GenerativeSurfaceAction,
	type GenerativeSurfaceActionReading,
	GenerativeSurfaceActionSchema,
	SurfaceActionRecordSchema,
	surfaceActionRecordOf,
	toGenerativeSurfaceAction,
} from './surface-action.ts';
export {
	ownSurfaceActionRecordOf,
	SURFACE_ACTION_PART,
	type SurfaceActionPart,
	type SurfaceActionRecord,
	surfaceActionKey,
} from './surface-action-key.ts';
