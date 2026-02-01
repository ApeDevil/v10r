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
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		background: var(--color-bg);
	}

	.preview {
		flex-shrink: 0;
	}

	.color-preview,
	.shadow-preview,
	.radius-preview {
		width: 40px;
		height: 40px;
		border: 1px solid var(--color-border);
		border-radius: 0.25rem;
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
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: 0.125rem;
	}

	.token-value {
		font-size: 0.75rem;
		font-family: 'Fira Code', monospace;
		color: var(--color-muted);
		word-break: break-all;
	}
</style>
