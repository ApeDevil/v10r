<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		label: string;
		children: Snippet;
		class?: string;
	}

	let { label, children, class: className }: Props = $props();
</script>

<div class={cn('diag-row', className)}>
	<span class="diag-label">{label}</span>
	<span class="diag-value">
		{@render children()}
	</span>
</div>

<style>
	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.diag-value :global(code) {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.diag-value :global(a) {
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		text-decoration: none;
	}

	.diag-value :global(a:hover) {
		text-decoration: underline;
	}

	.diag-value :global(a:focus-visible) {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}
</style>
