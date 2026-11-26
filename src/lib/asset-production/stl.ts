/**
 * Binary STL for a `GeneratedMesh` — the mesh exchange format slicers read. STL carries no
 * units; by convention it is millimetres and +Z up, so this undoes the GLB convention (metres,
 * +Y up) the mesh is in. Byte-stable: the 80-byte header is fixed text, never a timestamp.
 *
 * An STL is a triangle soup. Whether it prints is not something the file can say: closed and
 * manifold (what the inspector checks) is necessary, wall thickness and overhangs are not checked.
 */
import type { GeneratedMesh } from './mesh.ts';

export const STL_MEDIA_TYPE = 'model/stl';

const HEADER = 'v10r asset production - binary STL, millimetres, +Z up';

export function encodeStl(mesh: GeneratedMesh): Uint8Array {
	const triangles = mesh.primitives.reduce((sum, primitive) => sum + primitive.indices.length / 3, 0);
	const bytes = new Uint8Array(84 + 50 * triangles);
	const view = new DataView(bytes.buffer);
	bytes.set(new TextEncoder().encode(HEADER).subarray(0, 80));
	view.setUint32(80, triangles, true);
	let offset = 84;
	// glTF (x, y, z) metres → STL (x, -z, y) millimetres.
	const put = (x: number, y: number, z: number) => {
		view.setFloat32(offset, x * 1000, true);
		view.setFloat32(offset + 4, -z * 1000, true);
		view.setFloat32(offset + 8, y * 1000, true);
		offset += 12;
	};
	for (const { positions, indices } of mesh.primitives) {
		for (let t = 0; t < indices.length; t += 3) {
			const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
			const ux = positions[3 * b] - positions[3 * a];
			const uy = positions[3 * b + 1] - positions[3 * a + 1];
			const uz = positions[3 * b + 2] - positions[3 * a + 2];
			const vx = positions[3 * c] - positions[3 * a];
			const vy = positions[3 * c + 1] - positions[3 * a + 1];
			const vz = positions[3 * c + 2] - positions[3 * a + 2];
			const nx = uy * vz - uz * vy;
			const ny = uz * vx - ux * vz;
			const nz = ux * vy - uy * vx;
			const length = Math.hypot(nx, ny, nz) || 1;
			view.setFloat32(offset, nx / length, true);
			view.setFloat32(offset + 4, -nz / length, true);
			view.setFloat32(offset + 8, ny / length, true);
			offset += 12;
			for (const vertex of [a, b, c]) put(positions[3 * vertex], positions[3 * vertex + 1], positions[3 * vertex + 2]);
			offset += 2; // attribute byte count: 0
		}
	}
	return bytes;
}
