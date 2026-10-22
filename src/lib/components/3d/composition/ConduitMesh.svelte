<script lang="ts">
import { T } from '@threlte/core';
import { CylinderGeometry, Quaternion, Vector3 } from 'three';
import type { Vec3 } from '$lib/product-composition';
import { conduitTube } from './conduit-tube';
import type { SurfaceFinish } from './surface-finish';

interface Props {
	points: Vec3[];
	/** The conduit's port family colour: a band on each end's fitting. */
	band: string;
	/** The run itself: its colour, finish and radius. */
	body: { color: string; finish: SurfaceFinish; radius: number };
	selected: boolean;
	onpick: () => void;
}

let { points, band, body, selected, onpick }: Props = $props();

const UP = new Vector3(0, 1, 0);

// The radius alone, so a new `body` object with the same radius rebuilds nothing.
const radius = $derived(body.radius);
const geometry = $derived(conduitTube(points, radius));
/** A collar where the conduit meets each port, a little wider than the run. */
const fitting = $derived(new CylinderGeometry(radius * 1.45, radius * 1.45, 0.025, 20));
// A rebuilt tube must free the old one's GPU buffers; garbage collection never does.
$effect(() => {
	const built = [geometry, fitting];
	return () => {
		for (const each of built) each?.dispose();
	};
});

/** Each end's fitting: at the port, turned along the run that leaves it. */
const fittings = $derived.by(() => {
	if (points.length < 2) return [];
	const end = (at: Vec3, toward: Vec3) => {
		const direction = new Vector3(...toward).sub(new Vector3(...at)).normalize();
		const position = new Vector3(...at).addScaledVector(direction, 0.02);
		const rotation = new Quaternion().setFromUnitVectors(UP, direction);
		return {
			position: [position.x, position.y, position.z] as Vec3,
			quaternion: [rotation.x, rotation.y, rotation.z, rotation.w] as [number, number, number, number],
		};
	};
	return [end(points[0], points[1]), end(points[points.length - 1], points[points.length - 2])];
});

const glow = $derived(selected ? 0.6 : 0);

function pick(event: { stopPropagation: () => void }) {
	event.stopPropagation();
	onpick();
}
</script>

{#if geometry}
	<T.Mesh {geometry} castShadow receiveShadow onclick={pick}>
		<T.MeshPhysicalMaterial
			color={body.color}
			roughness={body.finish.roughness}
			metalness={body.finish.metalness}
			clearcoat={body.finish.clearcoat}
			clearcoatRoughness={body.finish.clearcoatRoughness}
			emissive={band}
			emissiveIntensity={glow}
		/>
	</T.Mesh>
	{#each fittings as end, index (index)}
		<T.Mesh geometry={fitting} position={end.position} quaternion={end.quaternion} castShadow onclick={pick}>
			<T.MeshPhysicalMaterial color={band} roughness={0.4} clearcoat={0.5} emissive={band} emissiveIntensity={glow} />
		</T.Mesh>
	{/each}
{/if}
