<script lang="ts">
import { Canvas } from '@threlte/core';
import { BoundaryFallback } from '$lib/components/composites';
import type { Model3D } from '$lib/config/models';
import { resolveCardConfig } from '$lib/config/models';
import SceneContent from './SceneContent.svelte';

interface Props {
	model: Model3D;
	onclick?: () => void;
	class?: string;
}

let { model, onclick, class: className }: Props = $props();

const config = $derived(resolveCardConfig(model));
let hovered = $state(false);
</script>

<button
	class="scene-card {className ?? ''}"
	{onclick}
	type="button"
	aria-label="View {model.name} in 3D viewer"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
>
	<svelte:boundary>
		<div class="canvas-container">
			<Canvas renderMode="always">
				<SceneContent {model} {config} {hovered} />
			</Canvas>
		</div>

		{#snippet failed(error, reset)}
			<BoundaryFallback
				title="3D unavailable"
				description="WebGL required"
				minHeight="100%"
				{reset}
			/>
		{/snippet}
	</svelte:boundary>

	<div class="card-info">
		<span class="{model.icon} text-sm" aria-hidden="true"></span>
		<span class="card-label">{model.name}</span>
		<span class="expand-icon i-lucide-expand" aria-hidden="true"></span>
	</div>
</button>

<style>
	.scene-card {
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		cursor: pointer;
		transition: border-color 150ms, box-shadow 150ms, transform 150ms;
	}

	.scene-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transform: translateY(-2px);
	}

	:global(.dark) .scene-card:hover {
		box-shadow: 0 0 20px color-mix(in srgb, var(--color-primary) 30%, transparent),
			0 0 8px color-mix(in srgb, var(--color-primary) 20%, transparent);
	}

	.scene-card:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.canvas-container {
		width: 100%;
		aspect-ratio: 4 / 3;
		background: var(--color-subtle);
	}

	.card-info {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	.card-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		flex: 1;
	}

	.expand-icon {
		opacity: 0;
		transition: opacity 150ms;
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.scene-card:hover .expand-icon {
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.scene-card {
			transition: none;
		}
		.scene-card:hover {
			transform: none;
		}
	}
</style>
