<script lang="ts">
import { Canvas } from '@threlte/core';
import { MediaQuery } from 'svelte/reactivity';
import { BoundaryFallback } from '$lib/components/composites';
import { resolveScene } from './resolve-scene';
import type { EmbedDescriptor } from '$lib/server/blog/types';
import EmbedSceneContent from './EmbedSceneContent.svelte';

interface Props {
	descriptor: EmbedDescriptor;
}

let { descriptor }: Props = $props();

const resolved = $derived(resolveScene(descriptor.attrs));
const height = $derived(Number.parseInt(descriptor.attrs.height ?? '400', 10));
const alt = $derived(
	descriptor.attrs.alt ??
		(resolved.type === 'registry' ? `${resolved.model.name} — interactive 3D model` : 'Interactive 3D model'),
);
const controlsAttr = $derived(descriptor.attrs.controls ?? 'orbit');
const hasControls = $derived(controlsAttr === 'orbit');

const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)');

type Phase = 'loading' | 'dormant' | 'active';
let phase = $state<Phase>('loading');

function handleLoaded() {
	phase = 'dormant';
}

function activate() {
	if (!hasControls) return;
	phase = 'active';
	containerEl?.focus();
}

function deactivate() {
	phase = 'dormant';
}

let containerEl = $state<HTMLElement>();

function handleKeydown(e: KeyboardEvent) {
	if (phase !== 'active') {
		if ((e.key === ' ' || e.key === 'Enter') && phase === 'dormant') {
			e.preventDefault();
			activate();
		}
		return;
	}

	switch (e.key) {
		case 'Escape':
			e.preventDefault();
			deactivate();
			break;
	}
}

// Derive model path and config for the scene content
const modelPath = $derived(
	resolved.type === 'registry'
		? resolved.model.path
		: resolved.type === 'url'
			? resolved.path
			: null,
);

const modelScale = $derived(
	resolved.type === 'registry' ? (resolved.model.scale ?? 1) : 1,
);

const cameraPosition = $derived(
	resolved.type === 'registry'
		? resolved.model.camera.position
		: resolved.type === 'url'
			? resolved.config.camera.position
			: [3, 3, 3] as [number, number, number],
);

const cameraTarget = $derived(
	resolved.type === 'registry'
		? resolved.model.camera.target
		: resolved.type === 'url'
			? resolved.config.camera.target
			: [0, 0, 0] as [number, number, number],
);

const cameraFov = $derived(
	resolved.type === 'registry'
		? (resolved.model.camera.fov ?? 50)
		: 50,
);

const lightPosition = $derived(
	resolved.type === 'registry'
		? resolved.model.lighting.directionalPosition
		: resolved.type === 'url'
			? resolved.config.lighting.directionalPosition
			: [10, 10, 10] as [number, number, number],
);

const lightIntensity = $derived(
	resolved.type === 'registry'
		? (resolved.model.lighting.directionalIntensity ?? 1)
		: 1,
);

const ambientIntensity = $derived(
	resolved.type === 'registry'
		? (resolved.model.lighting.ambientIntensity ?? 0.5)
		: 0.5,
);

const hasAnimations = $derived(
	resolved.type === 'registry' && !!resolved.model.animations,
);

const defaultAnimation = $derived(
	resolved.type === 'registry'
		? resolved.model.animations?.defaultClip
		: undefined,
);

const autoRotate = $derived(phase === 'dormant' && !reducedMotion.current);
const controlsEnabled = $derived(phase === 'active' && hasControls);
const renderMode = $derived(hasAnimations || phase === 'dormant' ? 'always' : 'on-demand');

function handleError() {
	phase = 'loading';
}
</script>

{#if resolved.type === 'error'}
	<div class="scene-error" style:height="{height}px" role="alert">
		<span class="i-lucide-alert-triangle error-icon" aria-hidden="true"></span>
		<p class="error-text">{resolved.reason}</p>
	</div>
{:else}
	<figure
		class="scene-embed"
		role="figure"
		aria-label={alt}
		bind:this={containerEl}
		tabindex="0"
		onkeydown={handleKeydown}
	>
		<svelte:boundary>
			<div
				class="canvas-wrapper"
				style:height="{height}px"
				style:touch-action={phase === 'active' ? 'none' : 'auto'}
			>
				{#if modelPath}
					<Canvas {renderMode}>
						<EmbedSceneContent
							path={modelPath}
							scale={modelScale}
							{cameraPosition}
							{cameraTarget}
							{cameraFov}
							{lightPosition}
							{lightIntensity}
							{ambientIntensity}
							{autoRotate}
							{controlsEnabled}
							{defaultAnimation}
							onloaded={handleLoaded}
						/>
					</Canvas>
				{/if}

				{#if phase === 'loading'}
					<div class="loading-overlay" aria-hidden="true">
						<span class="i-lucide-loader-2 spinner" aria-hidden="true"></span>
						<span class="loading-text">Loading 3D model...</span>
					</div>
				{/if}

				{#if phase === 'dormant' && hasControls}
					<button
						class="activation-overlay"
						onclick={activate}
						aria-label="Click to interact with 3D model"
					>
						<span class="interact-badge">
							<span class="i-lucide-rotate-3d badge-icon" aria-hidden="true"></span>
							Drag to orbit
						</span>
					</button>
				{/if}

				{#if phase === 'active'}
					<button
						class="dismiss-pill"
						onclick={deactivate}
						aria-label="Deactivate 3D viewer, return to page scroll"
					>
						<span class="i-lucide-x dismiss-icon" aria-hidden="true"></span>
						Exit viewer
					</button>
				{/if}
			</div>

			{#snippet failed(error, reset)}
				<BoundaryFallback
					title="3D unavailable"
					description="WebGL is required to view this content."
					minHeight="{height}px"
					{reset}
				/>
			{/snippet}
		</svelte:boundary>

		{#if descriptor.attrs.alt}
			<noscript>
				<p>{descriptor.attrs.alt}</p>
			</noscript>
		{/if}
	</figure>
{/if}

<style>
	.scene-embed {
		position: relative;
		margin: 1.5em 0;
		border-radius: var(--radius-md, 8px);
		overflow: hidden;
		border: 1px solid var(--color-border);
		outline: none;
	}

	.scene-embed:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.canvas-wrapper {
		position: relative;
		width: 100%;
		background: var(--color-subtle);
	}

	/* Loading overlay */
	.loading-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2, 4px);
		background: var(--color-subtle);
		color: var(--color-muted);
		font-size: 0.875rem;
	}

	.spinner {
		width: 1.5rem;
		height: 1.5rem;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.loading-text {
		font-size: 0.75rem;
	}

	/* Click-to-activate overlay */
	.activation-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: flex-end;
		justify-content: flex-start;
		padding: var(--spacing-3, 8px);
		background: transparent;
		border: none;
		cursor: pointer;
		color: inherit;
		font: inherit;
	}

	.interact-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		background: color-mix(in srgb, var(--color-bg) 80%, transparent);
		backdrop-filter: blur(4px);
		border-radius: var(--radius-md, 8px);
		font-size: 0.75rem;
		color: var(--color-muted);
		pointer-events: none;
	}

	.badge-icon {
		width: 0.875rem;
		height: 0.875rem;
	}

	/* Dismiss pill (active state) */
	.dismiss-pill {
		position: absolute;
		top: var(--spacing-2, 4px);
		right: var(--spacing-2, 4px);
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.5rem;
		background: color-mix(in srgb, var(--color-bg) 80%, transparent);
		backdrop-filter: blur(4px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md, 8px);
		font-size: 0.6875rem;
		color: var(--color-muted);
		cursor: pointer;
	}

	.dismiss-pill:hover {
		color: var(--color-fg);
	}

	.dismiss-icon {
		width: 0.75rem;
		height: 0.75rem;
	}

	/* Error state */
	.scene-error {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-2, 4px);
		margin: 1.5em 0;
		border: 2px dashed var(--color-border);
		border-radius: var(--radius-md, 8px);
		background: var(--color-subtle);
		color: var(--color-muted);
	}

	.error-icon {
		width: 1.5rem;
		height: 1.5rem;
		color: var(--color-error, #ef4444);
	}

	.error-text {
		font-size: 0.875rem;
		margin: 0;
	}

	@media (prefers-reduced-motion: reduce) {
		.spinner {
			animation: none;
		}
	}
</style>
