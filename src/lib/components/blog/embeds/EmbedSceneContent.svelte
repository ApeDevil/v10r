<script lang="ts">
import { T, useTask } from '@threlte/core';
import { OrbitControls, useGltf } from '@threlte/extras';
import { AnimationMixer, type PerspectiveCamera, Vector3 } from 'three';

interface Props {
	path: string;
	scale?: number;
	cameraPosition: [number, number, number];
	cameraTarget: [number, number, number];
	cameraFov?: number;
	lightPosition: [number, number, number];
	lightIntensity?: number;
	ambientIntensity?: number;
	autoRotate?: boolean;
	controlsEnabled?: boolean;
	defaultAnimation?: string;
	onloaded?: () => void;
}

let {
	path,
	scale = 1,
	cameraPosition,
	cameraTarget,
	cameraFov = 50,
	lightPosition,
	lightIntensity = 1,
	ambientIntensity = 0.5,
	autoRotate = false,
	controlsEnabled = false,
	defaultAnimation,
	onloaded,
}: Props = $props();

// svelte-ignore state_referenced_locally
const gltf = useGltf(path);

let rotation = $state(0);
let mixer: AnimationMixer | undefined;
let notified = false;

// Auto-rotation
useTask((delta) => {
	if (autoRotate) {
		rotation += delta * 0.5;
	}
});

// Notify parent when model loads
$effect(() => {
	if ($gltf && !notified) {
		notified = true;
		onloaded?.();
	}
});

// Animation support
$effect(() => {
	const data = $gltf;
	if (!data || !defaultAnimation) return;
	mixer = new AnimationMixer(data.scene);
	const clip = data.animations.find((c) => c.name === defaultAnimation);
	if (clip) mixer.clipAction(clip).play();
});

useTask((delta) => {
	mixer?.update(delta);
});
</script>

<!-- @ts-ignore: Threlte makeDefault type requires tsgo conditional type support -->
<T.PerspectiveCamera
	makeDefault
	position={cameraPosition}
	fov={cameraFov}
	near={0.1}
	far={2000}
	oncreate={(ref: PerspectiveCamera) => {
		const [x, y, z] = cameraTarget;
		ref.lookAt(new Vector3(x, y, z));
	}}
>
	{#if controlsEnabled}
		<OrbitControls
			target={cameraTarget}
			enableZoom={true}
			enablePan={true}
		/>
	{/if}
</T.PerspectiveCamera>

<T.DirectionalLight position={lightPosition} intensity={lightIntensity} />
<T.AmbientLight intensity={ambientIntensity} />

{#if $gltf}
	<T.Group rotation.y={rotation}>
		<T is={$gltf.scene} {scale} />
	</T.Group>
{/if}
