/**
 * Rigid-frame arithmetic for placements and ports — Three.js math, no scene.
 *
 * Every frame this module returns is canonical: every number quantised to 1e-9, then the
 * quaternion's sign fixed (`w > 0`, or for a half turn with `w = 0` the first non-zero of
 * x/y/z positive), and no `-0`. `Math.sin`/`Math.cos` are not bit-identical across JS engines,
 * so without this a composition computed in the browser and on the server could serialize
 * differently; with it, the same operations give the same bytes. The sign is chosen *after*
 * quantising — otherwise a half turn whose raw `w` lands at ±3e-10 picks either sign.
 */
import { Quaternion, Vector3 } from 'three';
import type { Frame, Quat, Vec3 } from '../schemas/product-composition';

/** How close two port frames must be to count as mated: metres, and radians of rotation. */
export const MATE_TOLERANCE = { position: 1e-6, angle: 1e-6 } as const;

export const IDENTITY_FRAME: Frame = { position: [0, 0, 0], rotation: [0, 0, 0, 1] };

/** A half turn about the port's +Y: turns a port to face its mate, keeping their +Y together. */
const FACE_TO_FACE = new Quaternion(0, 1, 0, 0);

const quantize = (n: number): number => {
	const q = Math.round(n * 1e9) / 1e9;
	return q === 0 ? 0 : q; // no -0 in output
};

const toVector = ([x, y, z]: Vec3) => new Vector3(x, y, z);
const toQuaternion = ([x, y, z, w]: Quat) => new Quaternion(x, y, z, w);

/** A point or direction on the 1e-9 grid — for numbers entering a composition from outside (a drag, a gizmo). */
export function quantizeVec3([x, y, z]: Vec3): Vec3 {
	return [quantize(x), quantize(y), quantize(z)];
}

function toFrame(position: Vector3, rotation: Quaternion): Frame {
	rotation.normalize();
	const quat: Quat = [quantize(rotation.x), quantize(rotation.y), quantize(rotation.z), quantize(rotation.w)];
	// q and -q are one rotation; the first non-zero of w, x, y, z decides which is written.
	const leading = [quat[3], quat[0], quat[1], quat[2]].find((n) => n !== 0) ?? 1;
	return {
		position: quantizeVec3([position.x, position.y, position.z]),
		rotation: leading < 0 ? (quat.map((n) => (n === 0 ? 0 : -n)) as Quat) : quat,
	};
}

/** Any frame on the canonical grid — for placements entering a composition from outside. */
export function canonicalFrame(frame: Frame): Frame {
	return toFrame(toVector(frame.position), toQuaternion(frame.rotation));
}

/** A frame from a position and a rotation about one axis — the common authoring case. */
export function frameFromAxisAngle(position: Vec3, axis: Vec3, radians: number): Frame {
	return toFrame(toVector(position), new Quaternion().setFromAxisAngle(toVector(axis).normalize(), radians));
}

/** `inner` expressed in `outer`'s parent space: a port's world frame is `composeFrames(placement, port.frame)`. */
export function composeFrames(outer: Frame, inner: Frame): Frame {
	const rotation = toQuaternion(outer.rotation);
	const position = toVector(inner.position).applyQuaternion(rotation).add(toVector(outer.position));
	return toFrame(position, rotation.multiply(toQuaternion(inner.rotation)));
}

export function invertFrame(frame: Frame): Frame {
	const rotation = toQuaternion(frame.rotation).invert();
	return toFrame(toVector(frame.position).negate().applyQuaternion(rotation), rotation);
}

/** A point given in `frame`'s local space, in its parent space. */
export function transformPoint(frame: Frame, point: Vec3): Vec3 {
	return composeFrames(frame, { position: point, rotation: IDENTITY_FRAME.rotation }).position;
}

/** The frame's outward axis (local +Z) in its parent space. */
export function frameAxis(frame: Frame): Vec3 {
	const axis = new Vector3(0, 0, 1).applyQuaternion(toQuaternion(frame.rotation));
	return quantizeVec3([axis.x, axis.y, axis.z]);
}

/**
 * The placement that puts a product's port face to face with a fixed port: solves
 * `placement ∘ localPort = anchor ∘ FACE_TO_FACE` for `placement`.
 *
 * Under `free` clocking pass the product's `current` placement: the snap then turns it by the
 * smallest rotation that opposes the axes, keeping its twist about the port axis — otherwise
 * every snap would reset a peg or thread to the anchor's +Y.
 */
export function matedPlacement(anchor: Frame, localPort: Frame, current?: Frame): Frame {
	if (!current) {
		const facing = toFrame(toVector(anchor.position), toQuaternion(anchor.rotation).multiply(FACE_TO_FACE));
		return composeFrames(facing, invertFrame(localPort));
	}
	const port = composeFrames(current, localPort);
	const target = toVector(frameAxis(anchor)).negate();
	const turn = new Quaternion().setFromUnitVectors(toVector(frameAxis(port)), target);
	const facing = toFrame(toVector(anchor.position), turn.multiply(toQuaternion(port.rotation)));
	return composeFrames(facing, invertFrame(localPort));
}

/**
 * Whether two world port frames are mated: same origin, opposed axes, and — when clocking
 * is `fixed` — the same +Y. Under `free` clocking any turn about the shared axis holds.
 */
export function framesMate(a: Frame, b: Frame, clocking: 'fixed' | 'free'): boolean {
	if (toVector(a.position).distanceTo(toVector(b.position)) > MATE_TOLERANCE.position) return false;
	if (clocking === 'free') {
		const axisA = toVector(frameAxis(a));
		const axisB = toVector(frameAxis(b));
		// atan2 of |cross| over the opposition stays accurate near zero, where acos does not.
		return Math.atan2(axisA.clone().cross(axisB).length(), -axisA.dot(axisB)) <= MATE_TOLERANCE.angle;
	}
	return (
		rotationBetween(toQuaternion(a.rotation).multiply(FACE_TO_FACE), toQuaternion(b.rotation)) <= MATE_TOLERANCE.angle
	);
}

/** The angle of the rotation taking `from` to `to`, accurate for tiny angles. */
function rotationBetween(from: Quaternion, to: Quaternion): number {
	const delta = from.invert().multiply(to);
	return 2 * Math.atan2(Math.hypot(delta.x, delta.y, delta.z), Math.abs(delta.w));
}
