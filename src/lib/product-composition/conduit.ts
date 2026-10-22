/**
 * The polyline a conduit coupling's path follows — pure points, so any renderer can draw it
 * (the Threlte layer fillets the corners into a tube).
 *
 * The ends are never stored: they come from the two ports' live world frames, each leaving its
 * port straight along the port's outward axis for `CONDUIT_STUB`, then through the stored
 * interior waypoints. Moving a product therefore can never leave a detached path.
 */
import { Vector3 } from 'three';
import type { ProductComposition, Vec3 } from '../schemas/product-composition';
import { frameAxis, quantizeVec3 } from './frame';
import { resolvePort } from './resolve';

/** How far a path leaves a port straight along its axis before it may turn, in metres. */
export const CONDUIT_STUB = 0.1;

/** Turns smaller than this, in radians, are not bends. */
const BEND_ANGLE = 1e-6;

export interface ConduitPolyline {
	points: Vec3[];
	/** Total length in metres. */
	length: number;
	/** Direction changes along the path. */
	bends: number;
}

/** The path of a top-level `conduit` coupling; `undefined` for a mate or a coupling that does not resolve. */
export function conduitPolyline(composition: ProductComposition, couplingId: string): ConduitPolyline | undefined {
	const coupling = composition.couplings.find((candidate) => candidate.id === couplingId);
	if (coupling?.mode !== 'conduit') return undefined;
	const a = resolvePort(composition, coupling.a);
	const b = resolvePort(composition, coupling.b);
	if (!a || !b) return undefined;

	const waypoints = composition.conduits.find((conduit) => conduit.coupling === couplingId)?.waypoints ?? [];
	const stub = (position: Vec3, axis: Vec3) =>
		new Vector3(...position).addScaledVector(new Vector3(...axis), CONDUIT_STUB);
	const candidates = [
		new Vector3(...a.frame.position),
		stub(a.frame.position, frameAxis(a.frame)),
		...waypoints.map((point) => new Vector3(...point)),
		stub(b.frame.position, frameAxis(b.frame)),
		new Vector3(...b.frame.position),
	];
	// On the composition's 1e-9 grid, so the same document gives the same path everywhere.
	const points = candidates
		.map((point) => new Vector3(...quantizeVec3([point.x, point.y, point.z])))
		.filter((point, index, all) => index === 0 || !point.equals(all[index - 1]));

	let length = 0;
	let bends = 0;
	for (let index = 1; index < points.length; index++) {
		length += points[index].distanceTo(points[index - 1]);
		if (index >= 2) {
			const before = points[index - 1].clone().sub(points[index - 2]);
			const after = points[index].clone().sub(points[index - 1]);
			if (before.angleTo(after) > BEND_ANGLE) bends++;
		}
	}
	return { points: points.map((point) => [point.x, point.y, point.z]), length: Math.round(length * 1e9) / 1e9, bends };
}
