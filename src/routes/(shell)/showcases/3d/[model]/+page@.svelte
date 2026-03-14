<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { Canvas } from '@threlte/core';
import { MODELS_BY_ID, resolveViewportConfig } from '$lib/config/models';
import { BoundaryFallback } from '$lib/components/composites';
import { ViewerScene } from '$lib/components/3d';

const model = $derived(MODELS_BY_ID.get(page.params.model));
const config = $derived(model ? resolveViewportConfig(model) : undefined);

let currentAnimation = $state('');

// Set default animation when model changes
$effect(() => {
	if (model?.animations) {
		currentAnimation = model.animations.defaultClip;
	}
});

// Redirect if model not found (once)
let redirected = false;
$effect(() => {
	if (!model && !redirected) {
		redirected = true;
		goto('/showcases/3d');
	}
});
</script>

<svelte:head>
	<title>{model ? `${model.name} - 3D Viewer` : '3D Viewer'} - Velociraptor</title>
</svelte:head>

{#if model && config}
	<svelte:boundary>
		<div class="viewport" style="touch-action: none;">
			<Canvas>
				<ViewerScene {model} {config} {currentAnimation} />
			</Canvas>
		</div>

		{#snippet failed(err, reset)}
			<BoundaryFallback
				title="3D scene unavailable"
				description="WebGL is required. Check browser support or graphics drivers."
				minHeight="100vh"
				{reset}
			/>
		{/snippet}
	</svelte:boundary>

	<div class="overlay">
		<div class="overlay-top">
			<a href="/showcases/3d" class="back-pill">
				<span class="i-lucide-arrow-left h-4 w-4" aria-hidden="true"></span>
				<span>3D</span>
			</a>
			<span class="model-label">{model.name}</span>
		</div>

		{#if model.animations}
			<div class="overlay-bottom">
				{#each model.animations.clips as anim}
					<button
						class="anim-btn"
						class:active={currentAnimation === anim}
						onclick={() => (currentAnimation = anim)}
					>
						{anim}
					</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}

<style>
	.viewport {
		position: fixed;
		inset: 0;
	}

	.overlay {
		position: fixed;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: var(--spacing-6) var(--spacing-5) var(--spacing-5);
		z-index: 10;
	}

	.overlay-top {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		pointer-events: auto;
		width: fit-content;
	}

	.overlay-bottom {
		display: flex;
		gap: var(--spacing-2);
		pointer-events: auto;
		width: fit-content;
	}

	.back-pill {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		background: color-mix(in srgb, var(--color-bg) 85%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		color: var(--color-fg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		text-decoration: none;
		transition: background var(--duration-fast);
	}

	.back-pill:hover {
		background: color-mix(in srgb, var(--color-bg) 95%, transparent);
	}

	.back-pill:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.model-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		padding: var(--spacing-3) var(--spacing-4);
		background: color-mix(in srgb, var(--color-bg) 75%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.anim-btn {
		padding: var(--spacing-2) var(--spacing-4);
		background: color-mix(in srgb, var(--color-bg) 80%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		transition: background var(--duration-fast), border-color var(--duration-fast);
		user-select: none;
	}

	.anim-btn:hover {
		background: color-mix(in srgb, var(--color-bg) 95%, transparent);
		color: var(--color-fg);
	}

	.anim-btn.active {
		background: var(--color-primary);
		color: var(--color-bg);
		border-color: var(--color-primary);
	}

	.anim-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
