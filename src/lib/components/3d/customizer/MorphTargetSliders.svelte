<script lang="ts">
import type { MorphTargetGroup } from '$lib/config/customization';

interface Props {
	groups: MorphTargetGroup[];
	values: Record<string, number>;
	onchange: (key: string, value: number) => void;
}

let { groups, values, onchange }: Props = $props();
</script>

{#each groups as group (group.id)}
	<fieldset class="morph-group">
		<legend class="group-label">{group.label}</legend>
		<div class="sliders">
			{#each group.targets as target (target.name)}
				{@const key = `${group.meshName}.${target.name}`}
				{@const value = values[key] ?? target.default}
				<label class="slider-row">
					<span class="slider-label">{target.label}</span>
					<input
						type="range"
						min={target.min}
						max={target.max}
						step={0.01}
						{value}
						class="slider"
						oninput={(e) => onchange(key, Number(e.currentTarget.value))}
					/>
					<span class="slider-value">{value.toFixed(2)}</span>
				</label>
			{/each}
		</div>
	</fieldset>
{/each}

<style>
	.morph-group {
		border: none;
		padding: 0;
		margin: 0;
	}

	.group-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: var(--spacing-2);
	}

	.sliders {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.slider-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.slider-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		min-width: 5em;
		flex-shrink: 0;
	}

	.slider {
		flex: 1;
		height: 4px;
		accent-color: var(--color-primary);
		cursor: pointer;
	}

	.slider-value {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		min-width: 3em;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
</style>
