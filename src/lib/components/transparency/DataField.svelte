<script lang="ts">
/**
 * One row of the data mirror: a field we hold (or don't), with a redundant
 * non-color status encoding (icon shape + text pill) and an optional
 * "why we have this" line. The whole row carries the state for screen
 * readers via aria-label.
 */
let {
	label,
	value = null,
	collected,
	statusLabel,
	why = '',
}: {
	label: string;
	value?: string | number | null;
	collected: boolean;
	statusLabel: string;
	why?: string;
} = $props();
</script>

<div class="data-field" role="group" aria-label="{label} — {statusLabel}">
	<div class="field-main">
		<span class="field-label">{label}</span>
		{#if value !== null && value !== ''}
			<code class="field-value">{value}</code>
		{/if}
		{#if why}
			<span class="field-why">{why}</span>
		{/if}
	</div>
	<span class="status-pill" class:collected aria-hidden="true">
		<span class={collected ? 'i-lucide-check text-icon-xs' : 'i-lucide-minus text-icon-xs'}></span>
		{statusLabel}
	</span>
</div>

<style>
	.data-field {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.data-field:nth-child(odd) {
		background: var(--color-subtle);
	}

	.field-main {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.field-label {
		font-weight: 500;
		font-size: var(--text-fluid-sm);
	}

	.field-value {
		font-family: var(--font-mono);
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		word-break: break-all;
	}

	.field-why {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		flex-shrink: 0;
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		border: 1px solid var(--color-border);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.status-pill.collected {
		border-color: var(--color-success);
		color: var(--color-success);
	}
</style>
