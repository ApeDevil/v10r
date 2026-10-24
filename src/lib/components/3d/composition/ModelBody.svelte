<script lang="ts">
import { T } from '@threlte/core';
import { useGltf } from '@threlte/extras';
import type { Model3D } from '#lib/3d/models.ts';

interface Props {
	model: Model3D;
	scale?: number;
	onclick: (event: { stopPropagation: () => void }) => void;
}

let { model, scale = 1, onclick }: Props = $props();

// svelte-ignore state_referenced_locally
const gltf = useGltf(model.path);
// useGltf caches by url: every occurrence of one model shares the load and clones the scene.
const scene = $derived.by(() => {
	const clone = $gltf?.scene.clone();
	// Models stand in the same lit room as the primitives: they cast and catch shadows too.
	clone?.traverse((object) => {
		object.castShadow = true;
		object.receiveShadow = true;
	});
	return clone;
});
</script>

{#if scene}
	<T is={scene} scale={scale * (model.scale ?? 1)} {onclick} />
{/if}
