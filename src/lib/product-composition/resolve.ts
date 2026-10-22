/**
 * Flattening: from a document of nested definitions to the leaf products and ports a renderer
 * draws and a network joins.
 *
 * A *leaf port key* names one geometry port anywhere in the tree: the occurrence path, `#`,
 * the port id — `boiler-1#bus`, `unit-1/pump-1#in`. A `PortRef` at one level resolves to a
 * leaf key by following `exposedPorts` down through composed products. Resolution never
 * throws: a reference that does not resolve returns `undefined`, and a recursive or missing
 * definition is skipped — validation reports both.
 */
import type {
	Arrangement,
	Frame,
	PortRef,
	ProductComposition,
	ProductDefinition,
	ProductGeometry,
	ProductPort,
} from '../schemas/product-composition';
import { composeFrames, IDENTITY_FRAME } from './frame';

export type DefinitionIndex = ReadonlyMap<string, ProductDefinition>;

export const indexDefinitions = (composition: ProductComposition): DefinitionIndex =>
	new Map(composition.definitions.map((definition) => [definition.id, definition]));

export const portKey = (occurrencePath: string, port: string): string => `${occurrencePath}#${port}`;

const joinPath = (...segments: string[]): string => segments.filter(Boolean).join('/');

/** A port reference resolved to its leaf port, with its frame in the referencing arrangement's space. */
export interface PortResolution {
	key: string;
	port: ProductPort;
	frame: Frame;
}

/** The leaf port behind `portId` on a definition, its path and frame relative to that definition. */
function leafPort(
	definitions: DefinitionIndex,
	definition: ProductDefinition,
	portId: string,
	stack: readonly string[],
): { path: string; port: ProductPort; frame: Frame } | undefined {
	const { body } = definition;
	if (body.kind === 'geometry') {
		const port = body.ports.find((candidate) => candidate.id === portId);
		return port && { path: '', port, frame: port.frame };
	}
	const exposed = body.exposedPorts.find((candidate) => candidate.id === portId);
	const inner = exposed && body.occurrences.find((candidate) => candidate.id === exposed.from.occurrence);
	const innerDefinition = inner && definitions.get(inner.definition);
	if (!exposed || !inner || !innerDefinition || stack.includes(innerDefinition.id)) return undefined;
	const leaf = leafPort(definitions, innerDefinition, exposed.from.port, [...stack, innerDefinition.id]);
	return (
		leaf && { path: joinPath(inner.id, leaf.path), port: leaf.port, frame: composeFrames(inner.placement, leaf.frame) }
	);
}

/** Resolve a reference made inside `arrangement`; `prefix` is the arrangement's own occurrence path. */
export function resolvePortIn(
	definitions: DefinitionIndex,
	arrangement: Pick<Arrangement, 'occurrences'>,
	ref: PortRef,
	prefix = '',
	stack: readonly string[] = [],
): PortResolution | undefined {
	const occurrence = arrangement.occurrences.find((candidate) => candidate.id === ref.occurrence);
	const definition = occurrence && definitions.get(occurrence.definition);
	if (!occurrence || !definition || stack.includes(definition.id)) return undefined;
	const leaf = leafPort(definitions, definition, ref.port, [...stack, definition.id]);
	if (!leaf) return undefined;
	return {
		key: portKey(joinPath(prefix, occurrence.id, leaf.path), leaf.port.id),
		port: leaf.port,
		frame: composeFrames(occurrence.placement, leaf.frame),
	};
}

/** A top-level reference, resolved to its leaf port and world frame. */
export function resolvePort(composition: ProductComposition, ref: PortRef): PortResolution | undefined {
	return resolvePortIn(indexDefinitions(composition), composition, ref);
}

/** One placed arrangement in the flattened tree: the document's top, or one composed occurrence's body. */
export interface ArrangementScope {
	arrangement: Arrangement;
	/** Occurrence path of the composed occurrence; `''` at the top. */
	path: string;
	/** The scope's frame in world space. */
	frame: Frame;
	/** Definition ids from the top down to here — the recursion guard. */
	stack: readonly string[];
}

/** Every arrangement in the flattened tree, top first. A recursive or missing definition is not entered. */
export function arrangementScopes(composition: ProductComposition, definitions = indexDefinitions(composition)) {
	const scopes: ArrangementScope[] = [];
	const visit = (scope: ArrangementScope) => {
		scopes.push(scope);
		for (const occurrence of scope.arrangement.occurrences) {
			const definition = definitions.get(occurrence.definition);
			if (definition?.body.kind !== 'composition' || scope.stack.includes(definition.id)) continue;
			visit({
				arrangement: definition.body,
				path: joinPath(scope.path, occurrence.id),
				frame: composeFrames(scope.frame, occurrence.placement),
				stack: [...scope.stack, definition.id],
			});
		}
	};
	visit({ arrangement: composition, path: '', frame: IDENTITY_FRAME, stack: [] });
	return scopes;
}

/** A product with its own geometry, placed in world space. */
export interface ResolvedOccurrence {
	path: string;
	/** The top-level occurrence it belongs to — what a click on it selects. */
	occurrence: string;
	definition: ProductDefinition;
	geometry: ProductGeometry;
	placement: Frame;
}

export interface ResolvedPort {
	key: string;
	/** The top-level occurrence it belongs to. */
	occurrence: string;
	/** How the top level addresses it — absent for a port a subassembly keeps inside. */
	ref?: PortRef;
	port: ProductPort;
	frame: Frame;
}

export interface Resolution {
	occurrences: ResolvedOccurrence[];
	ports: ResolvedPort[];
}

/** Every leaf product and port in world space — what rendering reads. */
export function resolveComposition(composition: ProductComposition): Resolution {
	const definitions = indexDefinitions(composition);
	const occurrences: ResolvedOccurrence[] = [];
	const ports: ResolvedPort[] = [];

	const topLevelRefs = new Map<string, PortRef>();
	for (const occurrence of composition.occurrences) {
		const definition = definitions.get(occurrence.definition);
		if (!definition) continue;
		const portIds =
			definition.body.kind === 'geometry'
				? definition.body.ports.map((port) => port.id)
				: definition.body.exposedPorts.map((port) => port.id);
		for (const port of portIds) {
			const ref = { occurrence: occurrence.id, port };
			const resolved = resolvePortIn(definitions, composition, ref);
			if (resolved) topLevelRefs.set(resolved.key, ref);
		}
	}

	for (const scope of arrangementScopes(composition, definitions)) {
		for (const occurrence of scope.arrangement.occurrences) {
			const definition = definitions.get(occurrence.definition);
			if (definition?.body.kind !== 'geometry') continue;
			const path = joinPath(scope.path, occurrence.id);
			const placement = composeFrames(scope.frame, occurrence.placement);
			const top = path.split('/')[0];
			occurrences.push({ path, occurrence: top, definition, geometry: definition.body.geometry, placement });
			for (const port of definition.body.ports) {
				const key = portKey(path, port.id);
				const ref = topLevelRefs.get(key);
				const frame = composeFrames(placement, port.frame);
				ports.push(ref ? { key, occurrence: top, ref, port, frame } : { key, occurrence: top, port, frame });
			}
		}
	}
	return { occurrences, ports };
}
