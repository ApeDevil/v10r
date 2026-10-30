/**
 * The engine-independent intermediate a generator produces: named primitives of indexed
 * triangles, each split into closed **shells** (one strut, one box), plus the material role
 * each primitive is drawn with. The inspector checks it and the GLB encoder writes it; neither
 * knows which generator — or which engine — made it.
 *
 * Every vertex a shell shares between faces is computed once and pushed by value, so welding
 * by exact position (what the shell check does) finds the shared edges without a tolerance.
 * Three.js is used for its `Vector3` arithmetic only.
 */
import { Vector3 } from 'three';
import type { Vec3 } from '#lib/schemas/product-composition.ts';

/** What a primitive is drawn as. The encoder maps a role to a glTF material; a viewer may restyle it by name. */
export type MaterialRole = 'structure' | 'hub' | 'module';

/** One closed surface inside a primitive: a contiguous run of triangles. */
export interface MeshShell {
	/** First index (not triangle) of the shell in the primitive's index array. */
	firstIndex: number;
	indexCount: number;
}

export interface MeshPrimitive {
	/** The glTF node and mesh name: stable, kebab-case. */
	name: string;
	material: MaterialRole;
	positions: Float32Array;
	normals: Float32Array;
	indices: Uint32Array;
	shells: readonly MeshShell[];
}

/** An axis-aligned box in metres. */
export interface MeshBounds {
	min: Vec3;
	max: Vec3;
}

/** Everything a generator hands on: primitives in a fixed order, and the box the geometry must stay inside. */
export interface GeneratedMesh {
	primitives: readonly MeshPrimitive[];
	/** Declared from the parameters alone; inspection fails geometry that leaves it. */
	envelope: MeshBounds;
}

/** Vertex and triangle counts, exact, known before a builder runs — what the budget gate compares. */
export interface MeshCost {
	vertices: number;
	triangles: number;
}

export const tubeCost = (segments: number): MeshCost => ({ vertices: 4 * segments + 2, triangles: 4 * segments });
export const BOX_COST: MeshCost = { vertices: 24, triangles: 12 };

/** Accumulates one primitive. Not reusable after `build()`. */
export class MeshBuilder {
	readonly #positions: number[] = [];
	readonly #normals: number[] = [];
	readonly #indices: number[] = [];
	readonly #shells: MeshShell[] = [];

	readonly name: string;
	readonly material: MaterialRole;

	// Plain fields, not parameter properties: the core stays runnable by Node's type stripping.
	constructor(name: string, material: MaterialRole) {
		this.name = name;
		this.material = material;
	}

	#vertex(position: Vector3, normal: Vector3): number {
		this.#positions.push(position.x, position.y, position.z);
		this.#normals.push(normal.x, normal.y, normal.z);
		return this.#positions.length / 3 - 1;
	}

	#shell(build: () => void) {
		const firstIndex = this.#indices.length;
		build();
		this.#shells.push({ firstIndex, indexCount: this.#indices.length - firstIndex });
	}

	/**
	 * A closed round member from `a` to `b`: a side wall of `segments` facets and two flat caps.
	 * The facet basis is derived from the axis alone, so the same two points always give the
	 * same vertices.
	 */
	tube(a: Vector3, b: Vector3, radius: number, segments: number) {
		const axis = b.clone().sub(a).normalize();
		const reference = Math.abs(axis.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
		const u = new Vector3().crossVectors(axis, reference).normalize();
		const w = new Vector3().crossVectors(axis, u);
		const directions: Vector3[] = [];
		for (let k = 0; k < segments; k++) {
			const angle = (2 * Math.PI * k) / segments;
			directions.push(u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(w, Math.sin(angle)));
		}
		const ringA = directions.map((d) => a.clone().addScaledVector(d, radius));
		const ringB = directions.map((d) => b.clone().addScaledVector(d, radius));

		this.#shell(() => {
			const sideA = directions.map((d, k) => this.#vertex(ringA[k], d));
			const sideB = directions.map((d, k) => this.#vertex(ringB[k], d));
			for (let k = 0; k < segments; k++) {
				const next = (k + 1) % segments;
				this.#indices.push(sideA[k], sideB[next], sideB[k], sideA[k], sideA[next], sideB[next]);
			}
			const back = axis.clone().negate();
			const capA = this.#vertex(a, back);
			const rimA = ringA.map((p) => this.#vertex(p, back));
			const capB = this.#vertex(b, axis);
			const rimB = ringB.map((p) => this.#vertex(p, axis));
			for (let k = 0; k < segments; k++) {
				const next = (k + 1) % segments;
				this.#indices.push(capA, rimA[next], rimA[k], capB, rimB[k], rimB[next]);
			}
		});
	}

	/**
	 * A closed box at `center` whose faces lie on the orthonormal, right-handed `axes`, `half`
	 * the extent along each. The eight corners are computed once, so faces share exact positions.
	 */
	box(center: Vector3, axes: readonly [Vector3, Vector3, Vector3], half: Vec3) {
		const corner = new Map<string, Vector3>();
		const at = (signs: [number, number, number]) => {
			const key = signs.join();
			let point = corner.get(key);
			if (!point) {
				point = center.clone();
				for (let i = 0; i < 3; i++) point.addScaledVector(axes[i], signs[i] * half[i]);
				corner.set(key, point);
			}
			return point;
		};
		this.#shell(() => {
			for (let axis = 0; axis < 3; axis++) {
				for (const sign of [1, -1]) {
					const normal = axes[axis].clone().multiplyScalar(sign);
					const i1 = (axis + 1) % 3;
					const i2 = (axis + 2) % 3;
					// Tangents t1 = axes[i1] and t2 = sign · axes[i2] satisfy t1 × t2 = normal, so
					// this corner order winds anticlockwise seen from outside.
					const ids = [
						[-1, -1],
						[1, -1],
						[1, 1],
						[-1, 1],
					].map(([s1, s2]) => {
						const signs: [number, number, number] = [0, 0, 0];
						signs[axis] = sign;
						signs[i1] = s1;
						signs[i2] = sign * s2;
						return this.#vertex(at(signs), normal);
					});
					this.#indices.push(ids[0], ids[1], ids[2], ids[0], ids[2], ids[3]);
				}
			}
		});
	}

	build(): MeshPrimitive {
		return {
			name: this.name,
			material: this.material,
			positions: Float32Array.from(this.#positions),
			normals: Float32Array.from(this.#normals),
			indices: Uint32Array.from(this.#indices),
			shells: [...this.#shells],
		};
	}
}
