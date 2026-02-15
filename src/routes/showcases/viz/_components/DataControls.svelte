<script lang="ts">
	import Switch from '$lib/components/primitives/switch/Switch.svelte';

	interface Props {
		dataset?: string;
		animated?: boolean;
	}

	let {
		dataset = $bindable('sales'),
		animated = $bindable(true),
	}: Props = $props();
</script>

<div class="data-controls">
	<div class="control-group">
		<label for="dataset-select" class="control-label">Dataset</label>
		<select id="dataset-select" class="dataset-select" bind:value={dataset}>
			<option value="sales">Sales</option>
			<option value="traffic">Traffic</option>
			<option value="performance">Performance</option>
		</select>
	</div>

	<div class="control-group">
		<Switch bind:checked={animated} label="Animate" size="sm" />
	</div>
</div>

<style>
	.data-controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-6);
		padding: var(--spacing-4) var(--spacing-5);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
		flex-wrap: wrap;
	}

	.control-group {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.control-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		white-space: nowrap;
	}

	.dataset-select {
		appearance: none;
		background: var(--surface-1);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-2) var(--spacing-4) var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 0.5rem center;
		padding-right: 2rem;
	}

	.dataset-select:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
