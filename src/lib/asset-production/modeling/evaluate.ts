/**
 * Evaluate a resolved parametric model with the kernel: walk the feature graph in order, build
 * each operation from the ones it references, and turn every output into a mesh primitive the
 * asset production pipeline already knows how to inspect and encode.
 *
 * Bounded three ways: the resolver refused anything the estimate puts over budget; between
 * operations `checkpoint` stops a run at its deadline or on cancel; and after every operation
 * the real triangle count is checked against the budget, so a heuristic estimate cannot let an
 * oversized intermediate through. A single kernel call is not interruptible on the thread that
 * runs it — its inputs are bounded instead, and a browser runs evaluation in a Web Worker it can
 * terminate (see `docs/blueprint/3d/parametric-modeling.md` § Computational safety).
 *
 * Every kernel object is freed before returning: WebAssembly memory is not garbage collected.
 *
 * Axes: the model is +Z up (CAD); the mesh handed on is glTF's +Y up, in metres.
 */
import type { CrossSection, Manifold } from 'manifold-3d';
import { METRES_PER_UNIT, MODELING_LIMITS, type ModelMaterial } from '#lib/schemas/parametric-model.ts';
import { type AssetDiagnostic, assetDiagnostic } from '../diagnostics.ts';
import type { GeneratedMesh, MeshPrimitive, SolidFacts } from '../mesh.ts';
import { compileExpression } from './expression.ts';
import type { ModelingKernel } from './kernel.ts';
import type { ResolvedModel, ResolvedOperation } from './resolve.ts';

/** A model whose kernel run failed in a way the resolver could not foresee: an empty Boolean, a kernel status. */
export class ModelEvaluationError extends Error {
	/** The finding the engine reports for it (see the engine's catch). */
	readonly diagnostic: AssetDiagnostic;
	constructor(kind: 'empty' | 'kernel' | 'budget', subject: string, message: string) {
		super(message);
		const code =
			kind === 'empty' ? 'model.empty-result' : kind === 'budget' ? 'budget.triangles' : 'model.kernel-error';
		this.diagnostic = assetDiagnostic(code, subject, message);
	}
}

export interface EvaluateOptions {
	/** Throws to stop the run; called between operations and inside long callbacks. */
	checkpoint: () => void;
	/** Real triangles any single operation may produce. */
	maxTriangles: number;
}

type Vec3 = [number, number, number];
type ResolvedProfile = Extract<ResolvedOperation, { op: 'extrude' }>['profile'];

const DEFAULT_SEGMENTS = 32;
/** Normals across an edge sharper than this are split: crisp CAD edges, smooth curved faces. */
const CREASE_DEGREES = 40;
/**
 * Output tolerance relative to the component's extent: slivers and vertices closer than this
 * collapse. 1e-6 of a 100 mm part is 0.1 µm — below float32 resolution at that size, which is
 * exactly the point: the inspector welds float32 positions, so nothing finer may survive.
 */
const SIMPLIFY_TOLERANCE = 1e-6;

/** A profile with coincident and collinear outline points removed (they become slivers once extruded). */
function profile(kernel: ModelingKernel, shape: ResolvedProfile, track: <T extends { delete(): void }>(o: T) => T) {
	const section = rawProfile(kernel, shape, track);
	const box = section.bounds();
	const extent = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1]);
	return track(section.simplify(extent * SIMPLIFY_TOLERANCE));
}

function rawProfile(kernel: ModelingKernel, shape: ResolvedProfile, track: <T extends { delete(): void }>(o: T) => T) {
	const { CrossSection } = kernel;
	if (shape.shape === 'circle') return track(CrossSection.circle(shape.r, shape.segments ?? DEFAULT_SEGMENTS));
	if (shape.shape === 'polygon') return track(CrossSection.ofPolygons([shape.points as [number, number][]], 'NonZero'));
	const [w, h] = shape.size;
	const round = shape.round ?? 0;
	let section: CrossSection =
		round > 0
			? track(track(CrossSection.square([w - 2 * round, h - 2 * round], true)).offset(round, 'Round', 2, 32))
			: track(CrossSection.square([w, h], true));
	if (shape.center === false) section = track(section.translate([w / 2, h / 2]));
	return section;
}

const axisIndex = (axis: 'x' | 'y' | 'z' | undefined) => (axis === 'x' ? 0 : axis === 'y' ? 1 : 2);

/** A rotation of `degrees` about one axis, as the Euler triple `Manifold.rotate` takes. */
function aboutAxis(axis: 'x' | 'y' | 'z' | undefined, degrees: number): Vec3 {
	const rotation: Vec3 = [0, 0, 0];
	rotation[axisIndex(axis)] = degrees;
	return rotation;
}

/**
 * twist / taper / bend along `axis`, over the solid's own extent on that axis. Pure arithmetic
 * per vertex; the trigonometry here is JavaScript's (documented determinism caveat).
 */
function deformer(op: Extract<ResolvedOperation, { op: 'deform' }>, lo: number, hi: number) {
	const a = axisIndex(op.axis);
	const [u, w] = a === 2 ? [0, 1] : a === 1 ? [2, 0] : [1, 2];
	const length = hi - lo || 1;
	return (vert: Vec3) => {
		const t = (vert[a] - lo) / length;
		if (op.kind === 'twist') {
			const angle = ((op.amount * Math.PI) / 180) * t;
			const cu = vert[u];
			const cw = vert[w];
			vert[u] = cu * Math.cos(angle) - cw * Math.sin(angle);
			vert[w] = cu * Math.sin(angle) + cw * Math.cos(angle);
		} else if (op.kind === 'taper') {
			const factor = 1 + (op.amount - 1) * t;
			vert[u] *= factor;
			vert[w] *= factor;
		} else {
			const total = (op.amount * Math.PI) / 180;
			if (total === 0) return;
			const radius = length / total;
			const angle = total * t;
			const offset = radius - vert[u];
			vert[u] = radius - offset * Math.cos(angle);
			vert[a] = lo + offset * Math.sin(angle);
		}
	};
}

/** Polynomial smooth minimum: arithmetic only, so the blend is bit-stable across engines. */
function smoothMin(a: number, b: number, k: number) {
	const h = Math.max(k - Math.abs(a - b), 0) / k;
	return Math.min(a, b) - (h * h * k) / 4;
}

interface Component {
	name: string;
	material: ModelMaterial;
	solid: Manifold;
}

/** Evaluate `model`. Throws `ModelEvaluationError` for a model the kernel cannot build. */
export function evaluateModel(kernel: ModelingKernel, model: ResolvedModel, options: EvaluateOptions): GeneratedMesh {
	const owned: { delete(): void }[] = [];
	const track = <T extends { delete(): void }>(object: T): T => {
		owned.push(object);
		return object;
	};
	const built = new Map<string, Manifold>();
	const materials = new Map<string, ModelMaterial>();

	try {
		for (const op of model.operations) {
			options.checkpoint();
			let solid = buildOperation(kernel, op, built, track, options, model.parameters);
			if (op.scale !== undefined) solid = track(solid.scale(typeof op.scale === 'number' ? op.scale : op.scale));
			if (op.rotate) solid = track(solid.rotate(op.rotate as Vec3));
			if (op.at) solid = track(solid.translate(op.at as Vec3));
			const status = solid.status();
			if (status !== 'NoError') throw new ModelEvaluationError('kernel', op.id, `the kernel reported ${status}.`);
			const triangles = solid.numTri();
			if (triangles > options.maxTriangles) {
				throw new ModelEvaluationError(
					'budget',
					op.id,
					`"${op.id}" produced ${triangles} triangles; this environment allows ${options.maxTriangles}.`,
				);
			}
			built.set(op.id, solid);
			if (op.material) materials.set(op.id, op.material);
		}

		const components: Component[] = model.outputs.map((id) => {
			// `simplify` collapses the zero-area slivers some kernel operations leave (a twisted
			// extrusion's cap): valid in a manifold, refused by the asset inspector.
			const raw = built.get(id) as Manifold;
			const box = raw.boundingBox();
			const extent = Math.max(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]);
			const solid = track(raw.simplify(Math.max(extent * SIMPLIFY_TOLERANCE, 0)));
			if (solid.isEmpty()) throw new ModelEvaluationError('empty', id, `output "${id}" is empty.`);
			return { name: id, material: materials.get(id) ?? 'plastic', solid };
		});
		return toGeneratedMesh(components, model.units, options);
	} finally {
		for (const object of owned) object.delete();
	}
}

function buildOperation(
	kernel: ModelingKernel,
	op: ResolvedOperation,
	built: Map<string, Manifold>,
	track: <T extends { delete(): void }>(o: T) => T,
	options: EvaluateOptions,
	parameters: Record<string, number>,
): Manifold {
	const { Manifold } = kernel;
	const get = (id: string) => built.get(id) as Manifold;
	switch (op.op) {
		case 'box':
			return track(Manifold.cube(op.size as Vec3, op.center ?? true));
		case 'sphere':
			return track(Manifold.sphere(op.r, op.segments ?? DEFAULT_SEGMENTS));
		case 'cylinder':
			return track(Manifold.cylinder(op.h, op.r, op.r2 ?? op.r, op.segments ?? DEFAULT_SEGMENTS, op.center ?? true));
		case 'torus': {
			const tube = track(track(kernel.CrossSection.circle(op.r, op.sides ?? 16)).translate([op.R, 0]));
			return track(tube.revolve(op.segments ?? DEFAULT_SEGMENTS));
		}
		case 'extrude':
			return track(
				profile(kernel, op.profile, track).extrude(
					op.h,
					op.divisions ?? (op.twist ? 16 : 0),
					op.twist ?? 0,
					// As a pair: the binding reads a bare number as [n, 0] (measured — a wedge).
					[op.scaleTop ?? 1, op.scaleTop ?? 1],
					op.center ?? false,
				),
			);
		case 'revolve':
			return track(profile(kernel, op.profile, track).revolve(op.segments ?? DEFAULT_SEGMENTS, op.angle ?? 360));
		case 'union':
			return track(Manifold.union(op.of.map(get)));
		case 'intersect':
			return track(Manifold.intersection(op.of.map(get)));
		case 'hull':
			return track(Manifold.hull(op.of.map(get)));
		case 'subtract': {
			const removed = op.remove.length === 1 ? get(op.remove[0]) : track(Manifold.union(op.remove.map(get)));
			return track(get(op.from).subtract(removed));
		}
		case 'transform':
			return get(op.of);
		case 'mirror': {
			const mirrored = track(get(op.of).mirror(op.normal as Vec3));
			return op.keep === false ? mirrored : track(Manifold.union(get(op.of), mirrored));
		}
		case 'pattern.linear': {
			const copies = Array.from({ length: op.count }, (_, i) =>
				track(get(op.of).translate([op.step[0] * i, op.step[1] * i, op.step[2] * i])),
			);
			return track(Manifold.union(copies));
		}
		case 'pattern.radial': {
			const sweep = op.angle ?? 360;
			const step = sweep >= 360 || op.count === 1 ? sweep / op.count : sweep / (op.count - 1);
			const copies = Array.from({ length: op.count }, (_, i) => track(get(op.of).rotate(aboutAxis(op.axis, step * i))));
			return track(Manifold.union(copies));
		}
		case 'heightfield': {
			const height = compileExpression(op.z, parameters, ['x', 'y']);
			const [w, d] = op.size;
			const resolution = op.resolution ?? 32;
			// A unit-high slab subdivided n × n per face; the top follows z(x, y), the sides stretch.
			const slab = track(track(Manifold.cube([w, d, 1], false)).translate([-w / 2, -d / 2, 0]));
			const fine = track(slab.refine(resolution));
			let invalid = false;
			let calls = 0;
			const warped = track(
				fine.warp((vert) => {
					if (++calls % 4096 === 0) options.checkpoint();
					const top = height({ x: vert[0], y: vert[1] });
					if (!Number.isFinite(top) || top <= -op.base) invalid = true;
					vert[2] = -op.base + vert[2] * (op.base + top);
				}),
			);
			if (invalid) {
				throw new ModelEvaluationError(
					'kernel',
					op.id,
					'the surface is not finite or dips below the base everywhere it must stay above.',
				);
			}
			return warped;
		}
		case 'blend': {
			const pad = op.k;
			const lo: Vec3 = [Infinity, Infinity, Infinity];
			const hi: Vec3 = [-Infinity, -Infinity, -Infinity];
			for (const [x, y, z, r] of op.spheres) {
				[x, y, z].forEach((c, i) => {
					lo[i] = Math.min(lo[i], c - r - pad);
					hi[i] = Math.max(hi[i], c + r + pad);
				});
			}
			const extent = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]);
			const edge = extent / (op.resolution ?? 48);
			let calls = 0;
			const sdf = (p: Vec3) => {
				if (++calls % 16384 === 0) options.checkpoint();
				let distance = Infinity;
				for (const [x, y, z, r] of op.spheres) {
					const d = Math.sqrt((p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2) - r;
					distance = distance === Infinity ? d : smoothMin(distance, d, op.k);
				}
				return -distance;
			};
			return track(Manifold.levelSet(sdf, { min: lo, max: hi }, edge));
		}
		case 'smooth':
			return track(track(get(op.of).smoothOut(op.sharpAngle ?? 60)).refine(op.refine));
		case 'deform': {
			const source = op.refine ? track(get(op.of).refine(op.refine)) : get(op.of);
			const box = source.boundingBox();
			const a = axisIndex(op.axis);
			return track(source.warp(deformer(op, box.min[a], box.max[a])));
		}
	}
}

/** Kernel output → glTF-ready primitives: metres, +Y up, split normals at creases. */
function toGeneratedMesh(
	components: Component[],
	units: ResolvedModel['units'],
	_options: EvaluateOptions,
): GeneratedMesh {
	const scale = METRES_PER_UNIT[units];
	const primitives: MeshPrimitive[] = [];
	const solids: SolidFacts[] = [];
	for (const component of components) {
		const mesh = component.solid.getMesh();
		const stride = mesh.numProp;
		const vertexCount = mesh.vertProperties.length / stride;
		// Model (x, y, z) Z-up → glTF (x, z, -y) Y-up, in metres. `+ 0` turns -0 into 0: the
		// inspector welds by exact bits, and -0 and 0 are different bits at the same place.
		const positions = new Float64Array(vertexCount * 3);
		for (let v = 0; v < vertexCount; v++) {
			positions[3 * v] = mesh.vertProperties[stride * v] * scale + 0;
			positions[3 * v + 1] = mesh.vertProperties[stride * v + 2] * scale + 0;
			positions[3 * v + 2] = -mesh.vertProperties[stride * v + 1] * scale + 0;
		}
		const triangles = flipDegenerateTriangles(positions, collapseZeroEdges(positions, Uint32Array.from(mesh.triVerts)));
		primitives.push(splitNormals(component.name, component.material, positions, triangles));
		const box = component.solid.boundingBox();
		solids.push({
			name: component.name,
			closedManifold: component.solid.status() === 'NoError' && !component.solid.isEmpty(),
			genus: component.solid.genus(),
			volume: component.solid.volume(),
			surfaceArea: component.solid.surfaceArea(),
			bounds: { min: [...box.min] as Vec3, max: [...box.max] as Vec3 },
		});
	}
	const reach = MODELING_LIMITS.maxExtentMetres;
	return {
		primitives,
		envelope: { min: [-reach, -reach, -reach], max: [reach, reach, reach] },
		solids,
	};
}

/**
 * One vertex per (position, smoothing group): a corner takes the area-weighted normal of the
 * faces around its position that lie within `CREASE_DEGREES` of its own face. Positions are
 * copied by value, so the inspector's exact-position weld still finds every shared edge.
 */
function splitNormals(
	name: string,
	material: ModelMaterial,
	positions: Float64Array,
	triangles: Uint32Array,
): MeshPrimitive {
	const faceCount = triangles.length / 3;
	const faceNormals = new Float64Array(faceCount * 3);
	const incident: number[][] = Array.from({ length: positions.length / 3 }, () => []);
	for (let f = 0; f < faceCount; f++) {
		const [a, b, c] = [triangles[3 * f], triangles[3 * f + 1], triangles[3 * f + 2]];
		const ux = positions[3 * b] - positions[3 * a];
		const uy = positions[3 * b + 1] - positions[3 * a + 1];
		const uz = positions[3 * b + 2] - positions[3 * a + 2];
		const vx = positions[3 * c] - positions[3 * a];
		const vy = positions[3 * c + 1] - positions[3 * a + 1];
		const vz = positions[3 * c + 2] - positions[3 * a + 2];
		// Unnormalised: its length is twice the area, which is the weight.
		faceNormals[3 * f] = uy * vz - uz * vy;
		faceNormals[3 * f + 1] = uz * vx - ux * vz;
		faceNormals[3 * f + 2] = ux * vy - uy * vx;
		incident[a].push(f);
		incident[b].push(f);
		incident[c].push(f);
	}
	const cosCrease = Math.cos((CREASE_DEGREES * Math.PI) / 180);
	const unit = (f: number) => {
		const length = Math.hypot(faceNormals[3 * f], faceNormals[3 * f + 1], faceNormals[3 * f + 2]) || 1;
		return [faceNormals[3 * f] / length, faceNormals[3 * f + 1] / length, faceNormals[3 * f + 2] / length];
	};
	const outPositions: number[] = [];
	const outNormals: number[] = [];
	const topology: number[] = [];
	const indices = new Uint32Array(triangles.length);
	const groups = new Map<string, number>();
	for (let f = 0; f < faceCount; f++) {
		const own = unit(f);
		for (let corner = 0; corner < 3; corner++) {
			const vertex = triangles[3 * f + corner];
			let nx = 0;
			let ny = 0;
			let nz = 0;
			const members: number[] = [];
			for (const other of incident[vertex]) {
				const n = unit(other);
				if (n[0] * own[0] + n[1] * own[1] + n[2] * own[2] >= cosCrease) {
					nx += faceNormals[3 * other];
					ny += faceNormals[3 * other + 1];
					nz += faceNormals[3 * other + 2];
					members.push(other);
				}
			}
			if (Math.hypot(nx, ny, nz) === 0) {
				// A sliver's corner: borrow the normal of every face around the vertex.
				for (const other of incident[vertex]) {
					nx += faceNormals[3 * other];
					ny += faceNormals[3 * other + 1];
					nz += faceNormals[3 * other + 2];
				}
			}
			const length = Math.hypot(nx, ny, nz) || 1;
			const key = `${vertex}:${members.join(',')}`;
			let index = groups.get(key);
			if (index === undefined) {
				index = outPositions.length / 3;
				groups.set(key, index);
				outPositions.push(positions[3 * vertex], positions[3 * vertex + 1], positions[3 * vertex + 2]);
				outNormals.push(nx / length, ny / length, nz / length);
				topology.push(vertex);
			}
			indices[3 * f + corner] = index;
		}
	}
	return {
		name,
		material,
		positions: Float32Array.from(outPositions),
		normals: Float32Array.from(outNormals),
		indices,
		shells: [{ firstIndex: 0, indexCount: indices.length }],
		topology: Uint32Array.from(topology),
	};
}

/**
 * A kernel may triangulate a face with collinear vertices into zero-area slivers: legal in a
 * manifold, refused by the asset inspector (and useless to a renderer). Each sliver (a, b, c)
 * with c on the segment ab is removed by flipping its longest edge with the neighbour across it:
 * (a, b, c) + (b, a, d) → (c, a, d) + (c, d, b). Topology and position are unchanged; the face is
 * re-triangulated. Bounded: each pass flips at most once per triangle, a few passes suffice.
 */
function flipDegenerateTriangles(positions: Float64Array, triangles: Uint32Array): Uint32Array {
	const t = triangles;
	const area2 = (a: number, b: number, c: number) => {
		const ux = positions[3 * b] - positions[3 * a];
		const uy = positions[3 * b + 1] - positions[3 * a + 1];
		const uz = positions[3 * b + 2] - positions[3 * a + 2];
		const vx = positions[3 * c] - positions[3 * a];
		const vy = positions[3 * c + 1] - positions[3 * a + 1];
		const vz = positions[3 * c + 2] - positions[3 * a + 2];
		return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
	};
	const length2 = (a: number, b: number) =>
		(positions[3 * a] - positions[3 * b]) ** 2 +
		(positions[3 * a + 1] - positions[3 * b + 1]) ** 2 +
		(positions[3 * a + 2] - positions[3 * b + 2]) ** 2;
	// Twice the inspector's zero-area threshold (1e-12 m²): what it would refuse, this re-triangulates.
	const epsilon = 2e-12;
	for (let pass = 0; pass < 8; pass++) {
		const edgeOwner = new Map<string, number>();
		for (let f = 0; f < t.length / 3; f++) {
			for (let k = 0; k < 3; k++) edgeOwner.set(`${t[3 * f + k]},${t[3 * f + ((k + 1) % 3)]}`, f);
		}
		let flipped = 0;
		for (let f = 0; f < t.length / 3; f++) {
			const v = [t[3 * f], t[3 * f + 1], t[3 * f + 2]];
			if (area2(v[0], v[1], v[2]) > epsilon) continue;
			// The longest edge (a → b) is the one the third vertex lies on.
			let k = 0;
			for (let j = 1; j < 3; j++) if (length2(v[j], v[(j + 1) % 3]) > length2(v[k], v[(k + 1) % 3])) k = j;
			const a = v[k];
			const b = v[(k + 1) % 3];
			const c = v[(k + 2) % 3];
			const g = edgeOwner.get(`${b},${a}`);
			if (g === undefined || g === f) continue;
			const w = [t[3 * g], t[3 * g + 1], t[3 * g + 2]];
			const d = w.find((x) => x !== a && x !== b);
			// A flip that would duplicate an existing edge c–d would make the mesh non-manifold.
			if (d === undefined || d === c || edgeOwner.has(`${c},${d}`) || edgeOwner.has(`${d},${c}`)) continue;
			t.set([c, a, d], 3 * f);
			t.set([c, d, b], 3 * g);
			for (const face of [f, g]) {
				for (let j = 0; j < 3; j++) edgeOwner.set(`${t[3 * face + j]},${t[3 * face + ((j + 1) % 3)]}`, face);
			}
			flipped++;
		}
		if (flipped === 0) break;
	}
	return t;
}

/**
 * Collapse edges whose two kernel vertices land on the same float32 position (the GLB stores
 * float32): the two triangles on such an edge have no area. The collapse merges the second
 * vertex into the first and drops those two triangles — but only when the link condition holds
 * (the two vertices share exactly the two opposite neighbours), so the result stays manifold.
 */
function collapseZeroEdges(positions: Float64Array, triangles: Uint32Array): Uint32Array {
	const same = (a: number, b: number) =>
		Math.fround(positions[3 * a]) === Math.fround(positions[3 * b]) &&
		Math.fround(positions[3 * a + 1]) === Math.fround(positions[3 * b + 1]) &&
		Math.fround(positions[3 * a + 2]) === Math.fround(positions[3 * b + 2]);
	let faces = Array.from(triangles);
	for (let pass = 0; pass < 4; pass++) {
		let collapsed = false;
		const neighbours = new Map<number, Set<number>>();
		const link = (a: number, b: number) => {
			let set = neighbours.get(a);
			if (!set) {
				set = new Set();
				neighbours.set(a, set);
			}
			set.add(b);
		};
		for (let f = 0; f < faces.length; f += 3) {
			for (let k = 0; k < 3; k++) {
				link(faces[f + k], faces[f + ((k + 1) % 3)]);
				link(faces[f + ((k + 1) % 3)], faces[f + k]);
			}
		}
		const merged = new Map<number, number>();
		const touched = new Set<number>();
		for (let f = 0; f < faces.length; f += 3) {
			for (let k = 0; k < 3; k++) {
				const a = faces[f + k];
				const b = faces[f + ((k + 1) % 3)];
				if (a === b || touched.has(a) || touched.has(b) || !same(a, b)) continue;
				const common = [...(neighbours.get(a) ?? [])].filter((n) => neighbours.get(b)?.has(n));
				if (common.length !== 2) continue;
				merged.set(b, a);
				for (const n of [a, b, ...common]) touched.add(n);
				collapsed = true;
			}
		}
		if (!collapsed) break;
		const next: number[] = [];
		for (let f = 0; f < faces.length; f += 3) {
			const v = [0, 1, 2].map((k) => merged.get(faces[f + k]) ?? faces[f + k]);
			if (v[0] !== v[1] && v[1] !== v[2] && v[0] !== v[2]) next.push(...v);
		}
		faces = next;
	}
	return Uint32Array.from(faces);
}
