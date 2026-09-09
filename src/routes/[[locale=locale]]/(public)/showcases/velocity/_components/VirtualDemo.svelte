<script lang="ts">
import { Stack } from '$lib/components/layout';
import { Button, VirtualList } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

const ROW_HEIGHT = 32;
const SIZES = [200, 2_000, 10_000];

interface Row {
	id: number;
	label: string;
	value: string;
}

let size = $state(10_000);
const rows = $derived<Row[]>(
	Array.from({ length: size }, (_, i) => ({
		id: i,
		label: `#${String(i + 1).padStart(5, '0')}`,
		value: ((i * 7919) % 1000).toString().padStart(3, '0'),
	})),
);

/** Rows actually in the DOM: the viewport's worth plus overscan, whatever `size` is. */
const rendered = $derived(Math.min(rows.length, Math.ceil(320 / ROW_HEIGHT) + 9));
</script>

<Stack gap="3">
	<div class="controls">
		{#each SIZES as option (option)}
			<Button variant={size === option ? 'secondary' : 'outline'} size="sm" onclick={() => (size = option)}>
				{option.toLocaleString()}
			</Button>
		{/each}
		<span class="count">{m.showcase_velocity_virtual_count({ total: rows.length, rendered })}</span>
	</div>

	<VirtualList
		items={rows}
		itemHeight={ROW_HEIGHT}
		height="20rem"
		label={m.showcase_velocity_virtual_aria()}
		class="demo-list"
	>
		{#snippet row(item: Row, index: number)}
			<span class="cell id">{item.label}</span>
			<span class="cell">{m.showcase_velocity_virtual_row({ index: index + 1 })}</span>
			<span class="cell num">{item.value}</span>
		{/snippet}
	</VirtualList>

	<p class="text-muted text-fluid-sm">{m.showcase_velocity_virtual_note()}</p>
</Stack>

<style>
.controls {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: var(--spacing-2);
}

.count {
	font-size: var(--text-fluid-sm);
	color: var(--color-muted);
	font-variant-numeric: tabular-nums;
}

:global(.demo-list) {
	border: 1px solid var(--color-border);
}

.cell {
	padding-inline: var(--spacing-3);
	font-size: var(--text-fluid-sm);
}

.cell.id {
	font-family: ui-monospace, monospace;
	color: var(--color-muted);
	min-width: 6rem;
}

/* The active row sets its own foreground; a muted id on the selection fill would be
   the one piece of text that stops meeting contrast. */
:global(.v10r-virtual-row.is-active) .cell.id {
	color: inherit;
}

.cell.num {
	margin-inline-start: auto;
	font-variant-numeric: tabular-nums;
}
</style>
