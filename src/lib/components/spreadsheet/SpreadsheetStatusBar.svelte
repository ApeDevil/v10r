<script lang="ts">
import type { SelectionStats } from './spreadsheet.state.svelte';

interface Props {
	stats: SelectionStats;
}

let { stats }: Props = $props();

function formatNum(n: number): string {
	return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
</script>

<div class="sheet-status-bar">
	<span>Sum: <strong>{formatNum(stats.sum)}</strong></span>
	<span>Count: <strong>{stats.count}</strong></span>
	<span>Average: <strong>{formatNum(stats.average)}</strong></span>
</div>

<style>
	.sheet-status-bar {
		display: flex;
		gap: 16px;
		padding: 4px 12px;
		font-size: 11px;
		color: var(--color-muted);
		border-top: 1px solid var(--color-border);
		background: var(--surface-1);
	}
</style>
