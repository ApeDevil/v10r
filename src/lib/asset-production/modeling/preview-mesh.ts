/**
 * A compact preview of a mesh for an embedded viewer that cannot run the kernel itself (an MCP
 * App inside a host whose sandbox admits no WebAssembly): positions welded by exact value and
 * quantized to 16 bits inside each primitive's bounding box, indices at 16 or 32 bits, each
 * array deflated and base64-encoded. About a fifth of the GLB, because normals are not sent —
 * the viewer rebuilds creased normals.
 *
 * It is a preview, and says so: quantization moves a vertex by at most half a step of its
 * primitive's extent / 65 535. Downloads are the exact GLB or STL, never this.
 */
import { deflateSync, inflateSync } from 'fflate';
import type { GeneratedMesh } from '../mesh.ts';

export const PREVIEW_MESH_FORMAT = 'v10r-preview-mesh@1';

export interface PreviewPrimitive {
	name: string;
	material: string;
	/** Bounds the 16-bit positions are relative to, metres, glTF axes. */
	min: [number, number, number];
	max: [number, number, number];
	vertexCount: number;
	indexCount: number;
	/** base64 of deflate(Uint16Array positions). */
	positions: string;
	/** base64 of deflate(Uint16Array | Uint32Array indices). */
	indices: string;
	indexBits: 16 | 32;
}

export interface PreviewMesh {
	format: typeof PREVIEW_MESH_FORMAT;
	primitives: PreviewPrimitive[];
}

const toBase64 = (bytes: Uint8Array) => {
	let binary = '';
	for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(binary);
};
const fromBase64 = (text: string) => Uint8Array.from(atob(text), (char) => char.charCodeAt(0));

export function encodePreviewMesh(mesh: GeneratedMesh): PreviewMesh {
	const primitives = mesh.primitives.map((primitive): PreviewPrimitive => {
		const { positions, indices } = primitive;
		const bits = new Uint32Array(positions.buffer, positions.byteOffset, positions.length);
		const welded = new Map<string, number>();
		const remap = new Uint32Array(positions.length / 3);
		const unique: number[] = [];
		for (let v = 0; v < remap.length; v++) {
			const key = `${bits[3 * v]},${bits[3 * v + 1]},${bits[3 * v + 2]}`;
			let index = welded.get(key);
			if (index === undefined) {
				index = unique.length / 3;
				welded.set(key, index);
				unique.push(positions[3 * v], positions[3 * v + 1], positions[3 * v + 2]);
			}
			remap[v] = index;
		}
		const min: [number, number, number] = [Infinity, Infinity, Infinity];
		const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
		for (let i = 0; i < unique.length; i++) {
			min[i % 3] = Math.min(min[i % 3], unique[i]);
			max[i % 3] = Math.max(max[i % 3], unique[i]);
		}
		const quantized = new Uint16Array(unique.length);
		for (let i = 0; i < unique.length; i++) {
			const span = max[i % 3] - min[i % 3];
			quantized[i] = span > 0 ? Math.round(((unique[i] - min[i % 3]) / span) * 65535) : 0;
		}
		const vertexCount = unique.length / 3;
		const indexBits = vertexCount <= 0xffff ? 16 : 32;
		const mapped = Uint32Array.from(indices, (index) => remap[index]);
		const indexArray = indexBits === 16 ? Uint16Array.from(mapped) : mapped;
		return {
			name: primitive.name,
			material: primitive.material,
			min,
			max,
			vertexCount,
			indexCount: indices.length,
			positions: toBase64(deflateSync(new Uint8Array(quantized.buffer), { level: 9 })),
			indices: toBase64(deflateSync(new Uint8Array(indexArray.buffer), { level: 9 })),
			indexBits,
		};
	});
	return { format: PREVIEW_MESH_FORMAT, primitives };
}

/** Positions (metres) and indices of one preview primitive, for a renderer. */
export function decodePreviewPrimitive(primitive: PreviewPrimitive): { positions: Float32Array; indices: Uint32Array } {
	const quantized = new Uint16Array(inflateSync(fromBase64(primitive.positions)).slice().buffer);
	const raw = inflateSync(fromBase64(primitive.indices)).slice().buffer;
	const indices = primitive.indexBits === 16 ? Uint32Array.from(new Uint16Array(raw)) : new Uint32Array(raw);
	if (quantized.length !== primitive.vertexCount * 3 || indices.length !== primitive.indexCount) {
		throw new RangeError('preview mesh arrays do not match their declared counts');
	}
	const positions = new Float32Array(quantized.length);
	for (let i = 0; i < quantized.length; i++) {
		const axis = i % 3;
		positions[i] = primitive.min[axis] + (quantized[i] / 65535) * (primitive.max[axis] - primitive.min[axis]);
	}
	for (const index of indices) if (index >= primitive.vertexCount) throw new RangeError('preview index out of range');
	return { positions, indices };
}
