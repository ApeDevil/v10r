<script lang="ts">
	import { Handle, Position, type NodeProps, type Node } from '@xyflow/svelte';

	interface FlowNodeData extends Record<string, unknown> {
		label: string;
		variant?: 'default' | 'decision' | 'terminal';
	}

	type FlowNode = Node<FlowNodeData>;

	let { data, isConnectable }: NodeProps<FlowNode> = $props();
</script>

<Handle type="target" position={Position.Top} {isConnectable} />

<div class="flow-node" class:decision={data.variant === 'decision'} class:terminal={data.variant === 'terminal'}>
	{data.label}
</div>

<Handle type="source" position={Position.Bottom} {isConnectable} />

<style>
	.flow-node {
		padding: 8px 16px;
		border-radius: var(--radius-md);
		background: var(--surface-1);
		border: 1px solid var(--color-border);
		color: var(--color-fg);
		font-size: 13px;
		font-weight: 500;
		min-width: 80px;
		text-align: center;
		line-height: 1.4;
	}

	.flow-node.decision {
		border-radius: 2px;
		transform: rotate(45deg);
		padding: 12px;
		min-width: unset;
	}

	.flow-node.decision > :global(*) {
		transform: rotate(-45deg);
	}

	.flow-node.terminal {
		border-radius: 999px;
		padding: 8px 20px;
		background: var(--color-subtle);
	}

	:global(.svelte-flow__node.selected) .flow-node {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary);
	}
</style>
