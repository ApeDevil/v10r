<script lang="ts">
import { T } from '@threlte/core';
import type { Vec3 } from '$lib/product-composition';
import { conduitTube } from './conduit-tube';

interface Props {
	points: Vec3[];
	color: string;
	selected: boolean;
	onpick: () => void;
}

let { points, color, selected, onpick }: Props = $props();

const geometry = $derived(conduitTube(points));
// A rebuilt tube must free the old one's GPU buffers; garbage collection never does.
$effect(() => {
	const built = geometry;
	return () => built?.dispose();
});

function pick(event: { stopPropagation: () => void }) {
	event.stopPropagation();
	onpick();
}
</script>

{#if geometry}
	<T.Mesh {geometry} onclick={pick}>
		<T.MeshStandardMaterial {color} emissive={color} emissiveIntensity={selected ? 0.6 : 0.1} roughness={0.4} />
	</T.Mesh>
{/if}
