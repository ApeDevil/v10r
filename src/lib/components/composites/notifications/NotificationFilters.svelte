<script lang="ts">
	interface Props {
		active: string;
		onchange: (filter: string) => void;
	}

	let { active, onchange }: Props = $props();

	const filters = [
		{ key: 'all', label: 'All' },
		{ key: 'mentions', label: 'Mentions' },
		{ key: 'system', label: 'System' },
	];
</script>

<nav class="notification-filters" aria-label="Filter notifications">
	{#each filters as filter}
		<button
			class="filter-btn"
			class:active={active === filter.key}
			onclick={() => onchange(filter.key)}
		>
			{filter.label}
		</button>
	{/each}
</nav>

<style>
	.notification-filters {
		display: flex;
		gap: var(--spacing-1);
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
	}

	.filter-btn {
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		background: none;
		border: none;
		border-radius: var(--radius-md);
		cursor: pointer;
	}

	.filter-btn:hover {
		color: var(--color-fg);
		background-color: color-mix(in srgb, var(--color-muted) 10%, transparent);
	}

	.filter-btn.active {
		color: var(--color-primary);
		background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}
</style>
