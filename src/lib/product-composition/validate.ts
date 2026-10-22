/**
 * Deterministic validation of a whole document: the same composition and standards always
 * give the same diagnostics, in the same order.
 *
 * Each arrangement is checked once in its own space — the top level, and each composed
 * definition in definition-local space — so a subassembly placed three times is reported
 * once. Port use and open ports are counted on the flattened tree, because an exposed port
 * and the inner port behind it are one port.
 */
import type { Arrangement, ProductComposition } from '../schemas/product-composition';
import { type CompositionDiagnostic, compareText, diagnostic, sortDiagnostics } from './diagnostics';
import { framesMate } from './frame';
import { portUse } from './network';
import { type DefinitionIndex, indexDefinitions, resolveComposition, resolvePortIn } from './resolve';
import { type PortStandardRegistry, portMismatches } from './standards';

export function validateComposition(
	composition: ProductComposition,
	registry: PortStandardRegistry,
): CompositionDiagnostic[] {
	const definitions = indexDefinitions(composition);
	const found: CompositionDiagnostic[] = [];

	for (const definition of composition.definitions) {
		const scope = `definitions/${definition.id}/`;
		if (reachesItself(definitions, definition.id)) {
			found.push(diagnostic('composition.recursive', `definitions/${definition.id}`));
			continue;
		}
		const { body } = definition;
		if (body.kind === 'geometry') {
			const ids = new Set(body.ports.map((port) => port.id));
			(body.passages ?? []).forEach(([a, b], index) => {
				if (!ids.has(a) || !ids.has(b)) found.push(diagnostic('passage.unresolved', `${scope}passages/${index}`));
				else if (a === b) found.push(diagnostic('passage.self', `${scope}passages/${index}`));
			});
			continue;
		}
		checkArrangement(body, scope, definitions, registry, found, [definition.id]);
		const sources = new Set<string>();
		for (const exposed of body.exposedPorts) {
			const subject = `${scope}exposedPorts/${exposed.id}`;
			const source = resolvePortIn(definitions, body, exposed.from, '', [definition.id]);
			if (!source) found.push(diagnostic('exposed-port.unresolved', subject));
			else if (sources.has(source.key)) found.push(diagnostic('exposed-port.shared', subject));
			else sources.add(source.key);
		}
	}

	checkArrangement(composition, '', definitions, registry, found, []);

	const use = portUse(composition);
	for (const port of resolveComposition(composition).ports) {
		const used = use.get(port.key);
		const subject = `ports/${port.key}`;
		if (!used) found.push(diagnostic('port.open', subject));
		else if (used.count > (used.mated ? 1 : (port.port.capacity ?? 1)))
			found.push(diagnostic('port.capacity', subject));
	}
	return sortDiagnostics(found);
}

function checkArrangement(
	arrangement: Arrangement,
	scope: string,
	definitions: DefinitionIndex,
	registry: PortStandardRegistry,
	found: CompositionDiagnostic[],
	stack: readonly string[],
) {
	for (const occurrence of arrangement.occurrences) {
		if (!definitions.has(occurrence.definition)) {
			found.push(diagnostic('definition.missing', `${scope}occurrences/${occurrence.id}`));
		}
	}

	const pairs = new Set<string>();
	for (const coupling of arrangement.couplings) {
		const subject = `${scope}couplings/${coupling.id}`;
		if (coupling.a.occurrence === coupling.b.occurrence) {
			found.push(diagnostic('coupling.self', subject));
			continue;
		}
		const a = resolvePortIn(definitions, arrangement, coupling.a, '', stack);
		const b = resolvePortIn(definitions, arrangement, coupling.b, '', stack);
		if (!a || !b) {
			found.push(diagnostic('coupling.unresolved', subject));
			continue;
		}
		const pair = [a.key, b.key].sort(compareText).join(' ');
		if (pairs.has(pair)) {
			found.push(diagnostic('coupling.duplicate', subject));
			continue;
		}
		pairs.add(pair);

		const mismatches = portMismatches(registry, a.port, b.port, coupling.mode);
		if (mismatches.length > 0) found.push(diagnostic('port.incompatible', subject, mismatches));
		const clocking = registry.get(a.port.standard)?.clocking ?? 'fixed';
		if (coupling.mode === 'mated' && !framesMate(a.frame, b.frame, clocking)) {
			found.push(diagnostic('mate.misaligned', subject));
		}
	}

	const realised = new Set<string>();
	for (const conduit of arrangement.conduits) {
		const subject = `${scope}conduits/${conduit.id}`;
		const coupling = arrangement.couplings.find((candidate) => candidate.id === conduit.coupling);
		if (!coupling) found.push(diagnostic('conduit.unresolved', subject));
		else if (coupling.mode === 'mated') found.push(diagnostic('conduit.mode', subject));
		else if (realised.has(coupling.id)) found.push(diagnostic('conduit.duplicate', subject));
		else realised.add(coupling.id);
	}
}

/** Whether a definition contains itself, at any depth. */
function reachesItself(definitions: DefinitionIndex, id: string): boolean {
	const seen = new Set<string>();
	const pending = [id];
	while (pending.length > 0) {
		const definition = definitions.get(pending.pop() ?? '');
		if (definition?.body.kind !== 'composition') continue;
		for (const occurrence of definition.body.occurrences) {
			if (occurrence.definition === id) return true;
			if (!seen.has(occurrence.definition)) {
				seen.add(occurrence.definition);
				pending.push(occurrence.definition);
			}
		}
	}
	return false;
}
