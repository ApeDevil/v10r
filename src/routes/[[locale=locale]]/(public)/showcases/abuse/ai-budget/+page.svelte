<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

function formatHours(ms: number): string {
	const hours = Math.floor(ms / 3_600_000);
	const minutes = Math.floor((ms % 3_600_000) / 60_000);
	return `${hours}h ${minutes}m`;
}

const barVariant = data.percentUsed < 50 ? 'success' : data.percentUsed < 90 ? 'warning' : 'error';
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_budget_card_cap()}</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Daily token cap (per user)</span>
				<code class="diag-mono">{data.dailyCap.toLocaleString()}</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Resets at</span>
				<span class="diag-value">UTC midnight (in {formatHours(data.resetsInMs)})</span>
			</div>
			<div class="diag-row">
				<span class="diag-label">Counts</span>
				<span class="diag-value">input + output tokens (recorded in <code>onFinish</code>)</span>
			</div>
		</div>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_budget_card_usage()}</h2>
		{/snippet}

		{#if !data.signedIn}
			<div class="signin-prompt">
				<span class="i-lucide-log-in" aria-hidden="true"></span>
				<p>Sign in to see your daily usage.</p>
			</div>
		{:else}
			<div class="usage">
				<div class="usage-numbers">
					<div class="usage-cell">
						<span class="usage-label">Used today</span>
						<span class="usage-value">{data.usedToday.toLocaleString()}</span>
					</div>
					<div class="usage-cell">
						<span class="usage-label">Remaining</span>
						<span class="usage-value">{data.remaining.toLocaleString()}</span>
					</div>
					<div class="usage-cell">
						<span class="usage-label">Percent used</span>
						<Badge variant={barVariant}>{data.percentUsed.toFixed(1)}%</Badge>
					</div>
				</div>

				<div class="bar-track" aria-hidden="true">
					<div class="bar-fill" data-variant={barVariant} style="width: {data.percentUsed}%"></div>
				</div>
			</div>
		{/if}
	</Card>
</Stack>

<style>
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		font-size: var(--text-fluid-sm);
		text-align: right;
	}

	.diag-value code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.signin-prompt {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.signin-prompt span {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.1rem;
		color: var(--color-muted);
	}

	.signin-prompt p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.usage {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.usage-numbers {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--spacing-3);
	}

	.usage-cell {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-3) var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
	}

	.usage-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 500;
	}

	.usage-value {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}

	.bar-track {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--color-subtle);
		overflow: hidden;
	}

	.bar-fill {
		height: 100%;
		transition: width 250ms;
	}

	.bar-fill[data-variant='success'] {
		background: var(--color-success);
	}

	.bar-fill[data-variant='warning'] {
		background: var(--color-warning);
	}

	.bar-fill[data-variant='error'] {
		background: var(--color-error);
	}
</style>
