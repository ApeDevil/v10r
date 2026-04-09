<script lang="ts">
import { Canvas } from '@threlte/core';
import { Dialog as DialogPrimitive } from 'bits-ui';
import { BoundaryFallback } from '$lib/components/composites';
import type { Model3D } from '$lib/config/models';
import { resolveViewportConfig } from '$lib/config/models';
import ViewerOverlay from './ViewerOverlay.svelte';
import ViewerScene from './ViewerScene.svelte';

interface Props {
	model: Model3D;
	open: boolean;
	onclose?: () => void;
	/** Render as standalone full-page viewer (no dialog wrapper, always open) */
	standalone?: boolean;
	/** Back href for standalone mode (default: '/showcases/3d') */
	backHref?: string;
}

let { model, open = $bindable(false), onclose, standalone = false, backHref = '/showcases/3d' }: Props = $props();

const config = $derived(resolveViewportConfig(model));
const customizeHref = $derived(model.customization ? `/showcases/3d/customize/${model.id}` : undefined);

// svelte-ignore state_referenced_locally
let currentAnimation = $state(model.animations?.defaultClip ?? '');

function handleOpenChange(isOpen: boolean) {
	open = isOpen;
	if (!isOpen) {
		currentAnimation = model.animations?.defaultClip ?? '';
		onclose?.();
	}
}
</script>

{#snippet viewerContent()}
	<svelte:boundary>
		<div class="viewport" style="touch-action: none;">
			<Canvas>
				<ViewerScene {model} {config} {currentAnimation} />
			</Canvas>
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
{/snippet}

{#if standalone}
	<div class="viewer-standalone">
		{@render viewerContent()}

		<ViewerOverlay
			{model}
			{currentAnimation}
			{customizeHref}
			onanimationchange={(clip) => (currentAnimation = clip)}
		>
			{#snippet action()}
				<a href={backHref}>
					<span class="i-lucide-arrow-left h-4 w-4" aria-hidden="true"></span>
					<span>3D</span>
				</a>
			{/snippet}
		</ViewerOverlay>
	</div>
{:else}
	<DialogPrimitive.Root {open} onOpenChange={handleOpenChange}>
		<DialogPrimitive.Portal>
			<DialogPrimitive.Overlay
				class="fixed inset-0 z-overlay bg-black data-[state=open]:animate-in data-[state=closed]:animate-out"
			/>
			<DialogPrimitive.Content class="viewer-content fixed inset-0 z-modal">
				<DialogPrimitive.Title class="sr-only">
					{model.name} - 3D Viewer
				</DialogPrimitive.Title>

				{@render viewerContent()}

				<ViewerOverlay
					{model}
					{currentAnimation}
					{customizeHref}
					onanimationchange={(clip) => (currentAnimation = clip)}
				>
					{#snippet action()}
						<DialogPrimitive.Close>
							<span class="i-lucide-x h-4 w-4" aria-hidden="true"></span>
							<span>Close</span>
							<kbd class="esc-hint">Esc</kbd>
						</DialogPrimitive.Close>
					{/snippet}
				</ViewerOverlay>
			</DialogPrimitive.Content>
		</DialogPrimitive.Portal>
	</DialogPrimitive.Root>
{/if}

<style>
	:global(.viewer-content) {
		display: flex;
		flex-direction: column;
	}

	.viewer-standalone {
		position: fixed;
		inset: 0;
	}

	.viewport {
		position: absolute;
		inset: 0;
		background: var(--color-bg);
	}
</style>
