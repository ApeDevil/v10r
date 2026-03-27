/**
 * Resolves a scene embed's `src` attribute into a model path and config.
 *
 * Two resolution modes:
 * - Registry ID (e.g., "fox") → looks up MODELS_BY_ID for full Model3D config
 * - R2 path (e.g., "blog/3d/abc.glb") → constructs proxy URL with default config
 */
import {
	MODELS_BY_ID,
	VIEWPORT_DEFAULTS,
	type CameraPreset,
	type LightConfig,
	type Model3D,
} from '$lib/config/models';

export interface EmbedSceneConfig {
	camera: CameraPreset;
	lighting: Required<LightConfig>;
	autoRotate: boolean;
}

export type ResolvedScene =
	| { type: 'registry'; model: Model3D }
	| { type: 'url'; path: string; config: EmbedSceneConfig }
	| { type: 'error'; reason: string };

const DEFAULT_EMBED_CONFIG: EmbedSceneConfig = {
	camera: {
		position: [3, 3, 3],
		target: [0, 0, 0],
		fov: 50,
		near: 0.1,
		far: 2000,
	},
	lighting: {
		directionalPosition: [10, 10, 10],
		directionalIntensity: VIEWPORT_DEFAULTS.lighting.directionalIntensity,
		ambientIntensity: VIEWPORT_DEFAULTS.lighting.ambientIntensity,
	},
	autoRotate: true,
};

function isR2Path(src: string): boolean {
	return src.includes('/') || src.endsWith('.glb') || src.endsWith('.gltf');
}

export function resolveScene(attrs: Record<string, string>): ResolvedScene {
	const src = attrs.src;
	if (!src) return { type: 'error', reason: 'Missing src attribute' };

	if (isR2Path(src)) {
		return {
			type: 'url',
			path: `/api/blog/media/${src}`,
			config: DEFAULT_EMBED_CONFIG,
		};
	}

	const model = MODELS_BY_ID.get(src);
	if (!model) {
		return {
			type: 'error',
			reason: `Unknown model: "${src}". Available: ${[...MODELS_BY_ID.keys()].join(', ')}`,
		};
	}

	return { type: 'registry', model };
}
