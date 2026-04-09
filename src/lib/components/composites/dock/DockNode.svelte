<script lang="ts">
import type { Snippet } from 'svelte';
import DockLeaf from './DockLeaf.svelte';
import DockNode from './DockNode.svelte';
import DockResizeHandle from './DockResizeHandle.svelte';
import type { LayoutNode } from './dock.types';

interface Props {
	node: LayoutNode;
	panelContent: Snippet<[string]>;
}

let { node, panelContent }: Props = $props();
</script>

{#if node.type === 'leaf'}
	<DockLeaf leaf={node} {panelContent} />
{:else}
	<div
		class="dock-split"
		class:horizontal={node.direction === 'horizontal'}
		class:vertical={node.direction === 'vertical'}
	>
		<div class="dock-split-child" style="flex-basis:{node.sizes[0]}%">
			<DockNode node={node.children[0]} {panelContent} />
		</div>

		<DockResizeHandle
			splitId={node.id}
			direction={node.direction}
			sizes={node.sizes}
		/>

		<div class="dock-split-child" style="flex-basis:{node.sizes[1]}%">
			<DockNode node={node.children[1]} {panelContent} />
		</div>
	</div>
{/if}

<style>
	.dock-split {
		display: flex;
		overflow: hidden;
		width: 100%;
		height: 100%;
	}

	.dock-split.vertical {
		flex-direction: column;
	}

	.dock-split-child {
		flex: 0 0 auto;
		overflow: hidden;
		min-width: 0;
		min-height: 0;
	}
</style>
