<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		icon?: string;
		title: string;
		description?: string;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { icon, title, description, class: className, children }: Props = $props();
</script>

<div class={cn('empty-state', className)} role="status">
	{#if icon}
		<div class="empty-icon" aria-hidden="true">
			<span class="{icon}"></span>
		</div>
	{/if}

	<h2 class="empty-title">{title}</h2>

	{#if description}
		<p class="empty-description">{description}</p>
	{/if}

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
		text-align: center;
		padding: var(--spacing-8) var(--spacing-6);
		min-height: 18.75rem;
	}

	.empty-icon {
		font-size: var(--text-fluid-4xl);
		margin-bottom: var(--spacing-4);
		opacity: 0.5;
	}

	.empty-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.empty-description {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0 0 var(--spacing-6) 0;
		max-width: 25rem;
		line-height: 1.6;
	}

	.empty-actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 640px) {
		.empty-state {
			padding: var(--spacing-7) var(--spacing-4);
			min-height: 15.625rem;
		}

		.empty-icon {
			font-size: var(--text-fluid-3xl);
		}

		.empty-title {
			font-size: var(--text-fluid-base);
		}

		.empty-actions {
			flex-direction: column;
			width: 100%;
		}
	}
</style>
