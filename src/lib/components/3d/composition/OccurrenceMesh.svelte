<script lang="ts">
import { T } from '@threlte/core';
import { MODELS_BY_ID } from '$lib/3d/models';
import type { ResolvedOccurrence } from '$lib/product-composition';
import { SELECTION_TOKEN, toneToken } from './composition-palette';
import ModelBody from './ModelBody.svelte';
import { colorOf } from './theme-colors.svelte';

interface Props {
	leaf: ResolvedOccurrence;
	colors: Record<string, string>;
	selected: boolean;
	/** Called with the top-level occurrence — a click inside a subassembly selects the subassembly. */
	onpick: (occurrence: string) => void;
}

let { leaf, colors, selected, onpick }: Props = $props();

function pick(event: { stopPropagation: () => void }) {
	event.stopPropagation();
	onpick(leaf.occurrence);
}

const model = $derived(leaf.geometry.source === 'model' ? MODELS_BY_ID.get(leaf.geometry.modelId) : undefined);
</script>

<T.Group position={leaf.placement.position} quaternion={leaf.placement.rotation}>
	{#if leaf.geometry.source === 'primitives'}
		{#each leaf.geometry.primitives as primitive, index (index)}
			<T.Mesh position={primitive.frame.position} quaternion={primitive.frame.rotation} onclick={pick}>
				{#if primitive.shape === 'box'}
					<T.BoxGeometry args={primitive.size} />
				{:else if primitive.shape === 'cylinder'}
					<T.CylinderGeometry args={[primitive.radius, primitive.radius, primitive.length, 32]} />
				{:else}
					<T.SphereGeometry args={[primitive.radius, 32, 16]} />
				{/if}
				<T.MeshStandardMaterial
					color={colorOf(colors, toneToken(primitive.tone))}
					emissive={colorOf(colors, SELECTION_TOKEN)}
					emissiveIntensity={selected ? 0.35 : 0}
					roughness={0.6}
				/>
			</T.Mesh>
		{/each}
	{:else if model}
		<ModelBody {model} scale={leaf.geometry.scale} onclick={pick} />
	{/if}
</T.Group>
