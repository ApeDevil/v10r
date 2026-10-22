import { describe, expect, test } from 'vitest';
import type { Frame } from '../schemas/product-composition';
import {
	canonicalFrame,
	composeFrames,
	frameAxis,
	frameFromAxisAngle,
	framesMate,
	invertFrame,
	matedPlacement,
} from './frame';

const UP: [number, number, number] = [0, 1, 0];
/** A port on the right face of a 1 m cube, facing +X. */
const RIGHT_PORT = frameFromAxisAngle([0.5, 0, 0], UP, Math.PI / 2);
/** A port on the left face, facing -X. */
const LEFT_PORT = frameFromAxisAngle([-0.5, 0, 0], UP, -Math.PI / 2);

describe('matedPlacement', () => {
	test('puts the child port on the anchor, face to face, from any starting pose', () => {
		const parent = frameFromAxisAngle([2, 0.3, -1], [1, 1, 0], 0.7);
		const anchor = composeFrames(parent, RIGHT_PORT);

		const child = matedPlacement(anchor, LEFT_PORT);
		const childPort = composeFrames(child, LEFT_PORT);

		expect(framesMate(anchor, childPort, 'fixed')).toBe(true);
	});

	test("given the current placement, a free snap keeps the product's twist about the port axis", () => {
		const twisted = frameFromAxisAngle([3, 2, 1], [1, 0, 0], 0.4);
		const child = matedPlacement(RIGHT_PORT, LEFT_PORT, twisted);
		expect(framesMate(RIGHT_PORT, composeFrames(child, LEFT_PORT), 'free')).toBe(true);
		expect(framesMate(RIGHT_PORT, composeFrames(child, LEFT_PORT), 'fixed')).toBe(false);
		// The twist about the shared X axis survived: the product's +Z still leans the same way.
		for (const [actual, expected] of zip(frameAxis(child), frameAxis(twisted))) {
			expect(actual).toBeCloseTo(expected, 8);
		}
	});

	test('two cubes mated right-to-left sit side by side', () => {
		expect(matedPlacement(RIGHT_PORT, LEFT_PORT)).toEqual({ position: [1, 0, 0], rotation: [0, 0, 0, 1] });
	});
});

describe('framesMate', () => {
	const anchor = RIGHT_PORT;
	const mated = composeFrames(matedPlacement(anchor, LEFT_PORT), LEFT_PORT);
	/** The same mate, turned a quarter about the shared axis. */
	const turned = composeFrames(frameFromAxisAngle(mated.position, [1, 0, 0], Math.PI / 2), {
		position: [0, 0, 0],
		rotation: mated.rotation,
	});

	test('fixed clocking refuses a turn about the port axis; free clocking accepts it', () => {
		expect(framesMate(anchor, turned, 'fixed')).toBe(false);
		expect(framesMate(anchor, turned, 'free')).toBe(true);
	});

	test('a port facing the same way, or offset, is not mated', () => {
		const sameWay: Frame = { position: anchor.position, rotation: anchor.rotation };
		const offset: Frame = { position: [0.5, 0, 0.001], rotation: mated.rotation };
		expect(framesMate(anchor, sameWay, 'free')).toBe(false);
		expect(framesMate(anchor, offset, 'free')).toBe(false);
	});
});

test('frames are canonical: w ≥ 0, no -0, and invert ∘ compose returns to identity within the 1e-9 grid', () => {
	const frame = frameFromAxisAngle([0.1, -2, 3], [0, 0, 1], 5.5); // > π: the raw quaternion has w < 0
	expect(frame.rotation[3]).toBeGreaterThanOrEqual(0);

	const roundTrip = composeFrames(frame, invertFrame(frame));
	for (const [actual, expected] of zip([...roundTrip.position, ...roundTrip.rotation], [0, 0, 0, 0, 0, 0, 1])) {
		expect(Math.abs(actual - expected)).toBeLessThan(1e-8);
		expect(Object.is(actual, -0)).toBe(false);
	}
});

test('a half turn has one spelling: ±π, and a sign-flipped input, give the same bytes', () => {
	const plus = frameFromAxisAngle([0, 0, 0], UP, Math.PI);
	const minus = frameFromAxisAngle([0, 0, 0], UP, -Math.PI);
	expect(plus).toEqual({ position: [0, 0, 0], rotation: [0, 1, 0, 0] });
	expect(minus).toEqual(plus);
	expect(canonicalFrame({ position: [0, 0, 0], rotation: [0, -1, 0, 3e-10] })).toEqual(plus);
});

const zip = (a: number[], b: number[]) => a.map((value, index) => [value, b[index]] as const);
