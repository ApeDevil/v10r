<script lang="ts">
import { Canvas } from '@threlte/core';
import type { Group } from 'three';
import { NeutralToneMapping } from 'three';
import { BoundaryFallback } from '#lib/components/composites/index.ts';
import AssetScene from './AssetScene.svelte';

interface Props {
	asset?: Group;
	label: string;
	unavailableTitle: string;
	unavailableDescription: string;
	onpainted?: () => void;
}

let { asset, label, unavailableTitle, unavailableDescription, onpainted }: Props = $props();
</script>

<svelte:boundary>
	<div class="asset-canvas" data-testid="asset-canvas" role="img" aria-label={label}>
		<Canvas renderMode="on-demand" toneMapping={NeutralToneMapping}>
			<AssetScene {asset} {onpainted} />
		</Canvas>
	</div>

	{#snippet failed(_error: unknown, reset: () => void)}
		<BoundaryFallback title={unavailableTitle} description={unavailableDescription} minHeight="100%" {reset} />
	{/snippet}
</svelte:boundary>

<style>
	.asset-canvas {
		width: 100%;
		height: 100%;
		touch-action: none;
	}
</style>
