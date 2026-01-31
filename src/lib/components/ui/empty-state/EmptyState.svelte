<script lang="ts">
	interface Props {
		icon?: string;
		title: string;
		description?: string;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { icon, title, description, class: className, children }: Props = $props();
</script>

<div class="empty-state {className || ''}" role="status">
	{#if icon}
		<div class="empty-icon" aria-hidden="true">
			{icon}
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
		padding: 3rem 1.5rem;
		min-height: 300px;
	}

	.empty-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.5;
	}

	.empty-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 0.5rem 0;
		color: var(--color-fg);
	}

	.empty-description {
		font-size: 0.875rem;
		color: var(--color-muted);
		margin: 0 0 1.5rem 0;
		max-width: 400px;
		line-height: 1.6;
	}

	.empty-actions {
		display: flex;
		gap: 0.75rem;
		flex-wrap: wrap;
		justify-content: center;
	}

	@media (max-width: 640px) {
		.empty-state {
			padding: 2rem 1rem;
			min-height: 250px;
		}

		.empty-icon {
			font-size: 2.5rem;
		}

		.empty-title {
			font-size: 1.125rem;
		}

		.empty-actions {
			flex-direction: column;
			width: 100%;
		}
	}
</style>
