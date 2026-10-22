/**
 * A conduit's polyline as a tube: straight runs joined by a rounded corner at each waypoint.
 *
 * Neither obvious alternative fits a pipe. A `CatmullRomCurve3` through the points overshoots
 * near the ends and bulges between them; a `CurvePath` of bare `LineCurve3`s pinches at every
 * corner, because `TubeGeometry` samples evenly by arc length and cuts across the joint. A
 * quadratic Bézier per corner, with the corner as its control point, keeps every straight run
 * straight and every bend smooth.
 */
import { CurvePath, LineCurve3, QuadraticBezierCurve3, TubeGeometry, Vector3 } from 'three';
import type { Vec3 } from '$lib/product-composition';

/** Tube radius and the largest corner radius, in metres. */
export const CONDUIT_TUBE = { radius: 0.012, bend: 0.05 } as const;

/** Straight runs with a fillet of at most `bend` at each interior point; `undefined` under two points. */
export function filletedPath(
	points: readonly Vec3[],
	bend: number = CONDUIT_TUBE.bend,
): CurvePath<Vector3> | undefined {
	if (points.length < 2) return undefined;
	const vectors = points.map((point) => new Vector3(...point));
	const path = new CurvePath<Vector3>();
	let cursor = vectors[0];
	for (let index = 1; index < vectors.length - 1; index++) {
		const [before, corner, after] = [vectors[index - 1], vectors[index], vectors[index + 1]];
		// Never round off more than half of either neighbouring run, so fillets cannot overlap.
		const radius = Math.min(bend, corner.distanceTo(before) / 2, corner.distanceTo(after) / 2);
		const start = corner.clone().addScaledVector(before.clone().sub(corner).normalize(), radius);
		const end = corner.clone().addScaledVector(after.clone().sub(corner).normalize(), radius);
		if (!start.equals(cursor)) path.add(new LineCurve3(cursor, start));
		path.add(new QuadraticBezierCurve3(start, corner, end));
		cursor = end;
	}
	path.add(new LineCurve3(cursor, vectors[vectors.length - 1]));
	return path;
}

/** The tube to draw. The caller owns it and must `dispose()` it when replaced — the GC never frees GPU buffers. */
export function conduitTube(points: readonly Vec3[]): TubeGeometry | undefined {
	const path = filletedPath(points);
	if (!path) return undefined;
	const segments = Math.min(400, Math.max(16, Math.ceil(path.getLength() / 0.01)));
	return new TubeGeometry(path, segments, CONDUIT_TUBE.radius, 8, false);
}
