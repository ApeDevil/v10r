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

export interface PartPhoto {
	/** Static asset path (under /images/parts/) — attribution in ATTRIBUTION.md next to the assets */
	src: string;
	/** Alt text for the image */
	alt: string;
	/** Short caption shown under the photo in the lightbox */
	caption: string;
	/** Author / license credit line shown in the lightbox */
	credit: string;
}

export interface PartDef {
	/** Stable logical id, used for selection state and the `?part=` deep-link */
	id: string;
	/** GLTF mesh names — exact or prefix; tolerant of "_0"/"_1" primitive splits */
	meshNamePatterns: string[];
	/** Display name (plain string — project convention for showcase-internal copy) */
	label: string;
	/** Short description shown in the info panel */
	description: string;
	/** Example photos shown as thumbnails in the part drawer (click → lightbox) */
	photos?: PartPhoto[];
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
		photos: [
			{
				src: '/images/parts/glam-velvet-sofa/body-1.jpg',
				alt: 'Living room with a gold velvet sectional sofa',
				caption: 'Velvet upholstery on a full sofa body',
				credit: 'firepile — CC BY 2.0',
			},
			{
				src: '/images/parts/glam-velvet-sofa/body-2.jpg',
				alt: 'Close-up of deep ruby velvet pile',
				caption: 'The dense, light-catching pile that defines velvet',
				credit: 'sure2talk — CC BY 2.0',
			},
			{
				src: '/images/parts/glam-velvet-sofa/body-3.jpg',
				alt: 'Red quilted velvet upholstery with diamond stitching',
				caption: 'Quilted velvet — a classic upholstery treatment',
				credit: 'BuyandCreate.com — CC BY-SA 2.0',
			},
		],
		customizeHint: true,
	},
	{
		id: 'legs',
		meshNamePatterns: ['GlamVelvetSofa_legs'],
		label: 'Wood Legs',
		description: 'Four turned solid-wood legs in a dark finish, supporting the frame.',
		photos: [
			{
				src: '/images/parts/glam-velvet-sofa/legs-1.jpg',
				alt: 'Sculpture assembled from dozens of turned wooden furniture legs',
				caption: 'Turned legs in every profile a lathe can produce',
				credit: 'Orin Zebest — CC BY 2.0',
			},
			{
				src: '/images/parts/glam-velvet-sofa/legs-2.jpg',
				alt: 'Craftsman shaping spinning wood on a lathe',
				caption: 'Turning: the craft that shapes each leg',
				credit: 'William Warby — CC BY 2.0',
			},
			{
				src: '/images/parts/glam-velvet-sofa/legs-3.jpg',
				alt: 'Dark stained wood boards with visible grain',
				caption: 'The dark finish used on the sofa legs',
				credit: 'webtreats — CC BY 2.0',
			},
		],
	},
	{
		id: 'feet',
		meshNamePatterns: ['GlamVelvetSofa_feet'],
		label: 'Metal Feet',
		description: 'Brass-finish caps at the base of each leg.',
		photos: [
			{
				src: '/images/parts/glam-velvet-sofa/feet-1.jpg',
				alt: 'Antique bed foot with a caster wheel at its base',
				caption: 'Furniture feet have carried hardware for centuries',
				credit: 'Skoklosters slott — public domain',
			},
			{
				src: '/images/parts/glam-velvet-sofa/feet-2.jpg',
				alt: 'Set of engraved antique brass hardware on a wooden table',
				caption: 'Brass fittings — durable and decorative',
				credit: 'denise carbonell — CC BY 2.0',
			},
			{
				src: '/images/parts/glam-velvet-sofa/feet-3.jpg',
				alt: 'Polished brass panel with vent slots',
				caption: 'The warm sheen of a polished brass finish',
				credit: "Jnzl's Photos — CC BY 2.0",
			},
		],
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
