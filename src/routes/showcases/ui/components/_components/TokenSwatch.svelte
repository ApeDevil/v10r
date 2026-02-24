<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		label: string;
		value: string;
		preview?: 'color' | 'size' | 'shadow' | 'radius';
		class?: string;
	}

	let { label, value, preview, class: className }: Props = $props();
</script>

<div class={cn('token-swatch', className)}>
	{#if preview === 'color'}
		<div class="preview color-preview" style="background-color: {value};"></div>
	{:else if preview === 'shadow'}
		<div class="preview shadow-preview" style="box-shadow: {value};"></div>
	{:else if preview === 'radius'}
		<div class="preview radius-preview" style="border-radius: {value};"></div>
	{/if}

	<div class="token-info">
		<div class="token-label">{label}</div>
		<div class="token-value">{value}</div>
	</div>
</div>

<style>
	.token-swatch {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
	}

	.preview {
		flex-shrink: 0;
	}

	.color-preview,
	.shadow-preview,
	.radius-preview {
		width: 2.5rem;
		height: 2.5rem;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.shadow-preview {
		background: var(--color-bg);
	}

	.radius-preview {
		background: var(--color-primary);
	}

	.token-info {
		flex: 1;
		min-width: 0;
	}

	.token-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: var(--spacing-1);
	}

	.token-value {
		font-size: var(--text-fluid-xs);
		font-family: 'Fira Code', monospace;
		color: var(--color-muted);
		word-break: break-all;
	}
</style>
