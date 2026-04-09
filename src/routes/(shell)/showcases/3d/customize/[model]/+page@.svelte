<script lang="ts">
import { Canvas } from '@threlte/core';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { CustomizerPanel } from '$lib/components/3d/customizer';
import GltfCustomizer from '$lib/components/3d/customizer/GltfCustomizer.svelte';
import ViewerOverlay from '$lib/components/3d/ViewerOverlay.svelte';
import ViewerScene from '$lib/components/3d/ViewerScene.svelte';
import { BoundaryFallback } from '$lib/components/composites';
import {
	applyPreset,
	type CustomizationPreset,
	type CustomizationState,
	getDefaultState,
} from '$lib/config/customization';
import { MODELS_BY_ID, resolveViewportConfig } from '$lib/config/models';

const model = $derived(MODELS_BY_ID.get(page.params.model ?? ''));
const customization = $derived(model?.customization);
const config = $derived(model ? resolveViewportConfig(model) : undefined);

let redirected = false;
$effect(() => {
	if ((!model || !customization) && !redirected) {
		redirected = true;
		goto('/showcases/3d');
	}
});

// State management
// svelte-ignore state_referenced_locally
let custState = $state<CustomizationState>(
	customization
		? getDefaultState(customization)
		: { materials: {}, partVisibility: {}, morphValues: {}, accessories: {} },
);
let activePresetId = $state<string | undefined>(undefined);

// Apply preset from URL on load
$effect(() => {
	if (!customization?.presets) return;
	const presetParam = new URLSearchParams(window.location.search).get('preset');
	if (presetParam) {
		const preset = customization.presets.find((p) => p.id === presetParam);
		if (preset) {
			custState = applyPreset(getDefaultState(customization), preset);
			activePresetId = preset.id;
		}
	}
});

function handleMaterialChange(groupId: string, optionId: string) {
	custState.materials[groupId] = optionId;
	activePresetId = undefined;
	clearPresetParam();
}

function handlePartToggle(partId: string, visible: boolean) {
	custState.partVisibility[partId] = visible;
	activePresetId = undefined;
	clearPresetParam();
}

function handleMorphChange(key: string, value: number) {
	custState.morphValues[key] = value;
	activePresetId = undefined;
	clearPresetParam();
}

function handleAccessoryToggle(accessoryId: string, active: boolean) {
	custState.accessories[accessoryId] = active;
	activePresetId = undefined;
	clearPresetParam();
}

function handlePresetSelect(preset: CustomizationPreset) {
	if (!customization) return;
	custState = applyPreset(getDefaultState(customization), preset);
	activePresetId = preset.id;
	const url = new URL(window.location.href);
	url.searchParams.set('preset', preset.id);
	history.replaceState(history.state, '', url.toString());
}

function handleReset() {
	if (!customization) return;
	custState = getDefaultState(customization);
	activePresetId = undefined;
	clearPresetParam();
}

function clearPresetParam() {
	const url = new URL(window.location.href);
	if (url.searchParams.has('preset')) {
		url.searchParams.delete('preset');
		history.replaceState(history.state, '', url.toString());
	}
}

let currentAnimation = $state('');
$effect(() => {
	if (model?.animations) {
		currentAnimation = model.animations.defaultClip;
	}
});
</script>

<svelte:head>
	<title>{model ? `Customize ${model.name}` : 'Customizer'} - Velociraptor</title>
</svelte:head>

{#if model && customization && config}
	<div class="customizer-layout">
		<div class="canvas-area">
			<svelte:boundary>
				<div class="viewport" style="touch-action: none;">
					<Canvas>
						<ViewerScene {model} {config} {currentAnimation} />
						<GltfCustomizer modelPath={model.path} config={customization} currentState={custState} />
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

			<ViewerOverlay
				{model}
				{currentAnimation}
				onanimationchange={(clip) => (currentAnimation = clip)}
			>
				{#snippet action()}
					<a href="/showcases/3d/{model.id}">
						<span class="i-lucide-arrow-left h-4 w-4" aria-hidden="true"></span>
						<span>Back</span>
					</a>
				{/snippet}
			</ViewerOverlay>
		</div>

		<CustomizerPanel
			config={customization}
			currentState={custState}
			{activePresetId}
			onmaterialchange={handleMaterialChange}
			onparttoggle={handlePartToggle}
			onmorphchange={handleMorphChange}
			onaccessorytoggle={handleAccessoryToggle}
			onpresetselect={handlePresetSelect}
			onreset={handleReset}
		/>
	</div>
{/if}

<style>
	.customizer-layout {
		position: fixed;
		inset: 0;
		display: flex;
	}

	.canvas-area {
		flex: 1;
		position: relative;
		min-width: 0;
	}

	.viewport {
		position: absolute;
		inset: 0;
		background: var(--color-bg);
	}

	@media (max-width: 768px) {
		.customizer-layout {
			flex-direction: column;
		}

		.canvas-area {
			flex: 1;
		}
	}
</style>
