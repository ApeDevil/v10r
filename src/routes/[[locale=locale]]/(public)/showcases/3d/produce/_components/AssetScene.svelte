<script lang="ts">
import { T, useThrelte } from '@threlte/core';
import { CameraControls, type CameraControlsRef } from '@threlte/extras';
import { Box3, type Group, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THRELTE_MAKE_DEFAULT } from '#lib/utils/threlte-workarounds.ts';

interface Props {
	/** The loaded GLB scene, or nothing yet. */
	asset?: Group;
	/** Called once the frame showing a new asset has been drawn. */
	onpainted?: () => void;
}

let { asset, onpainted }: Props = $props();

const { invalidate, renderer, scene: world } = useThrelte();
let controls = $state<CameraControlsRef>();

// Image-based light from a generated studio room — no download, same as the composition editor.
$effect(() => {
	const generator = new PMREMGenerator(renderer);
	const studio = new RoomEnvironment();
	const environment = generator.fromScene(studio, 0.04).texture;
	world.environment = environment;
	world.environmentIntensity = 0.6;
	invalidate();
	return () => {
		world.environment = null;
		environment.dispose();
		studio.dispose();
		generator.dispose();
	};
});

// Frame each new asset from a three-quarter view above the ring plane, then report the paint.
$effect(() => {
	if (!controls || !asset) return;
	const box = new Box3().setFromObject(asset);
	const center = box.getCenter(new Vector3());
	const reach = box.getSize(new Vector3()).length();
	controls.setLookAt(
		center.x + reach * 0.55,
		center.y + reach * 0.45,
		center.z + reach * 0.75,
		center.x,
		center.y,
		center.z,
		false,
	);
	controls.maxDistance = reach * 4;
	invalidate();
	requestAnimationFrame(() => requestAnimationFrame(() => onpainted?.()));
});

// The GPU copies of the previous asset are freed when it is replaced.
$effect(() => {
	const current = asset;
	return () =>
		current?.traverse((object) => {
			if (
				'geometry' in object &&
				object.geometry &&
				typeof object.geometry === 'object' &&
				'dispose' in object.geometry
			) {
				(object.geometry as { dispose(): void }).dispose();
			}
		});
});
</script>

<T.PerspectiveCamera makeDefault={THRELTE_MAKE_DEFAULT} position={[10, 8, 14]} fov={40} near={0.05} far={500}>
	<CameraControls bind:ref={controls} />
</T.PerspectiveCamera>
<T.DirectionalLight position={[12, 20, 10]} intensity={2.2} />
<T.DirectionalLight position={[-10, 6, -8]} intensity={0.5} />
<T.HemisphereLight intensity={0.3} />

{#if asset}
	<T is={asset} />
{/if}
