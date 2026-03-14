<script lang="ts">
import { Dialog as DialogPrimitive } from 'bits-ui';
import { Canvas } from '@threlte/core';
import type { Model3D } from '$lib/config/models';
import { resolveViewportConfig } from '$lib/config/models';
import { BoundaryFallback } from '$lib/components/composites';
import ViewerScene from './ViewerScene.svelte';

interface Props {
	model: Model3D;
	open: boolean;
	onclose?: () => void;
}

let { model, open = $bindable(false), onclose }: Props = $props();

const config = $derived(resolveViewportConfig(model));

let currentAnimation = $state(model.animations?.defaultClip ?? '');

function handleOpenChange(isOpen: boolean) {
	open = isOpen;
	if (!isOpen) {
		currentAnimation = model.animations?.defaultClip ?? '';
		onclose?.();
	}
}
</script>

<DialogPrimitive.Root {open} onOpenChange={handleOpenChange}>
	<DialogPrimitive.Portal>
		<DialogPrimitive.Overlay
			class="fixed inset-0 z-overlay bg-black data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<DialogPrimitive.Content
			class="viewer-content fixed inset-0 z-modal"
		>
			<DialogPrimitive.Title class="sr-only">
				{model.name} - 3D Viewer
			</DialogPrimitive.Title>

			<svelte:boundary>
				<div class="viewport" style="touch-action: none;">
					{#if open}
						<Canvas>
							<ViewerScene {model} {config} {currentAnimation} />
						</Canvas>
					{/if}
				</div>

				{#snippet failed(error, reset)}
					<BoundaryFallback
						title="3D scene unavailable"
						description="WebGL is required."
						minHeight="100vh"
						{reset}
					/>
				{/snippet}
			</svelte:boundary>

			<!-- Floating overlay -->
			<div class="overlay">
				<div class="overlay-top">
					<DialogPrimitive.Close class="back-pill">
						<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
						<span>Close</span>
						<kbd class="esc-hint">Esc</kbd>
					</DialogPrimitive.Close>

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
		</DialogPrimitive.Content>
	</DialogPrimitive.Portal>
</DialogPrimitive.Root>

<style>
	.viewer-content {
		/* Override Bits UI default dialog positioning */
		display: flex;
		flex-direction: column;
	}

	.viewport {
		position: absolute;
		inset: 0;
	}

	.overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: var(--spacing-6) var(--spacing-5) var(--spacing-5);
		z-index: 1;
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
		cursor: pointer;
		transition: background var(--duration-fast);
		user-select: none;
	}

	.back-pill:hover {
		background: color-mix(in srgb, var(--color-bg) 95%, transparent);
	}

	.back-pill:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.esc-hint {
		font-family: inherit;
		font-size: 0.75em;
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: 3px;
		padding: 1px 4px;
		line-height: 1.4;
	}

	@media (pointer: coarse) {
		.esc-hint {
			display: none;
		}
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
