/**
 * The Three.js geometry a composition primitive draws as, shared by every occurrence of the
 * same shape: a scene with eight radiators builds each fin once.
 *
 * Geometries are cached by their dimensions and never disposed: the cache grows with the
 * number of distinct shapes the page has drawn, not with edits — moving a product reuses its
 * geometry, and a fixture's shapes are fixed.
 */
import { BoxGeometry, type BufferGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Primitive } from '#lib/product-composition/index.ts';

const cache = new Map<string, BufferGeometry>();

/** Finer round shapes where they are large enough for facets to show. */
const roundSegments = (radius: number) => (radius > 0.08 ? 48 : radius > 0.02 ? 32 : 16);

function build(primitive: Primitive): BufferGeometry {
	switch (primitive.shape) {
		case 'box': {
			const [width, height, depth] = primitive.size;
			if (!primitive.radius) return new BoxGeometry(width, height, depth);
			// A radius of half the thinnest side or more would turn the box inside out.
			const radius = Math.min(primitive.radius, Math.min(width, height, depth) / 2 - 1e-4);
			return new RoundedBoxGeometry(width, height, depth, 3, radius);
		}
		case 'cylinder':
			return new CylinderGeometry(
				primitive.radius,
				primitive.radius,
				primitive.length,
				roundSegments(primitive.radius),
			);
		case 'sphere':
			return new SphereGeometry(primitive.radius, roundSegments(primitive.radius), 24);
		case 'torus':
			return new TorusGeometry(primitive.radius, primitive.tube, 12, roundSegments(primitive.radius));
	}
}

const keyOf = (primitive: Primitive): string => {
	switch (primitive.shape) {
		case 'box':
			return `box:${primitive.size.join(',')}:${primitive.radius ?? 0}`;
		case 'cylinder':
			return `cylinder:${primitive.radius}:${primitive.length}`;
		case 'sphere':
			return `sphere:${primitive.radius}`;
		case 'torus':
			return `torus:${primitive.radius}:${primitive.tube}`;
	}
};

export function primitiveGeometry(primitive: Primitive): BufferGeometry {
	const key = keyOf(primitive);
	let geometry = cache.get(key);
	if (!geometry) {
		geometry = build(primitive);
		cache.set(key, geometry);
	}
	return geometry;
}
