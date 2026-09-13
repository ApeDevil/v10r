<script lang="ts">
import type { Node, NodeProps } from '@xyflow/svelte';

// A column heading that pans and zooms with the graph — not selectable, not focusable.
let { data }: NodeProps<Node<{ label: string }>> = $props();
</script>

<div class="heading">{data.label}</div>

<style>
	.heading {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
		white-space: nowrap;
	}
</style>
