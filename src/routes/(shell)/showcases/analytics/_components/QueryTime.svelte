<script lang="ts">
interface Props {
	ms: number;
}

let { ms }: Props = $props();
</script>

<span class="query-time">
	<span class="i-lucide-clock text-icon-xs" aria-hidden="true"></span>
	{ms}ms
</span>

<style>
	.query-time {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
