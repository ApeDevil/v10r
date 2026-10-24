<script lang="ts">
import { T, useTask, useThrelte } from '@threlte/core';
import { useGltf } from '@threlte/extras';
import { AnimationMixer, type PerspectiveCamera, Vector3 } from 'three';
import type { Model3D, ResolvedCardConfig } from '#lib/3d/models.ts';
import { THRELTE_MAKE_DEFAULT } from '#lib/utils/threlte-workarounds.ts';

interface Props {
	model: Model3D;
	config: ResolvedCardConfig;
	hovered?: boolean;
	/** The card is on screen and motion is allowed — the only time a frame loop runs. */
	animate?: boolean;
}

let { model, config, hovered = false, animate = false }: Props = $props();

const { invalidate } = useThrelte();

let rotation = $state(0);

// Tasks start stopped and run only while there is motion to draw. A running task
// requests the next frame of the on-demand canvas; a stopped one costs nothing.
const rotationTask = useTask(
	(delta) => {
		rotation += delta * config.autoRotation.speed;
	},
	{ autoStart: false },
);

const rotating = $derived(animate && config.autoRotation.enabled && !(config.autoRotation.pauseOnHover && hovered));

$effect(() => {
	if (rotating) rotationTask.start();
	else rotationTask.stop();
});

// Load model (useGltf returns a store)
// svelte-ignore state_referenced_locally
const gltf = useGltf(model.path);

// Animation support
let mixer: AnimationMixer | undefined;

let hasMixer = $state(false);

$effect(() => {
	const data = $gltf;
	if (!data || !model.animations) return;
	mixer = new AnimationMixer(data.scene);
	const clip = data.animations.find((c) => c.name === model.animations?.defaultClip);
	if (clip) mixer.clipAction(clip).play();
	// Pose the clip's first frame, so a card that never animates (off screen,
	// reduced motion) still shows the model in its clip's pose rather than its bind pose.
	mixer.update(0);
	invalidate();
	hasMixer = true;
});

const clipTask = useTask(
	(delta) => {
		mixer?.update(delta);
	},
	{ autoStart: false },
);

$effect(() => {
	if (animate && hasMixer) clipTask.start();
	else clipTask.stop();
});
</script>

<T.PerspectiveCamera
	makeDefault={THRELTE_MAKE_DEFAULT}
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
