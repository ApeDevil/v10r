<script lang="ts">
	import type { CustomizationConfig, CustomizationState, CustomizationPreset } from '$lib/config/customization';
	import { checkConflicts, getDefaultState } from '$lib/config/customization';
	import MaterialPicker from './MaterialPicker.svelte';
	import PartToggleList from './PartToggleList.svelte';
	import MorphTargetSliders from './MorphTargetSliders.svelte';
	import AccessoryPicker from './AccessoryPicker.svelte';
	import PresetBar from './PresetBar.svelte';

	interface Props {
		config: CustomizationConfig;
		currentState: CustomizationState;
		activePresetId?: string;
		onmaterialchange: (groupId: string, optionId: string) => void;
		onparttoggle: (partId: string, visible: boolean) => void;
		onmorphchange: (key: string, value: number) => void;
		onaccessorytoggle: (accessoryId: string, active: boolean) => void;
		onpresetselect: (preset: CustomizationPreset) => void;
		onreset: () => void;
	}

	let {
		config,
		currentState,
		activePresetId,
		onmaterialchange,
		onparttoggle,
		onmorphchange,
		onaccessorytoggle,
		onpresetselect,
		onreset,
	}: Props = $props();

	let collapsed = $state(false);

	const disabledIds = $derived(checkConflicts(currentState, config));

	const hasContent = $derived(
		(config.materialGroups?.length ?? 0) > 0 ||
		(config.toggleableParts?.length ?? 0) > 0 ||
		(config.morphTargetGroups?.length ?? 0) > 0 ||
		(config.attachmentPoints?.length ?? 0) > 0
	);
</script>

<div class="panel" class:collapsed>
	<button class="panel-toggle" onclick={() => (collapsed = !collapsed)} aria-label={collapsed ? 'Expand panel' : 'Collapse panel'}>
		<span class={collapsed ? 'i-lucide-panel-left-open' : 'i-lucide-panel-right-open'} aria-hidden="true"></span>
	</button>

	{#if !collapsed && hasContent}
		<div class="panel-scroll">
			<div class="panel-header">
				<h2 class="panel-title">Customize</h2>
				<button class="reset-btn" onclick={onreset}>
					<span class="i-lucide-rotate-ccw" aria-hidden="true"></span>
					Reset
				</button>
			</div>

			{#if config.presets?.length}
				<section class="panel-section">
					<PresetBar presets={config.presets} activeId={activePresetId} onselect={onpresetselect} />
				</section>
			{/if}

			{#if config.materialGroups?.length}
				<section class="panel-section">
					{#each config.materialGroups as group (group.id)}
						<MaterialPicker
							{group}
							selectedId={currentState.materials[group.id] ?? group.defaultOptionId}
							{disabledIds}
							onselect={(optionId) => onmaterialchange(group.id, optionId)}
						/>
					{/each}
				</section>
			{/if}

			{#if config.toggleableParts?.length}
				<section class="panel-section">
					<PartToggleList
						parts={config.toggleableParts}
						visibility={currentState.partVisibility}
						ontoggle={onparttoggle}
					/>
				</section>
			{/if}

			{#if config.morphTargetGroups?.length}
				<section class="panel-section">
					<MorphTargetSliders
						groups={config.morphTargetGroups}
						values={currentState.morphValues}
						onchange={onmorphchange}
					/>
				</section>
			{/if}

			{#if config.attachmentPoints?.length}
				<section class="panel-section">
					<AccessoryPicker
						points={config.attachmentPoints}
						enabled={currentState.accessories}
						{disabledIds}
						ontoggle={onaccessorytoggle}
					/>
				</section>
			{/if}
		</div>
	{/if}
</div>

<style>
	.panel {
		position: relative;
		width: 280px;
		background: color-mix(in srgb, var(--color-bg) 95%, transparent);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-left: 1px solid var(--color-border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		flex-shrink: 0;
	}

	.panel.collapsed {
		width: auto;
	}

	.panel-toggle {
		position: absolute;
		top: var(--spacing-3);
		left: calc(-1 * var(--spacing-1));
		transform: translateX(-100%);
		padding: var(--spacing-2);
		background: color-mix(in srgb, var(--color-bg) 90%, transparent);
		backdrop-filter: blur(12px);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		color: var(--color-fg);
		cursor: pointer;
		z-index: 2;
	}

	.panel-toggle:hover {
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.panel-scroll {
		flex: 1;
		overflow-y: auto;
		padding: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
		scrollbar-width: thin;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		color: var(--color-fg);
		margin: 0;
	}

	.reset-btn {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-2);
		border: none;
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
		cursor: pointer;
	}

	.reset-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.panel-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding-bottom: var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.panel-section:last-child {
		border-bottom: none;
		padding-bottom: 0;
	}

	@media (max-width: 768px) {
		.panel {
			position: fixed;
			bottom: 0;
			left: 0;
			right: 0;
			width: 100%;
			max-height: 50dvh;
			border-left: none;
			border-top: 1px solid var(--color-border);
			border-radius: var(--radius-lg) var(--radius-lg) 0 0;
			z-index: 10;
		}

		.panel.collapsed {
			max-height: 0;
			border-top: none;
		}

		.panel-toggle {
			top: auto;
			bottom: calc(100% + var(--spacing-2));
			left: 50%;
			transform: translateX(-50%);
		}

		.panel.collapsed .panel-toggle {
			bottom: var(--spacing-3);
		}
	}
</style>
