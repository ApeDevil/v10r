// ---------------------------------------------------------------------------
// 3D Model Customization Configuration
// ---------------------------------------------------------------------------
// Types and configs for runtime 3D model customization: material variants,
// part visibility, morph targets, and bone-attached accessories.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Material customization
// ---------------------------------------------------------------------------

/** How a material option is applied at runtime */
export type MaterialMethod = 'khr-variant' | 'color-override' | 'map-swap';

export interface MaterialOption {
	id: string;
	label: string;
	method: MaterialMethod;
	/** Hex color for swatches */
	color: string;
	/** KHR variant index (for 'khr-variant' method) */
	variantIndex?: number;
	/** Material names to target (for 'color-override' method) */
	targetMaterials?: string[];
}

export interface MaterialGroup {
	id: string;
	label: string;
	options: MaterialOption[];
	defaultOptionId: string;
}

// ---------------------------------------------------------------------------
// Part visibility
// ---------------------------------------------------------------------------

export interface ToggleablePart {
	id: string;
	label: string;
	/** Three.js object names to toggle */
	objectNames: string[];
	defaultVisible: boolean;
}

// ---------------------------------------------------------------------------
// Morph targets
// ---------------------------------------------------------------------------

export interface MorphTarget {
	name: string;
	label: string;
	min: number;
	max: number;
	default: number;
}

export interface MorphTargetGroup {
	id: string;
	label: string;
	/** Mesh name containing the morph targets */
	meshName: string;
	targets: MorphTarget[];
}

// ---------------------------------------------------------------------------
// Bone attachments
// ---------------------------------------------------------------------------

export interface Accessory {
	id: string;
	label: string;
	/** Procedural geometry type */
	geometry: 'cone' | 'box' | 'sphere' | 'cylinder';
	/** Geometry args [width, height, depth] or similar */
	geometryArgs: number[];
	/** Hex color */
	color: string;
	/** Local offset from bone [x, y, z] */
	offset?: [number, number, number];
	/** Local rotation [x, y, z] in radians */
	rotation?: [number, number, number];
	/** Local scale [x, y, z] */
	scale?: [number, number, number];
}

export interface AttachmentPoint {
	id: string;
	label: string;
	boneName: string;
	accessories: Accessory[];
}

// ---------------------------------------------------------------------------
// Presets + conflicts
// ---------------------------------------------------------------------------

export interface ConflictRule {
	/** Two IDs that cannot be active simultaneously */
	pair: [string, string];
}

export interface CustomizationPreset {
	id: string;
	label: string;
	/** Partial state to apply */
	state: Partial<CustomizationState>;
}

// ---------------------------------------------------------------------------
// Top-level config (optional on Model3D)
// ---------------------------------------------------------------------------

export interface CustomizationConfig {
	materialGroups?: MaterialGroup[];
	toggleableParts?: ToggleablePart[];
	morphTargetGroups?: MorphTargetGroup[];
	attachmentPoints?: AttachmentPoint[];
	conflicts?: ConflictRule[];
	presets?: CustomizationPreset[];
}

// ---------------------------------------------------------------------------
// Runtime state
// ---------------------------------------------------------------------------

export interface CustomizationState {
	/** groupId → optionId */
	materials: Record<string, string>;
	/** partId → visible */
	partVisibility: Record<string, boolean>;
	/** "meshName.targetName" → value */
	morphValues: Record<string, number>;
	/** accessoryId → enabled */
	accessories: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a default CustomizationState from config */
export function getDefaultState(config: CustomizationConfig): CustomizationState {
	const materials: Record<string, string> = {};
	for (const group of config.materialGroups ?? []) {
		materials[group.id] = group.defaultOptionId;
	}

	const partVisibility: Record<string, boolean> = {};
	for (const part of config.toggleableParts ?? []) {
		partVisibility[part.id] = part.defaultVisible;
	}

	const morphValues: Record<string, number> = {};
	for (const group of config.morphTargetGroups ?? []) {
		for (const target of group.targets) {
			morphValues[`${group.meshName}.${target.name}`] = target.default;
		}
	}

	const accessories: Record<string, boolean> = {};
	for (const point of config.attachmentPoints ?? []) {
		for (const acc of point.accessories) {
			accessories[acc.id] = false;
		}
	}

	return { materials, partVisibility, morphValues, accessories };
}

/** Apply a preset over a base state */
export function applyPreset(base: CustomizationState, preset: CustomizationPreset): CustomizationState {
	return {
		materials: { ...base.materials, ...preset.state.materials },
		partVisibility: { ...base.partVisibility, ...preset.state.partVisibility },
		morphValues: { ...base.morphValues, ...preset.state.morphValues },
		accessories: { ...base.accessories, ...preset.state.accessories },
	};
}

/** Check which IDs are disabled due to conflict rules */
export function checkConflicts(state: CustomizationState, config: CustomizationConfig): Set<string> {
	const disabled = new Set<string>();
	for (const rule of config.conflicts ?? []) {
		const [a, b] = rule.pair;
		const aActive = state.accessories[a] ?? false;
		const bActive = state.accessories[b] ?? false;
		if (aActive) disabled.add(b);
		if (bActive) disabled.add(a);
	}
	return disabled;
}

// ---------------------------------------------------------------------------
// Model-specific configs
// ---------------------------------------------------------------------------

export const SOFA_CUSTOMIZATION: CustomizationConfig = {
	materialGroups: [
		{
			id: 'fabric',
			label: 'Fabric Color',
			defaultOptionId: 'champagne',
			options: [
				{ id: 'champagne', label: 'Champagne', method: 'khr-variant', color: '#d4b896', variantIndex: 0 },
				{ id: 'navy', label: 'Navy', method: 'khr-variant', color: '#1b2a4a', variantIndex: 1 },
				{ id: 'gray', label: 'Gray', method: 'khr-variant', color: '#808080', variantIndex: 2 },
				{ id: 'black', label: 'Black', method: 'khr-variant', color: '#1a1a1a', variantIndex: 3 },
				{ id: 'pale-pink', label: 'Pale Pink', method: 'khr-variant', color: '#e8c4c4', variantIndex: 4 },
			],
		},
	],
	toggleableParts: [
		{ id: 'legs', label: 'Legs', objectNames: ['GlamVelvetSofa_legs'], defaultVisible: true },
		{ id: 'feet', label: 'Feet', objectNames: ['GlamVelvetSofa_feet'], defaultVisible: true },
	],
	presets: [
		{
			id: 'classic',
			label: 'Classic',
			state: { materials: { fabric: 'champagne' }, partVisibility: { legs: true, feet: true } },
		},
		{
			id: 'modern',
			label: 'Modern',
			state: { materials: { fabric: 'black' }, partVisibility: { legs: true, feet: true } },
		},
		{
			id: 'minimal',
			label: 'Minimal',
			state: { materials: { fabric: 'gray' }, partVisibility: { legs: false, feet: false } },
		},
	],
};

export const FOX_CUSTOMIZATION: CustomizationConfig = {
	materialGroups: [
		{
			id: 'body-color',
			label: 'Body Color',
			defaultOptionId: 'original',
			options: [
				{ id: 'original', label: 'Original', method: 'color-override', color: '#ffffff', targetMaterials: [] },
				{ id: 'arctic', label: 'Arctic', method: 'color-override', color: '#e8e8f0', targetMaterials: ['fox_material'] },
				{ id: 'red', label: 'Red Fox', method: 'color-override', color: '#c44a2f', targetMaterials: ['fox_material'] },
				{ id: 'golden', label: 'Golden', method: 'color-override', color: '#daa520', targetMaterials: ['fox_material'] },
				{ id: 'midnight', label: 'Midnight', method: 'color-override', color: '#2c2c54', targetMaterials: ['fox_material'] },
				{ id: 'sage', label: 'Sage', method: 'color-override', color: '#8fbc8f', targetMaterials: ['fox_material'] },
			],
		},
	],
	presets: [
		{
			id: 'natural',
			label: 'Natural',
			state: { materials: { 'body-color': 'original' } },
		},
		{
			id: 'winter',
			label: 'Winter',
			state: { materials: { 'body-color': 'arctic' } },
		},
		{
			id: 'fantasy',
			label: 'Fantasy',
			state: { materials: { 'body-color': 'midnight' } },
		},
	],
};

export const ROBOT_CUSTOMIZATION: CustomizationConfig = {
	morphTargetGroups: [
		{
			id: 'expressions',
			label: 'Facial Expressions',
			meshName: 'Head',
			targets: [
				{ name: 'Angry', label: 'Angry', min: 0, max: 1, default: 0 },
				{ name: 'Surprised', label: 'Surprised', min: 0, max: 1, default: 0 },
				{ name: 'Sad', label: 'Sad', min: 0, max: 1, default: 0 },
			],
		},
	],
	attachmentPoints: [
		{
			id: 'head-top',
			label: 'Head',
			boneName: 'Head',
			accessories: [
				{
					id: 'party-hat',
					label: 'Party Hat',
					geometry: 'cone',
					geometryArgs: [0.25, 0.5, 8],
					color: '#ff4444',
					offset: [0, 0.1, 0],
					rotation: [0, 0, 0],
					scale: [1, 1, 1],
				},
				{
					id: 'antenna',
					label: 'Antenna',
					geometry: 'cylinder',
					geometryArgs: [0.03, 0.03, 0.6, 8],
					color: '#44aaff',
					offset: [0, 0.15, 0],
					rotation: [0, 0, 0],
					scale: [1, 1, 1],
				},
			],
		},
		{
			id: 'back',
			label: 'Back',
			boneName: 'Torso_1',
			accessories: [
				{
					id: 'backpack',
					label: 'Backpack',
					geometry: 'box',
					geometryArgs: [0.35, 0.4, 0.2],
					color: '#44aa44',
					offset: [0, 0.05, -0.25],
					rotation: [0, 0, 0],
					scale: [1, 1, 1],
				},
			],
		},
		{
			id: 'hand-right',
			label: 'Right Hand',
			boneName: 'Palm1R',
			accessories: [
				{
					id: 'shield',
					label: 'Shield',
					geometry: 'sphere',
					geometryArgs: [0.18, 8, 6],
					color: '#ccaa00',
					offset: [0, 0, 0.15],
					rotation: [0, 0, 0],
					scale: [1, 0.3, 1],
				},
			],
		},
	],
	conflicts: [{ pair: ['party-hat', 'antenna'] }],
	presets: [
		{
			id: 'default',
			label: 'Default',
			state: { morphValues: { 'Head.Angry': 0, 'Head.Surprised': 0, 'Head.Sad': 0 }, accessories: {} },
		},
		{
			id: 'adventurer',
			label: 'Adventurer',
			state: {
				accessories: { backpack: true, shield: true },
				morphValues: { 'Head.Angry': 0, 'Head.Surprised': 0.5, 'Head.Sad': 0 },
			},
		},
		{
			id: 'party',
			label: 'Party Robot',
			state: {
				accessories: { 'party-hat': true },
				morphValues: { 'Head.Angry': 0, 'Head.Surprised': 1, 'Head.Sad': 0 },
			},
		},
		{
			id: 'sad-bot',
			label: 'Sad Bot',
			state: {
				morphValues: { 'Head.Angry': 0, 'Head.Surprised': 0, 'Head.Sad': 1 },
				accessories: {},
			},
		},
	],
};
