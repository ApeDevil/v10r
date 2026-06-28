// ---------------------------------------------------------------------------
// 3D Part Explorer Configuration
// ---------------------------------------------------------------------------
// Logical-part registry for the interactive "part explorer" (click a part of a
// model to surface info + highlight + camera framing). Keys are STABLE logical
// part IDs; each maps to one or more GLTF mesh-name patterns. Never key logic on
// raw artist mesh names — they drift across re-exports and split into multiple
// primitives. Resolve a raycast hit → logical part via prefix-match traversal.
//
// Pure module: no Three.js scene construction, no WebGL. `resolvePartId` is
// unit-tested in parts.test.ts.
// ---------------------------------------------------------------------------

import type { Mesh, Object3D } from 'three';

export interface PartDef {
	/** Stable logical id, used for selection state and the `?part=` deep-link */
	id: string;
	/** GLTF mesh names — exact or prefix; tolerant of "_0"/"_1" primitive splits */
	meshNamePatterns: string[];
	/** Display name (plain string — project convention for showcase-internal copy) */
	label: string;
	/** Short description shown in the info panel */
	description: string;
	/** When true, the panel offers a cross-link to the material customizer */
	customizeHint?: boolean;
}

// ---------------------------------------------------------------------------
// Model-specific registries
// ---------------------------------------------------------------------------

/**
 * Glam Velvet Sofa — the GLB exposes exactly three meshes:
 * `GlamVelvetSofa_fabric` (the whole upholstered body), `GlamVelvetSofa_legs`,
 * and `GlamVelvetSofa_feet`. There are no separate cushion/arm meshes.
 */
export const SOFA_PARTS: PartDef[] = [
	{
		id: 'body',
		meshNamePatterns: ['GlamVelvetSofa_fabric'],
		label: 'Upholstered Body',
		description:
			'The velvet-upholstered seat, back, and arms — one continuous piece. Available in five fabric colours.',
		customizeHint: true,
	},
	{
		id: 'legs',
		meshNamePatterns: ['GlamVelvetSofa_legs'],
		label: 'Wood Legs',
		description: 'Four turned solid-wood legs in a dark finish, supporting the frame.',
	},
	{
		id: 'feet',
		meshNamePatterns: ['GlamVelvetSofa_feet'],
		label: 'Metal Feet',
		description: 'Brass-finish caps at the base of each leg.',
	},
];

/** Map of model id → its part registry. Absent = model is not a part explorer. */
export const PART_EXPLORERS_BY_MODEL = new Map<string, PartDef[]>([['glam-velvet-sofa', SOFA_PARTS]]);

// ---------------------------------------------------------------------------
// Resolution helpers (prefix-match — robust to multi-primitive splits)
// ---------------------------------------------------------------------------

/** Exact match, or a multi-primitive split where Three.js appends "_0"/"_1". */
function matchesPattern(name: string, pattern: string): boolean {
	return name === pattern || name.startsWith(`${pattern}_`);
}

/**
 * Map a hit mesh name to its logical part id. Pure — no scene access.
 * Returns null when the name belongs to no registered part.
 */
export function resolvePartId(objectName: string, parts: PartDef[]): string | null {
	for (const part of parts) {
		if (part.meshNamePatterns.some((pattern) => matchesPattern(objectName, pattern))) {
			return part.id;
		}
	}
	return null;
}

/** All meshes in the scene belonging to a logical part (handles primitive splits). */
export function collectPartMeshes(root: Object3D, part: PartDef): Mesh[] {
	const meshes: Mesh[] = [];
	root.traverse((child) => {
		const mesh = child as Mesh;
		if (mesh.isMesh && part.meshNamePatterns.some((pattern) => matchesPattern(mesh.name, pattern))) {
			meshes.push(mesh);
		}
	});
	return meshes;
}

/** DEV-only: warn for any part whose patterns matched zero meshes (catches re-export renames). */
export function validateParts(root: Object3D, parts: PartDef[]): void {
	for (const part of parts) {
		if (collectPartMeshes(root, part).length === 0) {
			console.warn(`[parts] "${part.id}" matched 0 meshes (patterns: ${part.meshNamePatterns.join(', ')})`);
		}
	}
}
