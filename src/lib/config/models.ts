// ---------------------------------------------------------------------------
// 3D Model Configuration
// ---------------------------------------------------------------------------
// Static registry of all 3D models available in the showcase.
// Components (SceneCard, SceneViewport, ViewportToolbar) consume this config
// to set up camera, lights, controls, and rendering behavior.
//
// Scene content (the actual Threlte snippet) is NOT referenced here.
// Pages import scenes by model ID via route-level mapping to avoid
// circular dependencies and preserve code-splitting.
// ---------------------------------------------------------------------------

import type { CustomizationConfig } from './customization';
import { SOFA_CUSTOMIZATION, FOX_CUSTOMIZATION, ROBOT_CUSTOMIZATION } from './customization';

/** Euler-style rotation axis */
export type RotationAxis = 'x' | 'y' | 'z';

/** Threlte render mode */
export type RenderMode = 'always' | 'on-demand' | 'manual';

// ---------------------------------------------------------------------------
// Camera
// ---------------------------------------------------------------------------

export interface CameraPreset {
	/** Camera position [x, y, z] */
	position: [number, number, number];
	/** Orbit target / lookAt point [x, y, z] */
	target: [number, number, number];
	/** Field of view in degrees (default: 50) */
	fov?: number;
	/** Near clipping plane (default: 0.1) */
	near?: number;
	/** Far clipping plane (default: 2000) */
	far?: number;
}

export interface CardCameraOverrides {
	/** Override position for card thumbnail view */
	position?: [number, number, number];
	/** Override target for card thumbnail view */
	target?: [number, number, number];
	/** Override fov for card thumbnail view */
	fov?: number;
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------

export interface OrbitControlsConfig {
	/** Enable orbit controls (default: true for viewport, false for card) */
	enabled: boolean;
	/** Enable zoom (default: true for viewport, false for card) */
	enableZoom?: boolean;
	/** Enable pan (default: true for viewport, false for card) */
	enablePan?: boolean;
	/** Min distance for zoom (default: none) */
	minDistance?: number;
	/** Max distance for zoom (default: none) */
	maxDistance?: number;
	/** Auto-rotate speed in rad/s (default: 0 = disabled) */
	autoRotateSpeed?: number;
}

// ---------------------------------------------------------------------------
// Auto-rotation (card view)
// ---------------------------------------------------------------------------

export interface AutoRotationConfig {
	/** Enable auto-rotation (default: true for cards) */
	enabled: boolean;
	/** Rotation speed in rad/s (default: 0.5) */
	speed?: number;
	/** Axis of rotation (default: 'y') */
	axis?: RotationAxis;
	/** Pause rotation on pointer hover (default: true) */
	pauseOnHover?: boolean;
}

// ---------------------------------------------------------------------------
// Lighting
// ---------------------------------------------------------------------------

export interface LightConfig {
	/** Directional light position [x, y, z] */
	directionalPosition: [number, number, number];
	/** Directional light intensity (default: 1) */
	directionalIntensity?: number;
	/** Ambient light intensity (default: 0.5) */
	ambientIntensity?: number;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

export interface AnimationConfig {
	/** Available animation clip names (from GLTF) */
	clips: string[];
	/** Default clip to play on load */
	defaultClip: string;
}

// ---------------------------------------------------------------------------
// Model3D — the main config type
// ---------------------------------------------------------------------------

export interface Model3D {
	/** Unique identifier, used for route matching and scene lookup */
	id: string;
	/** Display name */
	name: string;
	/** Short description for cards and page headers */
	description: string;
	/** Path to GLTF/GLB file relative to /static */
	path: string;
	/** Model scale factor (default: 1) */
	scale?: number;
	/** Tags for filtering in the card grid */
	tags: string[];

	// -- Rendering ----------------------------------------------------------

	/** Render mode for full-page viewport (default: inferred from animations) */
	viewportRenderMode?: RenderMode;
	/** Render mode for card thumbnail (default: 'on-demand') */
	cardRenderMode?: RenderMode;

	// -- Camera -------------------------------------------------------------

	/** Base camera preset (used by SceneViewport) */
	camera: CameraPreset;
	/** Overrides for card thumbnail camera. Merged over base camera. */
	cardCamera?: CardCameraOverrides;

	// -- Controls -----------------------------------------------------------

	/** Orbit controls for full-page viewport */
	controls?: Partial<OrbitControlsConfig>;
	/** Auto-rotation config for card thumbnail view */
	autoRotation?: Partial<AutoRotationConfig>;

	// -- Lighting -----------------------------------------------------------

	/** Lighting setup. Shared between card and viewport unless scene overrides. */
	lighting: LightConfig;

	// -- Animations ---------------------------------------------------------

	/** Animation config. Undefined = static model. */
	animations?: AnimationConfig;

	// -- Visual helpers -----------------------------------------------------

	/** Show grid helper in viewport (default: false) */
	showGrid?: boolean;
	/** Grid size and divisions [size, divisions] (default: [10, 10]) */
	gridArgs?: [number, number];

	// -- Customization ------------------------------------------------------

	/** Runtime customization config (material variants, morph targets, etc.) */
	customization?: CustomizationConfig;

	// -- Metadata -----------------------------------------------------------

	/** Icon class for LinkCard / badge (UnoCSS icon) */
	icon: string;
	/** Thumbnail image path for loading skeleton / fallback */
	thumbnail?: string;
	/** Attribution / source credit */
	credit?: string;
	/** External link to model source */
	sourceUrl?: string;
}

// ---------------------------------------------------------------------------
// Model registry
// ---------------------------------------------------------------------------

export const MODELS: Model3D[] = [
	{
		id: 'damaged-helmet',
		name: 'Damaged Helmet',
		description: 'GLTF model with orbit controls and directional lighting.',
		path: '/models/DamagedHelmet.glb',
		tags: ['static', 'gltf', 'pbr'],
		icon: 'i-lucide-box',

		camera: {
			position: [3, 3, 3],
			target: [0, 0, 0],
		},
		cardCamera: {
			position: [4, 3, 4],
		},

		controls: {
			enabled: true,
			enableZoom: true,
			enablePan: true,
		},
		autoRotation: {
			enabled: true,
			speed: 0.5,
			axis: 'y',
			pauseOnHover: true,
		},

		lighting: {
			directionalPosition: [10, 10, 10],
			directionalIntensity: 1,
			ambientIntensity: 0.5,
		},

		viewportRenderMode: 'on-demand',
		cardRenderMode: 'on-demand',

		credit: 'theblueturtle_ (Sketchfab)',
		sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Assets',
	},
	{
		id: 'fox',
		name: 'Fox',
		description: 'Animated fox model with switchable Survey, Walk, and Run animations.',
		path: '/models/Fox.glb',
		scale: 1,
		tags: ['animated', 'gltf', 'character', 'customizable'],
		icon: 'i-lucide-play',
		customization: FOX_CUSTOMIZATION,

		camera: {
			position: [100, 50, 100],
			target: [0, 30, 0],
		},
		cardCamera: {
			position: [110, 60, 110],
			target: [0, 30, 0],
		},

		controls: {
			enabled: true,
			enableZoom: true,
			enablePan: true,
		},
		autoRotation: {
			enabled: true,
			speed: 0.3,
			axis: 'y',
			pauseOnHover: true,
		},

		lighting: {
			directionalPosition: [100, 100, 100],
			directionalIntensity: 1,
			ambientIntensity: 0.5,
		},

		animations: {
			clips: ['Survey', 'Walk', 'Run'],
			defaultClip: 'Survey',
		},

		viewportRenderMode: 'always',
		cardRenderMode: 'always',

		showGrid: true,
		gridArgs: [200, 20],

		credit: 'PixelMannen (Sketchfab)',
		sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Assets',
	},
	{
		id: 'glam-velvet-sofa',
		name: 'Glam Velvet Sofa',
		description: 'Sofa with 5 KHR_materials_variants and toggleable parts.',
		path: '/models/GlamVelvetSofa.glb',
		scale: 1,
		tags: ['static', 'gltf', 'customizable', 'variants'],
		icon: 'i-lucide-sofa',
		customization: SOFA_CUSTOMIZATION,

		camera: {
			position: [2.5, 1.5, 2.5],
			target: [0, 0.4, 0],
		},
		cardCamera: {
			position: [3, 2, 3],
			target: [0, 0.4, 0],
		},

		controls: {
			enabled: true,
			enableZoom: true,
			enablePan: true,
		},
		autoRotation: {
			enabled: true,
			speed: 0.3,
			axis: 'y',
			pauseOnHover: true,
		},

		lighting: {
			directionalPosition: [5, 8, 5],
			directionalIntensity: 1.2,
			ambientIntensity: 0.6,
		},

		viewportRenderMode: 'on-demand',
		cardRenderMode: 'on-demand',

		credit: 'Wayfair LLC',
		sourceUrl: 'https://github.com/KhronosGroup/glTF-Sample-Assets',
	},
	{
		id: 'robot-expressive',
		name: 'Robot Expressive',
		description: 'Rigged robot with morph targets, bone attachments, and 14 animations.',
		path: '/models/RobotExpressive.glb',
		scale: 0.4,
		tags: ['animated', 'gltf', 'character', 'customizable', 'morph-targets'],
		icon: 'i-lucide-bot',
		customization: ROBOT_CUSTOMIZATION,

		camera: {
			position: [1.5, 1, 3.2],
			target: [0, 0.55, 0],
		},
		cardCamera: {
			position: [1.5, 0.8, 2.5],
			target: [0, 0.5, 0],
		},

		controls: {
			enabled: true,
			enableZoom: true,
			enablePan: true,
		},
		autoRotation: {
			enabled: true,
			speed: 0.3,
			axis: 'y',
			pauseOnHover: true,
		},

		lighting: {
			directionalPosition: [5, 8, 5],
			directionalIntensity: 1,
			ambientIntensity: 0.6,
		},

		animations: {
			clips: ['Idle', 'Walking', 'Running', 'Dance', 'Wave', 'Jump', 'ThumbsUp', 'Punch'],
			defaultClip: 'Idle',
		},

		viewportRenderMode: 'always',
		cardRenderMode: 'always',

		showGrid: true,
		gridArgs: [4, 8],

		credit: 'Tomás Laulhé',
		sourceUrl: 'https://github.com/mrdoob/three.js',
	},
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Map of model ID to config for O(1) lookup */
export const MODELS_BY_ID = new Map(MODELS.map((m) => [m.id, m]));

/** Get a model config by ID. Throws if not found. */
export function getModel(id: string): Model3D {
	const model = MODELS_BY_ID.get(id);
	if (!model) throw new Error(`Unknown model: "${id}". Available: ${MODELS.map((m) => m.id).join(', ')}`);
	return model;
}

/** Get all unique tags across all models */
export function getAllTags(): string[] {
	return [...new Set(MODELS.flatMap((m) => m.tags))].sort();
}

/** Filter models by tag */
export function getModelsByTag(tag: string): Model3D[] {
	return MODELS.filter((m) => m.tags.includes(tag));
}

// ---------------------------------------------------------------------------
// Defaults — consumed by SceneCard and SceneViewport to fill gaps
// ---------------------------------------------------------------------------

export const CARD_DEFAULTS = {
	renderMode: 'on-demand' as RenderMode,
	autoRotation: {
		enabled: true,
		speed: 0.5,
		axis: 'y' as RotationAxis,
		pauseOnHover: true,
	},
	controls: {
		enabled: false,
		enableZoom: false,
		enablePan: false,
	},
} as const;

export const VIEWPORT_DEFAULTS = {
	renderMode: 'on-demand' as RenderMode,
	controls: {
		enabled: true,
		enableZoom: true,
		enablePan: true,
	},
	camera: {
		fov: 50,
		near: 0.1,
		far: 2000,
	},
	lighting: {
		directionalIntensity: 1,
		ambientIntensity: 0.5,
	},
} as const;

// ---------------------------------------------------------------------------
// Resolved config helpers — merge model config with defaults
// ---------------------------------------------------------------------------

export interface ResolvedCardConfig {
	renderMode: RenderMode;
	camera: CameraPreset;
	autoRotation: Required<AutoRotationConfig>;
	controls: Required<OrbitControlsConfig>;
	lighting: Required<LightConfig>;
}

export interface ResolvedViewportConfig {
	renderMode: RenderMode;
	camera: Required<CameraPreset>;
	controls: Required<OrbitControlsConfig>;
	lighting: Required<LightConfig>;
}

/** Merge model config with card defaults for SceneCard consumption */
export function resolveCardConfig(model: Model3D): ResolvedCardConfig {
	const camera: CameraPreset = {
		...model.camera,
		...model.cardCamera,
	};

	return {
		renderMode: model.cardRenderMode ?? CARD_DEFAULTS.renderMode,
		camera,
		autoRotation: {
			enabled: model.autoRotation?.enabled ?? CARD_DEFAULTS.autoRotation.enabled,
			speed: model.autoRotation?.speed ?? CARD_DEFAULTS.autoRotation.speed,
			axis: model.autoRotation?.axis ?? CARD_DEFAULTS.autoRotation.axis,
			pauseOnHover: model.autoRotation?.pauseOnHover ?? CARD_DEFAULTS.autoRotation.pauseOnHover,
		},
		controls: {
			enabled: model.controls?.enabled ?? CARD_DEFAULTS.controls.enabled,
			enableZoom: model.controls?.enableZoom ?? CARD_DEFAULTS.controls.enableZoom,
			enablePan: model.controls?.enablePan ?? CARD_DEFAULTS.controls.enablePan,
			autoRotateSpeed: 0,
			minDistance: undefined as unknown as number,
			maxDistance: undefined as unknown as number,
		},
		lighting: {
			directionalPosition: model.lighting.directionalPosition,
			directionalIntensity: model.lighting.directionalIntensity ?? VIEWPORT_DEFAULTS.lighting.directionalIntensity,
			ambientIntensity: model.lighting.ambientIntensity ?? VIEWPORT_DEFAULTS.lighting.ambientIntensity,
		},
	};
}

/** Merge model config with viewport defaults for SceneViewport consumption */
export function resolveViewportConfig(model: Model3D): ResolvedViewportConfig {
	const inferredRenderMode: RenderMode = model.animations ? 'always' : 'on-demand';

	return {
		renderMode: model.viewportRenderMode ?? inferredRenderMode,
		camera: {
			position: model.camera.position,
			target: model.camera.target,
			fov: model.camera.fov ?? VIEWPORT_DEFAULTS.camera.fov,
			near: model.camera.near ?? VIEWPORT_DEFAULTS.camera.near,
			far: model.camera.far ?? VIEWPORT_DEFAULTS.camera.far,
		},
		controls: {
			enabled: model.controls?.enabled ?? VIEWPORT_DEFAULTS.controls.enabled,
			enableZoom: model.controls?.enableZoom ?? VIEWPORT_DEFAULTS.controls.enableZoom,
			enablePan: model.controls?.enablePan ?? VIEWPORT_DEFAULTS.controls.enablePan,
			autoRotateSpeed: model.controls?.autoRotateSpeed ?? 0,
			minDistance: model.controls?.minDistance ?? 0,
			maxDistance: model.controls?.maxDistance ?? Infinity,
		},
		lighting: {
			directionalPosition: model.lighting.directionalPosition,
			directionalIntensity: model.lighting.directionalIntensity ?? VIEWPORT_DEFAULTS.lighting.directionalIntensity,
			ambientIntensity: model.lighting.ambientIntensity ?? VIEWPORT_DEFAULTS.lighting.ambientIntensity,
		},
	};
}
