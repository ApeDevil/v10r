<script lang="ts">
import type { Snippet } from 'svelte';
import EmptyState from '$lib/components/composites/empty-state/EmptyState.svelte';
import Button from '$lib/components/primitives/button/Button.svelte';

interface Props {
	error?: string;
	description?: string;
	onRetry?: () => void;
	dataTable?: Snippet;
}

let {
	error = 'Failed to load chart',
	description = 'Something went wrong rendering this chart',
	onRetry,
	dataTable,
}: Props = $props();
</script>

<EmptyState icon="i-lucide-triangle-alert" title={error} {description}>
	{#if onRetry}
		<Button variant="secondary" size="sm" onclick={onRetry}>
			<span class="i-lucide-refresh-cw text-icon-xs"></span>
			Retry
		</Button>
	{/if}
</EmptyState>

{#if dataTable}
	<details class="data-fallback">
		<summary>View data as table</summary>
		<div class="data-fallback-content">
			{@render dataTable()}
		</div>
	</details>
{/if}

<style>
	.data-fallback {
		border-top: 1px solid var(--color-border);
		padding: var(--spacing-4) var(--spacing-6);
	}

	.data-fallback summary {
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 500;
	}

	.data-fallback summary:hover {
		color: var(--color-fg);
	}

	.data-fallback-content {
		margin-top: var(--spacing-4);
		overflow-x: auto;
	}
</style>
