/**
 * Port compatibility — decided by the caller's `PortStandard` data alone.
 *
 * This module knows the *shape* of a rule (gender, direction, matching parameters), never a
 * domain: it has no notion of water, voltage or pegs. A verdict here means "these two ports
 * plausibly fit, by the declared data". It is not an engineering, hydraulic or electrical
 * safety check, and nothing built on it may present it as one.
 */
import type { Coupling, PortStandard, ProductPort } from '../schemas/product-composition';

export type PortStandardRegistry = ReadonlyMap<string, PortStandard>;

/** Why two ports may not couple. `parameter` names the parameter for `parameter.mismatch`. */
export interface PortMismatch {
	code: 'standard.unknown' | 'standard.mismatch' | 'gender.mismatch' | 'direction.mismatch' | 'parameter.mismatch';
	parameter?: string;
}

/** Index the caller's standards by id. A duplicate id is a programming error, not data to tolerate. */
export function createPortStandardRegistry(standards: readonly PortStandard[]): PortStandardRegistry {
	const registry = new Map<string, PortStandard>();
	for (const standard of standards) {
		if (registry.has(standard.id)) throw new Error(`Duplicate port standard id: ${standard.id}`);
		registry.set(standard.id, standard);
	}
	return registry;
}

const OPPOSITE_GENDER = { male: 'female', female: 'male', neutral: 'neutral' } as const;

/**
 * Every rule two ports break, in a fixed order. Empty means they may couple. Gender is a rule
 * of touching ports only: a `conduit` carries its own fittings, so a pipe between two male
 * threads is ordinary. Direction and matching parameters hold in both modes.
 */
export function portMismatches(
	registry: PortStandardRegistry,
	a: ProductPort,
	b: ProductPort,
	mode: Coupling['mode'],
): PortMismatch[] {
	const standard = registry.get(a.standard);
	if (!standard || !registry.has(b.standard)) return [{ code: 'standard.unknown' }];
	if (a.standard !== b.standard) return [{ code: 'standard.mismatch' }];

	const mismatches: PortMismatch[] = [];
	if (mode === 'mated' && standard.genders === 'opposite' && OPPOSITE_GENDER[a.gender] !== b.gender) {
		mismatches.push({ code: 'gender.mismatch' });
	}
	if (standard.directions === 'complementary' && !directionsComplement(a.direction, b.direction)) {
		mismatches.push({ code: 'direction.mismatch' });
	}
	for (const parameter of standard.matchParameters) {
		const left = a.parameters?.[parameter];
		if (left === undefined || left !== b.parameters?.[parameter]) {
			mismatches.push({ code: 'parameter.mismatch', parameter });
		}
	}
	return mismatches;
}

function directionsComplement(a: ProductPort['direction'], b: ProductPort['direction']): boolean {
	if (a === 'bidirectional' || b === 'bidirectional') return true;
	return a !== b;
}
