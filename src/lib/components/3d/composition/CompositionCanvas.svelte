<script lang="ts">
import { Canvas } from '@threlte/core';
import { NeutralToneMapping, PCFShadowMap } from 'three';
import { BoundaryFallback } from '#lib/components/composites/index.ts';
import CompositionScene, { type CompositionSceneProps } from './CompositionScene.svelte';

type Props = CompositionSceneProps & {
	/** Accessible name of the view — say where the non-visual way to do the same things is. */
	label: string;
	/** Shown when WebGL is unavailable. */
	unavailableTitle: string;
	unavailableDescription: string;
	class?: string;
};

let { label, unavailableTitle, unavailableDescription, class: className, ...scene }: Props = $props();
</script>

<svelte:boundary>
	<div class="composition-canvas {className ?? ''}" data-testid="composition-canvas" role="img" aria-label={label}>
		<!-- Khronos PBR Neutral: tone mapping made for products, so a token colour reads as itself. -->
		<Canvas renderMode="on-demand" toneMapping={NeutralToneMapping} shadows={PCFShadowMap}>
			<CompositionScene {...scene} />
		</Canvas>
	</div>

	{#snippet failed(_error: unknown, reset: () => void)}
		<BoundaryFallback title={unavailableTitle} description={unavailableDescription} minHeight="100%" {reset} />
	{/snippet}
</svelte:boundary>

<style>
	.composition-canvas {
		width: 100%;
		height: 100%;
		touch-action: none;
	}
</style>
