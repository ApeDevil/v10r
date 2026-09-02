<script lang="ts">
import { T, useTask, useThrelte } from '@threlte/core';
import { CameraControls, interactivity, OrbitControls, useGltf } from '@threlte/extras';
import type CameraControlsImpl from 'camera-controls';
import { tick } from 'svelte';
import { AnimationClip, AnimationMixer, Box3 } from 'three';
import type { Model3D, ResolvedViewportConfig } from '$lib/3d/models';
import { collectPartMeshes, type PartDef, resolvePartId } from '$lib/3d/parts';
import { THRELTE_MAKE_DEFAULT } from '$lib/utils/threlte-workarounds';
import PartHighlightLayer from './PartHighlightLayer.svelte';

interface Props {
	model: Model3D;
	config: ResolvedViewportConfig;
	currentAnimation: string;
	/** When provided, enables click-to-inspect part picking (opt-in per model). */
	parts?: PartDef[];
	/** Currently selected part id (drives highlight + camera fly-to). */
	selectedPartId?: string | null;
	/** Called when a part is picked, or null when empty space is clicked. */
	onpartselect?: (id: string | null) => void;
	/** Skip fly-to animation for reduced-motion users. */
	reducedMotion?: boolean;
}

let {
	model,
	config,
	currentAnimation,
	parts,
	selectedPartId = null,
	onpartselect,
	reducedMotion = false,
}: Props = $props();

const interactive = !!parts?.length;
// Enable pointer-event raycasting only for interactive models (sofa). No-op for
// every other model, so their behavior is unchanged.
if (interactive) interactivity();

// svelte-ignore state_referenced_locally
const gltf = useGltf(model.path);
const { invalidate } = useThrelte();

let mixer: AnimationMixer | undefined;

// When the model has morph target customization, strip morph tracks from
// animations so the mixer doesn't overwrite the customizer's values.
// svelte-ignore state_referenced_locally
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

// Part picking + camera fly-to (interactive mode only)

/** Minimal shape of a Threlte interactivity intersection event we rely on. */
interface PickEvent {
	object: { name: string };
	stopPropagation: () => void;
}

let hoveredId = $state<string | null>(null);
let controls = $state<CameraControlsImpl>();
let framedOnce = false;

function handleClick(e: PickEvent) {
	e.stopPropagation();
	onpartselect?.(resolvePartId(e.object.name, parts ?? []));
}
function handlePointerMove(e: PickEvent) {
	e.stopPropagation();
	hoveredId = resolvePartId(e.object.name, parts ?? []);
}

// Frame the camera from the model preset once CameraControls is ready.
$effect(() => {
	if (!interactive || !controls || framedOnce) return;
	framedOnce = true;
	const [px, py, pz] = config.camera.position;
	const [tx, ty, tz] = config.camera.target;
	controls.setLookAt(px, py, pz, tx, ty, tz, false);
});

// Smoothly frame the selected part. CameraControls self-invalidates during the
// transition, so on-demand render mode is fine.
$effect(() => {
	const data = $gltf;
	const id = selectedPartId;
	const c = controls;
	if (!interactive || !data || !c || !id) return;
	const part = parts?.find((p) => p.id === id);
	if (!part) return;
	void (async () => {
		await tick(); // props settled
		data.scene.updateMatrixWorld(true); // world matrices current before bounds
		const box = new Box3();
		for (const mesh of collectPartMeshes(data.scene, part)) box.expandByObject(mesh);
		if (box.isEmpty()) return;
		await c.fitToBox(box, !reducedMotion, {
			paddingTop: 0.15,
			paddingBottom: 0.15,
			paddingLeft: 0.15,
			paddingRight: 0.15,
		});
		invalidate();
	})();
});
</script>

<T.PerspectiveCamera
	makeDefault={THRELTE_MAKE_DEFAULT}
	position={config.camera.position}
	fov={config.camera.fov}
	near={config.camera.near}
	far={config.camera.far}
	oncreate={(ref) => {
		ref.lookAt(...config.camera.target);
	}}
>
	{#if interactive}
		<CameraControls bind:ref={controls} />
	{:else}
		<OrbitControls
			target={config.camera.target}
			enableZoom={config.controls.enableZoom}
			enablePan={config.controls.enablePan}
		/>
	{/if}
</T.PerspectiveCamera>

<T.DirectionalLight
	position={config.lighting.directionalPosition}
	intensity={config.lighting.directionalIntensity}
/>
<T.AmbientLight intensity={config.lighting.ambientIntensity} />

{#if $gltf}
	{#if interactive}
		<T
			is={$gltf.scene}
			scale={model.scale ?? 1}
			onclick={handleClick}
			onpointermove={handlePointerMove}
			onpointerleave={() => (hoveredId = null)}
			onpointermissed={() => onpartselect?.(null)}
		/>
		<PartHighlightLayer scene={$gltf.scene} parts={parts ?? []} {selectedPartId} hoveredPartId={hoveredId} />
	{:else}
		<T is={$gltf.scene} scale={model.scale ?? 1} />
	{/if}
{/if}

{#if model.showGrid}
	<T.GridHelper args={model.gridArgs ?? [10, 10]} />
{/if}
