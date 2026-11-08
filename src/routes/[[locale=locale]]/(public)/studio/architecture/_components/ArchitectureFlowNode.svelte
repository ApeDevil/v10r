<script lang="ts">
import { Handle, type Node, type NodeProps, Position } from '@xyflow/svelte';

interface ArchitectureNodeData extends Record<string, unknown> {
	label: string;
	kind: string;
	placement: string;
	zone: string;
	zoneKind: string;
	errors: number;
	warnings: number;
}

let { data, isConnectable }: NodeProps<Node<ArchitectureNodeData>> = $props();
</script>

<Handle type="target" position={Position.Left} {isConnectable} />

<div class="node" data-zone={data.zoneKind}>
	<span class="zone">{data.zone}</span>
	<span class="label">{data.label}</span>
	<span class="kind">{data.kind}</span>
	<span class="placement">{data.placement}</span>
	{#if data.errors > 0 || data.warnings > 0}
		<span class="flags">
			{#if data.errors > 0}<span class="error">{data.errors} ✕</span>{/if}
			{#if data.warnings > 0}<span class="warning">{data.warnings} !</span>{/if}
		</span>
	{/if}
</div>

<Handle type="source" position={Position.Right} {isConnectable} />

<style>
	.node {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 150px;
		max-width: 210px;
		padding: 8px 12px;
		border-radius: var(--radius-md);
		background: var(--surface-1);
		border: 1px solid var(--color-border);
		border-left-width: 4px;
		color: var(--color-fg);
		font-size: 12px;
		line-height: 1.35;
	}

	/* The zone is the trust boundary; its colour is the one thing the eye should catch first. */
	.node[data-zone='client'] {
		border-left-color: var(--color-primary);
	}

	.node[data-zone='application'] {
		border-left-color: var(--color-success);
	}

	.node[data-zone='data'] {
		border-left-color: var(--color-warning);
	}

	.node[data-zone='third-party'] {
		border-left-color: var(--color-error);
	}

	.zone {
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--color-muted);
	}

	.label {
		font-weight: 600;
		font-size: 13px;
	}

	.kind,
	.placement {
		color: var(--color-muted);
	}

	.flags {
		display: flex;
		gap: 6px;
		font-weight: 600;
	}

	.error {
		color: var(--color-error);
	}

	.warning {
		color: var(--color-warning);
	}

	:global(.svelte-flow__node.selected) .node {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 1px var(--color-primary);
	}
</style>
