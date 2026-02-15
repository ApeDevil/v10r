<script lang="ts">
	import { getDockContext } from './dock.state.svelte';
	import DockTabBar from './DockTabBar.svelte';
	import DockDropOverlay from './DockDropOverlay.svelte';
	import type { LeafNode } from './dock.types';
	import type { Snippet } from 'svelte';

	interface Props {
		leaf: LeafNode;
		panelContent: Snippet<[string]>;
	}

	let { leaf, panelContent }: Props = $props();

	const dock = getDockContext();
</script>

<div class="dock-leaf">
	{#if leaf.tabs.length > 0}
		<DockTabBar {leaf} />
		<div class="dock-leaf-content">
			{@render panelContent(leaf.activeTab)}
			<DockDropOverlay leafId={leaf.id} />
		</div>
	{:else}
		<div class="dock-leaf-empty">
			<p>No panels open</p>
			<DockDropOverlay leafId={leaf.id} />
		</div>
	{/if}
</div>

<style>
	.dock-leaf {
		display: flex;
		flex-direction: column;
		height: 100%;
		width: 100%;
		min-width: 0;
		min-height: 0;
		background: var(--surface-1);
	}

	.dock-leaf-content {
		flex: 1;
		overflow: auto;
		position: relative;
		min-width: 0;
		min-height: 0;
	}

	.dock-leaf-empty {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		color: var(--color-muted);
		font-size: 0.875rem;
	}
</style>
