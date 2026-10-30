/**
 * GLB (binary glTF 2.0) for a `GeneratedMesh`: a byte-stable writer and a structural reader.
 *
 * The writer emits only what the mesh carries — one node and one mesh per primitive under a
 * named root, POSITION and NORMAL attributes, 16- or 32-bit indices, one metallic-roughness
 * material per role — in a fixed order with no timestamps, so the same mesh always gives the
 * same bytes. It needs no DOM (`Blob`, `FileReader`), which is why it is not Three.js's
 * `GLTFExporter`: it runs unchanged in a browser, Node, Bun or a worker process.
 *
 * The reader is the export gate: it parses what the writer produced back from the bytes —
 * header, chunk framing, JSON, every bufferView and accessor inside the buffer, every index
 * inside its vertex range — so a broken encoder fails before an asset is kept. The Khronos
 * validator and Three.js's `GLTFLoader` check the same files in the tests.
 */
import { type AssetDiagnostic, assetDiagnostic } from './diagnostics.ts';
import type { GeneratedMesh, MaterialRole } from './mesh.ts';

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;
const FLOAT = 5126;
const UNSIGNED_SHORT = 5123;
const UNSIGNED_INT = 5125;
const ARRAY_BUFFER = 34962;
const ELEMENT_ARRAY_BUFFER = 34963;
const TRIANGLES = 4;

/** Physically based defaults per role. Asset data, not UI colour: a viewer restyles by material name. */
const MATERIAL_PBR: Record<
	MaterialRole,
	{ baseColorFactor: number[]; metallicFactor: number; roughnessFactor: number }
> = {
	structure: { baseColorFactor: [0.62, 0.64, 0.68, 1], metallicFactor: 0.85, roughnessFactor: 0.4 },
	hub: { baseColorFactor: [0.45, 0.47, 0.52, 1], metallicFactor: 0.7, roughnessFactor: 0.45 },
	module: { baseColorFactor: [0.86, 0.85, 0.8, 1], metallicFactor: 0.1, roughnessFactor: 0.65 },
};

const pad4 = (n: number) => (n + 3) & ~3;

export interface GlbOptions {
	/** Name of the root node. */
	name: string;
	/** Written as `asset.extras` — provenance the file carries with it. Must be JSON. */
	extras?: Record<string, unknown>;
}

export function encodeGlb(mesh: GeneratedMesh, options: GlbOptions): Uint8Array {
	const views: { bytes: Uint8Array; target: number }[] = [];
	const accessors: Record<string, unknown>[] = [];
	const meshes: Record<string, unknown>[] = [];
	const materials: Record<string, unknown>[] = [];
	const materialIndex = new Map<MaterialRole, number>();
	let byteOffset = 0;
	const bufferViews: Record<string, unknown>[] = [];

	const addView = (bytes: Uint8Array, target: number) => {
		bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.byteLength, target });
		views.push({ bytes, target });
		byteOffset += pad4(bytes.byteLength);
		return bufferViews.length - 1;
	};

	for (const primitive of mesh.primitives) {
		const vertexCount = primitive.positions.length / 3;
		let material = materialIndex.get(primitive.material);
		if (material === undefined) {
			material = materials.length;
			materials.push({ name: primitive.material, pbrMetallicRoughness: MATERIAL_PBR[primitive.material] });
			materialIndex.set(primitive.material, material);
		}

		const min = [Infinity, Infinity, Infinity];
		const max = [-Infinity, -Infinity, -Infinity];
		for (let i = 0; i < primitive.positions.length; i++) {
			const axis = i % 3;
			min[axis] = Math.min(min[axis], primitive.positions[i]);
			max[axis] = Math.max(max[axis], primitive.positions[i]);
		}
		const position =
			accessors.push({
				bufferView: addView(new Uint8Array(primitive.positions.buffer.slice(0)), ARRAY_BUFFER),
				componentType: FLOAT,
				count: vertexCount,
				type: 'VEC3',
				min,
				max,
			}) - 1;
		const normal =
			accessors.push({
				bufferView: addView(new Uint8Array(primitive.normals.buffer.slice(0)), ARRAY_BUFFER),
				componentType: FLOAT,
				count: vertexCount,
				type: 'VEC3',
			}) - 1;
		const short = vertexCount <= 0xffff;
		const indexBytes = short ? Uint16Array.from(primitive.indices) : primitive.indices.slice();
		const index =
			accessors.push({
				bufferView: addView(new Uint8Array(indexBytes.buffer), ELEMENT_ARRAY_BUFFER),
				componentType: short ? UNSIGNED_SHORT : UNSIGNED_INT,
				count: primitive.indices.length,
				type: 'SCALAR',
			}) - 1;
		meshes.push({
			name: primitive.name,
			primitives: [{ attributes: { POSITION: position, NORMAL: normal }, indices: index, material, mode: TRIANGLES }],
		});
	}

	const json = {
		asset: {
			version: '2.0',
			generator: 'v10r asset-production',
			...(options.extras ? { extras: options.extras } : {}),
		},
		scene: 0,
		scenes: [{ name: options.name, nodes: [0] }],
		nodes: [
			{ name: options.name, children: meshes.map((_, i) => i + 1) },
			...meshes.map((m, i) => ({ name: m.name, mesh: i })),
		],
		meshes,
		materials,
		accessors,
		bufferViews,
		buffers: [{ byteLength: byteOffset }],
	};

	const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
	const jsonLength = pad4(jsonBytes.byteLength);
	const total = 12 + 8 + jsonLength + 8 + byteOffset;
	const out = new Uint8Array(total);
	const header = new DataView(out.buffer);
	header.setUint32(0, GLB_MAGIC, true);
	header.setUint32(4, 2, true);
	header.setUint32(8, total, true);
	header.setUint32(12, jsonLength, true);
	header.setUint32(16, CHUNK_JSON, true);
	out.set(jsonBytes, 20);
	out.fill(0x20, 20 + jsonBytes.byteLength, 20 + jsonLength); // JSON pads with spaces
	const bin = 20 + jsonLength;
	header.setUint32(bin, byteOffset, true);
	header.setUint32(bin + 4, CHUNK_BIN, true);
	let at = bin + 8;
	for (const view of views) {
		// Typed arrays are little-endian on every platform this runs on — what glTF requires.
		out.set(view.bytes, at); // BIN pads with zeros (already zero)
		at += pad4(view.bytes.byteLength);
	}
	return out;
}

export interface GlbSummary {
	json: GlbJson;
	vertices: number;
	triangles: number;
	meshes: number;
	materials: number;
}

/** The subset of glTF JSON the reader checks. */
interface GlbJson {
	asset?: { version?: string; extras?: unknown };
	meshes?: { name?: string; primitives?: { attributes?: Record<string, number>; indices?: number; mode?: number }[] }[];
	materials?: unknown[];
	accessors?: {
		bufferView?: number;
		byteOffset?: number;
		componentType?: number;
		count?: number;
		type?: string;
		min?: number[];
		max?: number[];
	}[];
	bufferViews?: { buffer?: number; byteOffset?: number; byteLength?: number }[];
	buffers?: { byteLength?: number }[];
}

const COMPONENT_BYTES: Record<number, number> = { [FLOAT]: 4, [UNSIGNED_SHORT]: 2, [UNSIGNED_INT]: 4 };
const TYPE_SIZE: Record<string, number> = { SCALAR: 1, VEC3: 3 };

/** Read a GLB back and check its framing and references. Never throws: a failure is a `glb.malformed` finding. */
export function readGlb(bytes: Uint8Array): { summary?: GlbSummary; diagnostics: AssetDiagnostic[] } {
	const fail = (message: string) => ({ diagnostics: [assetDiagnostic('glb.malformed', 'glb', message)] });
	if (bytes.byteLength < 28) return fail('Shorter than a GLB header and one chunk.');
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (view.getUint32(0, true) !== GLB_MAGIC) return fail('Missing the glTF magic.');
	if (view.getUint32(4, true) !== 2) return fail('Not GLB version 2.');
	if (view.getUint32(8, true) !== bytes.byteLength) return fail('Header length differs from the file length.');
	const jsonLength = view.getUint32(12, true);
	if (view.getUint32(16, true) !== CHUNK_JSON || jsonLength % 4 !== 0 || 20 + jsonLength + 8 > bytes.byteLength) {
		return fail('The first chunk is not a 4-byte-aligned JSON chunk.');
	}
	let json: GlbJson;
	try {
		json = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(20, 20 + jsonLength)));
	} catch {
		return fail('The JSON chunk does not parse.');
	}
	const binStart = 20 + jsonLength;
	const binLength = view.getUint32(binStart, true);
	if (view.getUint32(binStart + 4, true) !== CHUNK_BIN || binStart + 8 + binLength !== bytes.byteLength) {
		return fail('The second chunk is not a BIN chunk that ends the file.');
	}
	if (json.asset?.version !== '2.0') return fail('asset.version is not 2.0.');
	if (json.buffers?.length !== 1 || (json.buffers[0].byteLength ?? -1) > binLength)
		return fail('Buffer 0 does not fit the BIN chunk.');
	const bin = bytes.subarray(binStart + 8, binStart + 8 + binLength);
	const binView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);

	for (const bufferView of json.bufferViews ?? []) {
		const end = (bufferView.byteOffset ?? 0) + (bufferView.byteLength ?? 0);
		if (bufferView.buffer !== 0 || end > binLength) return fail('A bufferView reaches past the buffer.');
	}
	const accessors = json.accessors ?? [];
	const span = (index: number | undefined) => {
		const accessor = index === undefined ? undefined : accessors[index];
		const bufferView = accessor?.bufferView === undefined ? undefined : json.bufferViews?.[accessor.bufferView];
		const width = accessor
			? (COMPONENT_BYTES[accessor.componentType ?? 0] ?? 0) * (TYPE_SIZE[accessor.type ?? ''] ?? 0)
			: 0;
		if (!accessor || !bufferView || width === 0 || (accessor.count ?? 0) < 1) return undefined;
		const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
		if ((accessor.byteOffset ?? 0) + width * (accessor.count ?? 0) > (bufferView.byteLength ?? 0)) return undefined;
		return { accessor, start };
	};

	let vertices = 0;
	let triangles = 0;
	for (const mesh of json.meshes ?? []) {
		for (const primitive of mesh.primitives ?? []) {
			const position = span(primitive.attributes?.POSITION);
			const normal = span(primitive.attributes?.NORMAL);
			const indices = span(primitive.indices);
			if (!position || !normal || !indices)
				return fail(`Mesh ${mesh.name ?? '?'} has an accessor outside its bufferView.`);
			if (!position.accessor.min || !position.accessor.max) return fail('POSITION has no min/max (required by glTF).');
			if ((primitive.mode ?? TRIANGLES) !== TRIANGLES || (indices.accessor.count ?? 0) % 3 !== 0)
				return fail('A primitive is not an indexed triangle list.');
			const vertexCount = position.accessor.count ?? 0;
			const count = indices.accessor.count ?? 0;
			const read =
				indices.accessor.componentType === UNSIGNED_SHORT
					? (i: number) => binView.getUint16(indices.start + 2 * i, true)
					: (i: number) => binView.getUint32(indices.start + 4 * i, true);
			for (let i = 0; i < count; i++) {
				if (read(i) >= vertexCount) return fail(`Mesh ${mesh.name ?? '?'} indexes past its vertices.`);
			}
			vertices += vertexCount;
			triangles += count / 3;
		}
	}
	if (triangles === 0) return fail('The file holds no triangles.');
	return {
		summary: { json, vertices, triangles, meshes: json.meshes?.length ?? 0, materials: json.materials?.length ?? 0 },
		diagnostics: [],
	};
}
