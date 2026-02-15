<script lang="ts">
	import EmptyState from '$lib/components/composites/empty-state/EmptyState.svelte';
	import Button from '$lib/components/primitives/button/Button.svelte';

	interface Props {
		message?: string;
		description?: string;
		onRetry?: () => void;
	}

	let {
		message = 'No data available',
		description = 'Add data to see the visualization',
		onRetry,
	}: Props = $props();
</script>

<EmptyState icon="i-lucide-bar-chart-3" title={message} {description}>
	{#if onRetry}
		<Button variant="secondary" size="sm" onclick={onRetry}>
			<span class="i-lucide-refresh-cw text-icon-xs"></span>
			Retry
		</Button>
	{/if}
</EmptyState>
