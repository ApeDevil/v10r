<script lang="ts">
import { T, useTask } from '@threlte/core';
import { OrbitControls, useGltf } from '@threlte/extras';
import type { Model3D, ResolvedViewportConfig } from '$lib/config/models';
import { AnimationMixer, AnimationClip } from 'three';

interface Props {
	model: Model3D;
	config: ResolvedViewportConfig;
	currentAnimation: string;
}

let { model, config, currentAnimation }: Props = $props();

const gltf = useGltf(model.path);

let mixer: AnimationMixer | undefined;

// When the model has morph target customization, strip morph tracks from
// animations so the mixer doesn't overwrite the customizer's values.
const hasMorphCustomization = (model.customization?.morphTargetGroups?.length ?? 0) > 0;

// Create mixer and react to animation changes
$effect(() => {
	const data = $gltf;
	if (!data || !model.animations) return;
	if (!mixer) mixer = new AnimationMixer(data.scene);
	mixer.stopAllAction();
	const clip = data.animations.find((c) => c.name === currentAnimation);
	if (clip) {
		const playClip = hasMorphCustomization
			? new AnimationClip(
					clip.name,
					clip.duration,
					clip.tracks.filter((t) => !t.name.includes('morphTargetInfluences')),
				)
			: clip;
		mixer.clipAction(playClip).play();
	}
});

useTask((delta) => {
	mixer?.update(delta);
});
</script>

<T.PerspectiveCamera
	makeDefault
	position={config.camera.position}
	fov={config.camera.fov}
	near={config.camera.near}
	far={config.camera.far}
>
	<OrbitControls
		target={config.camera.target}
		enableZoom={config.controls.enableZoom}
		enablePan={config.controls.enablePan}
	/>
</T.PerspectiveCamera>

<T.DirectionalLight
	position={config.lighting.directionalPosition}
	intensity={config.lighting.directionalIntensity}
/>
<T.AmbientLight intensity={config.lighting.ambientIntensity} />

{#if $gltf}
	<T is={$gltf.scene} scale={model.scale ?? 1} />
{/if}

{#if model.showGrid}
	<T.GridHelper args={model.gridArgs ?? [10, 10]} />
{/if}
