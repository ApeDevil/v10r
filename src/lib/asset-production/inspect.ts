/**
 * Geometry inspection: what a generated mesh is (counts, bounds, area, volume) and whether it
 * holds the checks every asset must pass before it is encoded. Findings are data.
 *
 * - every coordinate and normal finite, every index in range, no zero-area triangle;
 * - every shell closed — after welding by exact position each edge is used by exactly two
 *   triangles — and wound outward (positive signed volume);
 * - normals unit length; the mesh inside the envelope the generator declared up front.
 *
 * "Closed" is per shell: overlapping struts are separate closed shells, not one booleaned
 * solid. That is what rendering needs; a 3D-printing target would need a union (CSG) first.
 */
import type { Vec3 } from '#lib/schemas/product-composition.ts';
import { type AssetDiagnostic, assetDiagnostic } from './diagnostics.ts';
import type { GeneratedMesh, MeshBounds, MeshPrimitive } from './mesh.ts';

export interface PrimitiveInspection {
	name: string;
	material: string;
	vertices: number;
	triangles: number;
	shells: number;
	bounds: MeshBounds;
}

export interface MeshInspection {
	primitives: PrimitiveInspection[];
	vertices: number;
	triangles: number;
	shells: number;
	bounds: MeshBounds;
	/** Sum over shells, m². Overlaps are counted twice: it is a tessellation measure, not a paint area. */
	surfaceArea: number;
	/** Sum of shell volumes, m³, with the same caveat. */
	enclosedVolume: number;
}

const AREA_EPSILON = 1e-12;
const NORMAL_TOLERANCE = 1e-3;
const ENVELOPE_TOLERANCE = 1e-6;

function boundsOf(positions: Float32Array): MeshBounds {
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];
	for (let i = 0; i < positions.length; i += 3) {
		for (let axis = 0; axis < 3; axis++) {
			const value = positions[i + axis];
			if (value < min[axis]) min[axis] = value;
			if (value > max[axis]) max[axis] = value;
		}
	}
	return { min, max };
}

function inspectPrimitive(primitive: MeshPrimitive, findings: AssetDiagnostic[]) {
	const { positions, normals, indices, name } = primitive;
	const vertexCount = positions.length / 3;
	let nonFinite = 0;
	for (let i = 0; i < positions.length; i++) {
		if (!Number.isFinite(positions[i]) || !Number.isFinite(normals[i])) nonFinite++;
	}
	if (nonFinite > 0)
		findings.push(assetDiagnostic('mesh.non-finite', name, `${nonFinite} non-finite position or normal components.`));

	let badNormals = 0;
	for (let i = 0; i < normals.length; i += 3) {
		if (Math.abs(Math.hypot(normals[i], normals[i + 1], normals[i + 2]) - 1) > NORMAL_TOLERANCE) badNormals++;
	}
	if (badNormals > 0)
		findings.push(assetDiagnostic('mesh.normal-not-unit', name, `${badNormals} normals are not unit length.`));

	let outOfRange = 0;
	for (const index of indices) if (index >= vertexCount) outOfRange++;
	if (outOfRange > 0) {
		findings.push(
			assetDiagnostic('mesh.index-out-of-range', name, `${outOfRange} indices point past the last vertex.`),
		);
		return { area: 0, volume: 0 };
	}

	let degenerate = 0;
	let openShells = 0;
	let invertedShells = 0;
	let area = 0;
	let volume = 0;
	// Weld by the exact float32 bits of a position: shells share vertices by value, never by
	// tolerance. Hashed on the bits, compared exactly — a string key per vertex costs 5× more.
	const bits = new Uint32Array(positions.buffer, positions.byteOffset, positions.length);
	const welded = new Uint32Array(vertexCount);
	const buckets = new Map<number, number[]>();
	for (let v = 0; v < vertexCount; v++) {
		const x = bits[3 * v];
		const y = bits[3 * v + 1];
		const z = bits[3 * v + 2];
		const hash = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) >>> 0;
		const bucket = buckets.get(hash);
		const same = bucket?.find((u) => bits[3 * u] === x && bits[3 * u + 1] === y && bits[3 * u + 2] === z);
		if (same !== undefined) welded[v] = same;
		else {
			welded[v] = v;
			if (bucket) bucket.push(v);
			else buckets.set(hash, [v]);
		}
	}
	const countEdge = (edges: Map<number, number>, p: number, q: number) => {
		const wp = welded[p];
		const wq = welded[q];
		const edge = wp < wq ? wp * vertexCount + wq : wq * vertexCount + wp;
		edges.set(edge, (edges.get(edge) ?? 0) + 1);
	};

	for (const shell of primitive.shells) {
		const edges = new Map<number, number>();
		let shellVolume = 0;
		for (let t = shell.firstIndex; t < shell.firstIndex + shell.indexCount; t += 3) {
			const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
			const ax = positions[3 * a];
			const ay = positions[3 * a + 1];
			const az = positions[3 * a + 2];
			const ux = positions[3 * b] - ax;
			const uy = positions[3 * b + 1] - ay;
			const uz = positions[3 * b + 2] - az;
			const vx = positions[3 * c] - ax;
			const vy = positions[3 * c + 1] - ay;
			const vz = positions[3 * c + 2] - az;
			const nx = uy * vz - uz * vy;
			const ny = uz * vx - ux * vz;
			const nz = ux * vy - uy * vx;
			const triangleArea = Math.hypot(nx, ny, nz) / 2;
			if (triangleArea < AREA_EPSILON) degenerate++;
			area += triangleArea;
			// Divergence theorem: the signed tetrahedron to the origin, summed over a closed shell.
			shellVolume += (ax * nx + ay * ny + az * nz) / 6;
			countEdge(edges, a, b);
			countEdge(edges, b, c);
			countEdge(edges, c, a);
		}
		let open = false;
		for (const uses of edges.values()) {
			if (uses !== 2) {
				open = true;
				break;
			}
		}
		if (open) openShells++;
		else if (shellVolume <= 0) invertedShells++;
		volume += shellVolume;
	}

	if (degenerate > 0)
		findings.push(assetDiagnostic('mesh.degenerate-triangle', name, `${degenerate} triangles have no area.`));
	if (openShells > 0)
		findings.push(
			assetDiagnostic(
				'mesh.open-shell',
				name,
				`${openShells} shells have an edge not shared by exactly two triangles.`,
			),
		);
	if (invertedShells > 0)
		findings.push(assetDiagnostic('mesh.inverted-shell', name, `${invertedShells} shells are wound inward.`));
	return { area, volume };
}

export function inspectMesh(mesh: GeneratedMesh): { inspection: MeshInspection; diagnostics: AssetDiagnostic[] } {
	const diagnostics: AssetDiagnostic[] = [];
	const primitives: PrimitiveInspection[] = [];
	let surfaceArea = 0;
	let enclosedVolume = 0;
	const min: Vec3 = [Infinity, Infinity, Infinity];
	const max: Vec3 = [-Infinity, -Infinity, -Infinity];

	for (const primitive of mesh.primitives) {
		const measured = inspectPrimitive(primitive, diagnostics);
		surfaceArea += measured.area;
		enclosedVolume += measured.volume;
		const bounds = boundsOf(primitive.positions);
		for (let axis = 0; axis < 3; axis++) {
			min[axis] = Math.min(min[axis], bounds.min[axis]);
			max[axis] = Math.max(max[axis], bounds.max[axis]);
		}
		primitives.push({
			name: primitive.name,
			material: primitive.material,
			vertices: primitive.positions.length / 3,
			triangles: primitive.indices.length / 3,
			shells: primitive.shells.length,
			bounds,
		});
	}

	const triangles = primitives.reduce((sum, p) => sum + p.triangles, 0);
	if (triangles === 0) diagnostics.push(assetDiagnostic('mesh.empty', 'mesh', 'The generator produced no triangles.'));
	else {
		const outside = [0, 1, 2].some(
			(axis) =>
				min[axis] < mesh.envelope.min[axis] - ENVELOPE_TOLERANCE ||
				max[axis] > mesh.envelope.max[axis] + ENVELOPE_TOLERANCE,
		);
		if (outside)
			diagnostics.push(
				assetDiagnostic('mesh.outside-envelope', 'mesh', 'Geometry leaves the envelope the generator declared.'),
			);
	}

	return {
		inspection: {
			primitives,
			vertices: primitives.reduce((sum, p) => sum + p.vertices, 0),
			triangles,
			shells: primitives.reduce((sum, p) => sum + p.shells, 0),
			bounds: { min, max },
			surfaceArea,
			enclosedVolume,
		},
		diagnostics,
	};
}
