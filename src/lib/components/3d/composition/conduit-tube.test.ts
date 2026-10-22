import { LineCurve3, QuadraticBezierCurve3 } from 'three';
import { expect, test } from 'vitest';
import { CONDUIT_TUBE, conduitTube, filletedPath } from './conduit-tube';

test('straight runs stay straight; each corner becomes one fillet no longer than half a neighbouring run', () => {
	const path = filletedPath([
		[0, 0, 0],
		[1, 0, 0],
		[1, 0.06, 0],
		[2, 0.06, 0],
	]);
	expect(path?.curves.map((curve) => curve.constructor)).toEqual([
		LineCurve3,
		QuadraticBezierCurve3,
		QuadraticBezierCurve3,
		LineCurve3,
	]);
	// The 6 cm riser leaves room for two 3 cm fillets, not two of the default 5 cm.
	const [, first] = path?.curves as QuadraticBezierCurve3[];
	expect(first.v2.y).toBeCloseTo(0.03, 9);
	expect(first.v0.x).toBeCloseTo(1 - 0.03, 9);
	expect(CONDUIT_TUBE.bend).toBeGreaterThan(0.03);
});

test('fewer than two points draw nothing; a tube is built otherwise', () => {
	expect(conduitTube([[0, 0, 0]])).toBeUndefined();
	const tube = conduitTube([
		[0, 0, 0],
		[0, 1, 0],
	]);
	expect(tube?.parameters.radius).toBe(CONDUIT_TUBE.radius);
	tube?.dispose();
});
