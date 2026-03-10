<script lang="ts">
import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte';

interface StateNodeData extends Record<string, unknown> {
	label?: string;
	variant: 'state' | 'start' | 'end';
}

type StateNodeType = Node<StateNodeData>;

let { data, isConnectable }: NodeProps<StateNodeType> = $props();
</script>

{#if data.variant === 'start'}
	<div class="start-node">
		<Handle type="source" position={Position.Right} {isConnectable} />
	</div>
{:else if data.variant === 'end'}
	<div class="end-node">
		<div class="end-inner"></div>
		<Handle type="target" position={Position.Left} {isConnectable} />
	</div>
{:else}
	<Handle type="target" position={Position.Left} {isConnectable} />
	<div class="state-node">
		{data.label ?? ''}
	</div>
	<Handle type="source" position={Position.Right} {isConnectable} />
{/if}

<style>
	.state-node {
		padding: 8px 20px;
		border-radius: 999px;
		background: var(--surface-1);
		border: 2px solid var(--color-border);
		color: var(--color-fg);
		font-size: 13px;
		font-weight: 500;
		min-width: 80px;
		text-align: center;
		line-height: 1.4;
	}

	:global(.svelte-flow__node.selected) .state-node {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary);
	}

	.start-node {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--color-fg);
	}

	.end-node {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: 2px solid var(--color-fg);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.end-inner {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--color-fg);
	}
</style>
