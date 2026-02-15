<script lang="ts">
	import { browser } from '$app/environment';
	import { setDockContext } from './dock.state.svelte';
	import { loadDockState, saveDockState } from './dock.persistence';
	import DockNode from './DockNode.svelte';
	import DockActivityBar from './DockActivityBar.svelte';
	import type { LayoutNode, PanelDefinition, ActivityBarItem } from './dock.types';
	import type { Snippet } from 'svelte';

	interface Props {
		initialRoot: LayoutNode;
		initialPanels: Record<string, PanelDefinition>;
		activityBarItems?: ActivityBarItem[];
		persist?: boolean;
		panelContent: Snippet<[string]>;
		class?: string;
	}

	let {
		initialRoot,
		initialPanels,
		activityBarItems,
		persist = false,
		panelContent,
		class: className
	}: Props = $props();

	// Try to restore persisted state, fall back to initial
	const saved = persist ? loadDockState() : null;
	const dock = setDockContext(
		saved?.root ?? initialRoot,
		saved?.panels ?? initialPanels
	);

	// Debounced persistence — $state.snapshot() creates deep tracking
	// so in-place mutations (e.g. resizeSplit) also trigger saves.
	if (persist && browser) {
		let timer: ReturnType<typeof setTimeout>;
		$effect(() => {
			// snapshot() deeply reads all properties, establishing fine-grained tracking
			const root = $state.snapshot(dock.root) as LayoutNode;
			const panels = $state.snapshot(dock.panels) as Record<string, PanelDefinition>;
			clearTimeout(timer);
			timer = setTimeout(() => saveDockState(root, panels), 300);
		});
	}
</script>

<div class="dock-layout {className ?? ''}">
	{#if activityBarItems && activityBarItems.length > 0}
		<DockActivityBar items={activityBarItems} />
	{/if}

	<div class="dock-content">
		<DockNode node={dock.root} {panelContent} />
	</div>
</div>

<style>
	.dock-layout {
		display: flex;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background: var(--surface-0);
	}

	.dock-content {
		flex: 1;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
</style>
