<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		icon?: string;
		heading: string;
		description?: string;
		children?: Snippet;
	}

	let { icon = 'i-lucide-file', heading, description, children }: Props = $props();
</script>

<div class="empty-state">
	{#if icon}<span class={`empty-icon ${icon}`}></span>{/if}
	<p class="empty-heading">{heading}</p>
	{#if description}<p class="empty-desc">{description}</p>{/if}
	{#if children}
		<div class="empty-actions">
			{@render children()}
		</div>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 12px;
		text-align: center;
		padding: 32px;
	}

	.empty-icon {
		font-size: 40px;
		color: var(--color-muted);
		opacity: 0.3;
	}

	.empty-heading {
		font-size: 13px;
		font-weight: 500;
		color: var(--color-muted);
	}

	.empty-desc {
		font-size: 12px;
		color: var(--color-muted);
		opacity: 0.7;
	}

	.empty-actions {
		display: flex;
		gap: 8px;
		margin-top: 4px;
	}
</style>
