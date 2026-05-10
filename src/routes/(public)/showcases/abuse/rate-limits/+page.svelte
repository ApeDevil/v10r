<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_rate_card_table()}</h2>
		{/snippet}

		<div class="table-wrap">
			<table class="rate-table">
				<thead>
					<tr>
						<th>Prefix</th>
						<th>Limit</th>
						<th>Keyed on</th>
						<th>Surface</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row}
						<tr>
							<td><code class="diag-mono">{row.prefix}</code></td>
							<td><span class="limit">{row.max}</span> / <span class="window">{row.window}</span></td>
							<td><code class="diag-mono">{row.keyedOn}</code></td>
							<td>
								<code class="diag-mono">{row.surface}</code>
								<p class="scope">{row.scope}</p>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="card-note">
			All limiters use Upstash Redis sliding-window via <code>@upstash/ratelimit</code>. When Redis is
			unavailable in production they <em>fail closed</em> (block all requests for that prefix); in dev they fall
			through with a warning so local development isn't blocked.
		</p>
	</Card>
</Stack>

<style>
	.table-wrap {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.rate-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.rate-table thead th {
		text-align: left;
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-subtle);
		font-weight: 600;
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid var(--color-border);
	}

	.rate-table tbody td {
		padding: var(--spacing-3) var(--spacing-4);
		border-bottom: 1px solid var(--color-border);
		vertical-align: top;
	}

	.rate-table tbody tr:last-child td {
		border-bottom: none;
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.limit {
		font-weight: 600;
		color: var(--color-fg);
	}

	.window {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		color: var(--color-muted);
	}

	.scope {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.card-note {
		margin: var(--spacing-3) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.card-note code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.05em 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.card-note em {
		font-style: italic;
		color: var(--color-fg);
	}
</style>
