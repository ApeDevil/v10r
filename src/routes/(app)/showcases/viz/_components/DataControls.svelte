<script lang="ts">
import Select from '$lib/components/primitives/select/Select.svelte';
import Switch from '$lib/components/primitives/switch/Switch.svelte';

interface Props {
	dataset?: string;
	animated?: boolean;
}

let { dataset = $bindable('sales'), animated = $bindable(true) }: Props = $props();
</script>

<div class="data-controls">
	<div class="control-group">
		<span class="control-label">Dataset</span>
		<Select
			options={[
				{ value: 'sales', label: 'Sales' },
				{ value: 'traffic', label: 'Traffic' },
				{ value: 'performance', label: 'Performance' },
			]}
			bind:value={dataset}
		/>
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

</style>
