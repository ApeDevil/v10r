<script lang="ts">
	import { browser } from '$app/environment';
	import { setDockContext } from './dock.state.svelte';
	import { loadDockState, saveDockState } from './dock.persistence';
	import DockNode from './DockNode.svelte';
	import DockActivityBar from './DockActivityBar.svelte';
	import { hasPanelType } from './dock.operations';
	import type { LayoutNode, PanelDefinition, ActivityBarItem } from './dock.types';
	import type { Snippet } from 'svelte';

	interface Props {
		initialRoot: LayoutNode;
		initialPanels: Record<string, PanelDefinition>;
		activityBarItems?: ActivityBarItem[];
		persist?: boolean | string;
		openPanel?: string | null;
		panelContent: Snippet<[string]>;
		class?: string;
	}

	let {
		initialRoot,
		initialPanels,
		activityBarItems,
		persist = false,
		openPanel,
		panelContent,
		class: className
	}: Props = $props();

	const persistKey = typeof persist === 'string' ? persist : undefined;

	// Try to restore persisted state, fall back to initial
	const saved = persist ? loadDockState(persistKey) : null;
	const dock = setDockContext(
		saved?.root ?? initialRoot,
		saved?.panels ?? initialPanels,
		saved?.activityBarPosition ?? 'left'
	);

	// Debounced persistence — $state.snapshot() creates deep tracking
	// so in-place mutations (e.g. resizeSplit) also trigger saves.
	if (persist && browser) {
		let timer: ReturnType<typeof setTimeout>;
		$effect(() => {
			// snapshot() deeply reads all properties, establishing fine-grained tracking
			const root = $state.snapshot(dock.root) as LayoutNode;
			const panels = $state.snapshot(dock.panels) as Record<string, PanelDefinition>;
			const barPos = dock.activityBarPosition;
			clearTimeout(timer);
			timer = setTimeout(() => saveDockState(root, panels, persistKey, barPos), 300);
		});
	}

	// Open a panel type via prop (e.g. from URL search param)
	$effect(() => {
		if (!openPanel) return;
		if (hasPanelType(dock.root, openPanel, dock.panels)) return;
		const def = Object.values(initialPanels).find((p) => p.type === openPanel);
		if (!def) return;
		dock.addPanel({
			id: `${openPanel}-${Date.now()}`,
			type: def.type,
			label: def.label,
			icon: def.icon,
			closable: true
		});
	});

</script>

<div
	class="dock-layout {className ?? ''}"
	data-bar-position={dock.activityBarPosition}
>
	{#if activityBarItems && activityBarItems.length > 0}
		<DockActivityBar
			items={activityBarItems}
			position={dock.activityBarPosition}
		/>
	{/if}

	<div class="dock-content">
		<DockNode node={dock.root} {panelContent} />
	</div>
</div>

<style>
	.dock-layout {
		display: grid;
		height: 100%;
		width: 100%;
		overflow: hidden;
		background: var(--surface-0);
	}

	/* Grid layouts for each bar position */
	.dock-layout[data-bar-position='left'] {
		grid-template-areas: 'bar content';
		grid-template-columns: auto 1fr;
		grid-template-rows: 1fr;
	}

	.dock-layout[data-bar-position='right'] {
		grid-template-areas: 'content bar';
		grid-template-columns: 1fr auto;
		grid-template-rows: 1fr;
	}

	.dock-layout[data-bar-position='top'] {
		grid-template-areas: 'bar' 'content';
		grid-template-columns: 1fr;
		grid-template-rows: auto 1fr;
	}

	.dock-layout[data-bar-position='bottom'] {
		grid-template-areas: 'content' 'bar';
		grid-template-columns: 1fr;
		grid-template-rows: 1fr auto;
	}

	.dock-content {
		grid-area: content;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
	}
</style>
