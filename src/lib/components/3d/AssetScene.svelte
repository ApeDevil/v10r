<script lang="ts">
import { T, useThrelte } from '@threlte/core';
import { CameraControls, type CameraControlsRef } from '@threlte/extras';
import { Box3, type Group, type Material, type Mesh, type PerspectiveCamera, PMREMGenerator, Vector3 } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { THRELTE_MAKE_DEFAULT } from '#lib/utils/threlte-workarounds.ts';
import { resolveCssColor } from './css-color.ts';

interface Props {
	/** The loaded GLB scene, or nothing yet. */
	asset?: Group;
	/** Called once the frame showing a new asset has been drawn. */
	onpainted?: () => void;
	/** Draw every mesh as its triangle edges. */
	wireframe?: boolean;
	/** A floor grid under the asset, in theme colours. */
	grid?: boolean;
	/** Change it to frame the asset again (a "reset view" control). */
	frameKey?: number;
}

let { asset, onpainted, wireframe = false, grid = false, frameKey = 0 }: Props = $props();

const { invalidate, renderer, scene: world, camera } = useThrelte();
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

// Frame each new asset (or on `frameKey`) from a three-quarter view above it, then report the paint.
$effect(() => {
	void frameKey;
	if (!controls || !asset) return;
	const box = new Box3().setFromObject(asset);
	const center = box.getCenter(new Vector3());
	const reach = box.getSize(new Vector3()).length();
	// Far enough that the bounding sphere (radius reach / 2) fits the 40° field of view.
	const offset = new Vector3(0.55, 0.45, 0.75).normalize().multiplyScalar(reach * 1.55);
	controls.setLookAt(
		center.x + offset.x,
		center.y + offset.y,
		center.z + offset.z,
		center.x,
		center.y,
		center.z,
		false,
	);
	controls.maxDistance = reach * 4;
	// Clip planes follow the asset: a 6 cm part and a 60 m ring both stay inside the frustum.
	const view = camera.current as PerspectiveCamera;
	if (view.isPerspectiveCamera) {
		view.near = reach / 500;
		view.far = reach * 50;
		view.updateProjectionMatrix();
	}
	invalidate();
	requestAnimationFrame(() => requestAnimationFrame(() => onpainted?.()));
});

$effect(() => {
	if (!asset) return;
	asset.traverse((object) => {
		const material = (object as Mesh).material as Material | Material[] | undefined;
		for (const m of Array.isArray(material) ? material : material ? [material] : []) {
			if ('wireframe' in m) (m as Material & { wireframe: boolean }).wireframe = wireframe;
		}
	});
	invalidate();
});

const floor = $derived.by(() => {
	if (!grid || !asset) return null;
	const box = new Box3().setFromObject(asset);
	const size = box.getSize(new Vector3());
	const span = Math.max(size.x, size.z) * 1.6 || 1;
	return {
		span,
		position: [(box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2] as [number, number, number],
		major: resolveCssColor('color-muted', 'gray'),
		minor: resolveCssColor('e1-border', 'gray'),
	};
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
{#if floor}
	<T.GridHelper args={[floor.span, 10, floor.major, floor.minor]} position={floor.position} />
{/if}
