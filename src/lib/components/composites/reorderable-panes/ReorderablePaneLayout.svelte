<script lang="ts">
import type { Snippet } from 'svelte';
import { onMount, tick } from 'svelte';
import { browser } from '$app/environment';
import { Pane, PaneGroup, PaneResizer } from '$lib/components/primitives';
import type { PaneGroupHandle } from '$lib/components/primitives/pane/PaneGroup.svelte';
import PaneTabBar from './PaneTabBar.svelte';
import type { PaneDefinition } from './reorderable-panes';

interface Props {
	panes: PaneDefinition[];
	direction?: 'horizontal' | 'vertical';
	persistId?: string;
	children: Snippet<[PaneDefinition]>;
	class?: string;
}

let { panes, direction = 'horizontal', persistId, children, class: className }: Props = $props();

let paneMap = $derived(Object.fromEntries(panes.map((p) => [p.id, p])) as Record<string, PaneDefinition>);

// State: order + sizes keyed by panel ID
let order = $state<string[]>(panes.map((p) => p.id));
let sizes = $state<Record<string, number>>(Object.fromEntries(panes.map((p) => [p.id, p.defaultSize])));

let groupRef = $state<PaneGroupHandle | undefined>();
let mounted = $state(false);

onMount(() => {
	mounted = true;

	if (browser && persistId) {
		const saved = loadPersistedLayout();
		if (saved) {
			order = saved.order;
			sizes = saved.sizes;
		}
	}
});

// Persistence: debounced save
let persistTimeout: ReturnType<typeof setTimeout> | null = null;

$effect(() => {
	if (!browser || !persistId || !mounted) return;

	// Track reactive dependencies
	const currentOrder = order;
	const currentSizes = sizes;

	if (persistTimeout) clearTimeout(persistTimeout);
	persistTimeout = setTimeout(() => {
		localStorage.setItem(
			`reorderable-panes-${persistId}`,
			JSON.stringify({ order: currentOrder, sizes: currentSizes }),
		);
	}, 300);

	return () => {
		if (persistTimeout) clearTimeout(persistTimeout);
	};
});

function loadPersistedLayout(): { order: string[]; sizes: Record<string, number> } | null {
	if (!browser || !persistId) return null;

	try {
		const raw = localStorage.getItem(`reorderable-panes-${persistId}`);
		if (!raw) return null;

		const { order: savedOrder, sizes: savedSizes } = JSON.parse(raw);

		// Merge strategy: keep saved order, append new panels
		const allIds = new Set(panes.map((p) => p.id));
		const validOrder = (savedOrder as string[]).filter((id: string) => allIds.has(id));
		const newIds = panes.map((p) => p.id).filter((id) => !validOrder.includes(id));
		const mergedOrder = [...validOrder, ...newIds];

		// Merge sizes: use saved for existing, defaults for new
		const mergedSizes: Record<string, number> = {};
		for (const p of panes) {
			mergedSizes[p.id] = savedSizes?.[p.id] ?? p.defaultSize;
		}

		return { order: mergedOrder, sizes: mergedSizes };
	} catch {
		return null;
	}
}

async function handleReorder(newOrder: string[]) {
	order = newOrder;

	await tick();

	if (groupRef) {
		const newLayout = newOrder.map((id) => sizes[id] ?? paneMap[id]?.defaultSize ?? 50);
		groupRef.setLayout(newLayout);
	}
}

function handlePaneResize(id: string, size: number) {
	sizes[id] = size;
}
</script>

<div class="reorderable-layout {direction === 'vertical' ? 'layout-vertical' : 'layout-horizontal'} {className ?? ''}">
	<PaneTabBar {panes} {order} {direction} onReorder={handleReorder} />

	{#key order.join(',')}
		<PaneGroup bind:this={groupRef} {direction} class="flex-1">
			{#each order as id, i (id)}
				{@const pane = paneMap[id]}
				{#if pane}
					<Pane
						defaultSize={sizes[id] ?? pane.defaultSize}
						minSize={pane.minSize}
						maxSize={pane.maxSize}
						collapsible={pane.collapsible}
						collapsedSize={pane.collapsedSize}
						onResize={(size) => handlePaneResize(id, size)}
					>
						{@render children(pane)}
					</Pane>
					{#if i < order.length - 1}
						<PaneResizer withHandle={true} />
					{/if}
				{/if}
			{/each}
		</PaneGroup>
	{/key}
</div>

<style>
	.reorderable-layout {
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.layout-horizontal {
		flex-direction: column;
	}

	.layout-vertical {
		flex-direction: row;
	}
</style>
