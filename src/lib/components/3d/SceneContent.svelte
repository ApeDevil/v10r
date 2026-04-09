<script lang="ts">
import { T, useTask } from '@threlte/core';
import { useGltf } from '@threlte/extras';
import { AnimationMixer, type PerspectiveCamera, Vector3 } from 'three';
import type { Model3D, ResolvedCardConfig } from '$lib/config/models';

interface Props {
	model: Model3D;
	config: ResolvedCardConfig;
	hovered?: boolean;
}

let { model, config, hovered = false }: Props = $props();

let rotation = $state(0);

// Auto-rotation
useTask((delta) => {
	if (!config.autoRotation.enabled) return;
	if (config.autoRotation.pauseOnHover && hovered) return;
	rotation += delta * config.autoRotation.speed;
});

// Load model (useGltf returns a store)
// svelte-ignore state_referenced_locally
const gltf = useGltf(model.path);

// Animation support
let mixer: AnimationMixer | undefined;

$effect(() => {
	const data = $gltf;
	if (!data || !model.animations) return;
	mixer = new AnimationMixer(data.scene);
	const clip = data.animations.find((c) => c.name === model.animations?.defaultClip);
	if (clip) mixer.clipAction(clip).play();
});

useTask((delta) => {
	mixer?.update(delta);
});
</script>

<T.PerspectiveCamera
	makeDefault
	position={config.camera.position}
	fov={config.camera.fov ?? 50}
	near={config.camera.near ?? 0.1}
	far={config.camera.far ?? 2000}
	oncreate={(ref: PerspectiveCamera) => {
		const [x, y, z] = config.camera.target;
		ref.lookAt(new Vector3(x, y, z));
	}}
/>

<T.DirectionalLight
	position={config.lighting.directionalPosition}
	intensity={config.lighting.directionalIntensity}
/>
<T.AmbientLight intensity={config.lighting.ambientIntensity} />

{#if $gltf}
	<T.Group rotation.y={rotation}>
		<T is={$gltf.scene} scale={model.scale ?? 1} />
	</T.Group>
{/if}
