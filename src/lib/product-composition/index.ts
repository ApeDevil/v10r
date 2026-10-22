export type {
	Arrangement,
	Conduit,
	Coupling,
	ExposedPort,
	Frame,
	PortRef,
	PortStandard,
	Primitive,
	ProductBody,
	ProductComposition,
	ProductDefinition,
	ProductGeometry,
	ProductOccurrence,
	ProductPort,
	Quat,
	Vec3,
} from '../schemas/product-composition';
export { COMPOSITION_FORMAT } from '../schemas/product-composition';
export { CONDUIT_STUB, type ConduitPolyline, conduitPolyline } from './conduit';
export {
	type CompositionDiagnostic,
	type DiagnosticCode,
	type DiagnosticSeverity,
	sortDiagnostics,
} from './diagnostics';
export {
	canonicalFrame,
	composeFrames,
	frameAxis,
	frameFromAxisAngle,
	framesMate,
	IDENTITY_FRAME,
	invertFrame,
	MATE_TOLERANCE,
	matedPlacement,
	quantizeVec3,
	transformPoint,
} from './frame';
export { type PortNetwork, type PortUse, portNetworks, portUse } from './network';
export {
	addOccurrence,
	type CouplingDraft,
	connect,
	disconnect,
	insertWaypoint,
	moveOccurrence,
	nextId,
	type OccurrenceDraft,
	type OperationResult,
	removeOccurrence,
	removeWaypoint,
	rotateOccurrence,
	setConduitWaypoints,
} from './operations';
export {
	type PortResolution,
	portKey,
	type Resolution,
	type ResolvedOccurrence,
	type ResolvedPort,
	resolveComposition,
	resolvePort,
} from './resolve';
export { type CompositionIssue, type CompositionParse, parseComposition, stringifyComposition } from './serialize';
export { createPortStandardRegistry, type PortMismatch, type PortStandardRegistry, portMismatches } from './standards';
export { validateComposition } from './validate';
