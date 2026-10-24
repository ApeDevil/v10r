<script lang="ts">
import { T } from '@threlte/core';
import { MODELS_BY_ID } from '#lib/3d/models.ts';
import type { ResolvedOccurrence } from '#lib/product-composition/index.ts';
import { SELECTION_TOKEN, toneToken } from './composition-palette';
import ModelBody from './ModelBody.svelte';
import { primitiveGeometry } from './primitive-geometry';
import { surfaceFinish, surfaceTexture } from './surface-finish';
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
			{@const finish = surfaceFinish(primitive.finish)}
			{@const texture = finish.texture ? surfaceTexture(finish.texture) : null}
			<T.Mesh
				geometry={primitiveGeometry(primitive)}
				position={primitive.frame.position}
				quaternion={primitive.frame.rotation}
				castShadow
				receiveShadow
				onclick={pick}
			>
				<T.MeshPhysicalMaterial
					color={colorOf(colors, toneToken(primitive.tone))}
					roughness={finish.roughness}
					metalness={finish.metalness}
					clearcoat={finish.clearcoat}
					clearcoatRoughness={finish.clearcoatRoughness}
					roughnessMap={texture}
					bumpMap={texture}
					bumpScale={finish.bumpScale}
					emissive={colorOf(colors, SELECTION_TOKEN)}
					emissiveIntensity={selected ? 0.35 : 0}
				/>
			</T.Mesh>
		{/each}
	{:else if model}
		<ModelBody {model} scale={leaf.geometry.scale} onclick={pick} />
	{/if}
</T.Group>
