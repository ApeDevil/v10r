<script lang="ts">
import { Canvas } from '@threlte/core';
import { Dialog as DialogPrimitive } from 'bits-ui';
import { MediaQuery } from 'svelte/reactivity';
import { BoundaryFallback } from '$lib/components/composites';
import type { Model3D } from '$lib/config/models';
import { resolveViewportConfig } from '$lib/config/models';
import { PART_EXPLORERS_BY_MODEL } from '$lib/config/parts';
import PartInfoPanel from './PartInfoPanel.svelte';
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

// Part explorer (opt-in per model)
const parts = $derived(PART_EXPLORERS_BY_MODEL.get(model.id));
let selectedPartId = $state<string | null>(null);
const selectedPart = $derived(parts?.find((p) => p.id === selectedPartId) ?? null);

const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

function selectPart(id: string | null) {
	selectedPartId = id;
	// Deep-link only in the standalone page; the landing-grid modal uses shallow
	// routing for its own URL, so we keep selection local there.
	if (standalone) {
		const url = new URL(window.location.href);
		if (id) url.searchParams.set('part', id);
		else url.searchParams.delete('part');
		history.replaceState(history.state, '', url.toString());
	}
}

// Restore selection from ?part= on first load (standalone only).
let urlApplied = false;
$effect(() => {
	if (!standalone || urlApplied || !parts?.length) return;
	urlApplied = true;
	const fromUrl = new URLSearchParams(window.location.search).get('part');
	if (fromUrl && parts.some((p) => p.id === fromUrl)) selectedPartId = fromUrl;
});

// Esc closes the (non-modal) part panel before anything else. Captured on window
// so it runs ahead of bits-ui's document-level layers — but never while the photo
// lightbox (a real modal) is mounted: that Esc belongs to the lightbox. DOM
// presence is the reliable signal — the event target can be anywhere.
function handleWindowKeydown(e: KeyboardEvent) {
	if (e.key !== 'Escape' || !selectedPartId) return;
	if (document.querySelector('[data-part-lightbox]')) return;
	e.stopPropagation();
	selectPart(null);
}

// svelte-ignore state_referenced_locally
let currentAnimation = $state(model.animations?.defaultClip ?? '');

function handleOpenChange(isOpen: boolean) {
	open = isOpen;
	if (!isOpen) {
		currentAnimation = model.animations?.defaultClip ?? '';
		selectPart(null);
		onclose?.();
	}
}
</script>

{#snippet viewerContent()}
	<svelte:boundary>
		<div class="viewport" style="touch-action: none;">
			<Canvas>
				<ViewerScene
					{model}
					{config}
					{currentAnimation}
					{parts}
					{selectedPartId}
					onpartselect={selectPart}
					reducedMotion={reducedMotion.current}
				/>
			</Canvas>
		</div>

		{#snippet failed(error: unknown, reset: () => void)}
			<BoundaryFallback
				title="3D scene unavailable"
				description="WebGL is required."
				minHeight="100vh"
				{reset}
			/>
		{/snippet}
	</svelte:boundary>
{/snippet}

{#snippet partPanel()}
	{#if selectedPart}
		<PartInfoPanel part={selectedPart} {customizeHref} onclose={() => selectPart(null)} />
	{/if}
{/snippet}

<svelte:window onkeydowncapture={handleWindowKeydown} />

{#if standalone}
	<div class="viewer-standalone">
		{@render viewerContent()}

		<ViewerOverlay
			{model}
			{currentAnimation}
			{customizeHref}
			{parts}
			{selectedPartId}
			onpartselect={selectPart}
			onanimationchange={(clip) => (currentAnimation = clip)}
		>
			{#snippet action()}
				<a href={backHref}>
					<span class="i-lucide-arrow-left h-4 w-4" aria-hidden="true"></span>
					<span>3D</span>
				</a>
			{/snippet}
		</ViewerOverlay>

		{@render partPanel()}
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
					{parts}
					{selectedPartId}
					onpartselect={selectPart}
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

				{@render partPanel()}
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
