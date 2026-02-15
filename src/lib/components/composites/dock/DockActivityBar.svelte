<script lang="ts">
	import { cn } from '$lib/utils/cn';
	import { getDockContext } from './dock.state.svelte';
	import { collectLeaves, generateId, hasPanelType } from './dock.operations';
	import type { ActivityBarItem, PanelDefinition } from './dock.types';

	interface Props {
		items: ActivityBarItem[];
		class?: string;
	}

	let { items, class: className }: Props = $props();

	const dock = getDockContext();

	function isTypeInLayout(panelType: string): boolean {
		return hasPanelType(dock.root, panelType, dock.panels);
	}

	function handleClick(item: ActivityBarItem) {
		if (isTypeInLayout(item.panelType)) {
			// Find and close all panels of this type
			const leaves = collectLeaves(dock.root);
			for (const leaf of leaves) {
				for (const tabId of leaf.tabs) {
					const panel = dock.panels[tabId];
					if (panel?.type === item.panelType) {
						dock.closePanel(tabId);
					}
				}
			}
		} else {
			// Create new instance and add to layout
			const panel: PanelDefinition = {
				id: `${item.panelType}-${Date.now()}`,
				type: item.panelType,
				label: item.label,
				icon: item.icon,
				closable: true
			};
			dock.addPanel(panel);
		}
	}
</script>

<div class={cn('dock-activity-bar', className)} role="toolbar" aria-label="Activity bar">
	{#each items as item (item.panelType)}
		{@const active = isTypeInLayout(item.panelType)}
		<button
			class={cn('dock-activity-btn', active && 'active')}
			title={item.label}
			aria-pressed={active}
			onclick={() => handleClick(item)}
		>
			<span class={cn('dock-activity-icon', item.icon)}></span>
		</button>
	{/each}
</div>

<style>
	.dock-activity-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		padding: 4px;
		background: var(--surface-0);
		border-right: 1px solid var(--color-border);
		width: 40px;
		flex-shrink: 0;
	}

	.dock-activity-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border-radius: var(--radius-md);
		color: var(--color-muted);
		position: relative;
		cursor: pointer;
	}

	.dock-activity-btn:hover {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.dock-activity-btn.active {
		color: var(--color-fg);
	}

	.dock-activity-btn.active::before {
		content: '';
		position: absolute;
		left: -4px;
		top: 6px;
		bottom: 6px;
		width: 2px;
		background: var(--color-primary);
		border-radius: var(--radius-full);
	}

	.dock-activity-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}

	.dock-activity-icon {
		font-size: 20px;
	}
</style>
