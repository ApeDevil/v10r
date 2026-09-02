<script lang="ts">
import VolumeBarChart from '$lib/components/admin/ai/VolumeBarChart.svelte';
import { Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import type { AiWorkload, UnifiedModelUsageRow } from '$lib/schemas/admin/model-usage';

let { data } = $props();

const usdFmt = new Intl.NumberFormat('en-US', {
	style: 'currency',
	currency: 'USD',
	minimumFractionDigits: 2,
	maximumFractionDigits: 6,
});

function fmtUsd(n: number | null): string {
	return n == null ? '—' : usdFmt.format(n);
}
function fmtTokens(n: number | null): string {
	return n == null ? '—' : n.toLocaleString();
}
function rowTotalTokens(r: UnifiedModelUsageRow): number | null {
	if (r.inputTokens == null && r.outputTokens == null) return null;
	return (r.inputTokens ?? 0) + (r.outputTokens ?? 0);
}
function fmtPct(r: number | null): string {
	return r == null ? '—' : `${Math.round(r * 100)}%`;
}
function pctWidth(part: number, total: number): number {
	return total > 0 ? (part / total) * 100 : 0;
}
function relativeTime(iso: string | null): string {
	if (!iso) return 'never';
	const diff = Date.now() - new Date(iso).getTime();
	if (Number.isNaN(diff)) return 'never';
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}

const WORKLOAD_META: Record<AiWorkload, { label: string; icon: string }> = {
	chat: { label: 'Chatbot', icon: 'i-lucide-message-square' },
	image: { label: 'Image reader', icon: 'i-lucide-image' },
};

const coverageNote = $derived.by(() => {
	const s = data.summary;
	if (s.costCoverage === 'none') {
		return 'No model in this window is in the reference price table — every cost shows “—”.';
	}
	const asOf = s.asOf ? `, rates as of ${s.asOf}` : '';
	if (s.costCoverage === 'full') {
		return `Reference estimate · not a charge. All ${s.pricedRowCount} model rows priced${asOf}.`;
	}
	return `Reference estimate · not a charge. Cost summed over ${s.pricedRowCount} of ${s.totalRowCount} priced rows — unpriced models show “—”${asOf}.`;
});
</script>
<Stack gap="6">
	<p class="intro">
		Reference token spend across every AI surface. Dollar figures are estimates at standard
		pay-as-you-go pricing — our keys run on free tiers, so the real charge is <strong>$0</strong>.
		Tokens are the stored fact; cost is derived at read.
	</p>

	<!-- Image Metadata Reader — feature health (heartbeat only, no $) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Image Metadata Reader</h2>
		{/snippet}

		<div class="stat-grid">
			<div class="stat-card">
				<span class="stat-label">Successful analyses (30d)</span>
				<span class="stat-value">{data.kpis.analyses.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Analyses today</span>
				<span class="stat-value">{data.kpis.analysesToday.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Distinct images (30d)</span>
				<span class="stat-value">{data.kpis.distinctImages.toLocaleString()}</span>
			</div>
			<div class="stat-card">
				<span class="stat-label">Last analysis</span>
				<span class="stat-value stat-value--sm">{relativeTime(data.kpis.lastAnalysisAt)}</span>
			</div>
		</div>

		<!-- Conversion funnel (deferred — cross-schema LEFT JOIN) -->
		{#await data.funnel}
			<div class="skeleton-funnel"></div>
		{:then funnel}
			{#if funnel.totalImages > 0}
				<div class="funnel">
					<div class="funnel-bar" aria-hidden="true">
						<div class="funnel-seg funnel-seg--saved" style="width: {pctWidth(funnel.saved, funnel.totalImages)}%"></div>
						<div
							class="funnel-seg funnel-seg--abandoned"
							style="width: {pctWidth(funnel.abandoned, funnel.totalImages)}%"
						></div>
					</div>
					<div class="funnel-legend">
						<span class="funnel-key">
							<span class="i-lucide-check funnel-icon funnel-icon--saved" aria-hidden="true"></span>
							Saved <strong>{funnel.saved.toLocaleString()}</strong>
						</span>
						<span class="funnel-key">
							<span class="i-lucide-circle-dashed funnel-icon funnel-icon--abandoned" aria-hidden="true"></span>
							Abandoned <strong>{funnel.abandoned.toLocaleString()}</strong>
						</span>
					</div>
					<p class="note">
						Saved <strong>{fmtPct(funnel.savedRate)}</strong> of {funnel.totalImages.toLocaleString()} analyzed
						images. “Abandoned” = analyzed but never saved — not a rejection (there is no reject step).
					</p>
				</div>
			{:else}
				<p class="note">No analyses in the last 30 days yet.</p>
			{/if}
		{:catch}
			<p class="error-text">Failed to load the conversion funnel.</p>
		{/await}

		<p class="note disclaimer">
			<span class="i-lucide-info h-4 w-4" aria-hidden="true"></span>
			Counts successful analyses only — failed runs (provider error, timeout, unreadable image) are
			not recorded, so there is no true success rate here.
		</p>
	</Card>

	<!-- Cross-surface usage by model -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Usage by Model (30 days)</h2>
				<Badge variant="secondary">Reference pricing</Badge>
			</Cluster>
		{/snippet}

		{#if data.usage.length === 0}
			<p class="note">
				No per-model usage recorded yet. Token attribution is captured per chatbot step and per image
				analysis — this fills in after the next run.
			</p>
		{:else}
			<div class="table-wrap" tabindex="0" aria-label="Token usage and reference cost by model and surface">
				<table class="data-table">
					<thead>
						<tr>
							<th>Surface</th>
							<th>Model</th>
							<th>Provider</th>
							<th class="num">Input</th>
							<th class="num">Output</th>
							<th class="num">Thinking</th>
							<th class="num">Total</th>
							<th class="num">Calls</th>
							<th class="num">Ref. cost</th>
						</tr>
					</thead>
					<tbody>
						{#each data.usage as r (r.workload + r.modelId + (r.providerId ?? ''))}
							{@const meta = WORKLOAD_META[r.workload]}
							<tr>
								<td>
									<Badge variant="secondary">
										<span class="{meta.icon} h-3 w-3 mr-1" aria-hidden="true"></span>{meta.label}
									</Badge>
								</td>
								<td><code class="mono">{r.modelId}</code></td>
								<td>{r.providerId ?? '—'}</td>
								<td class="num"><code class="mono">{fmtTokens(r.inputTokens)}</code></td>
								<td class="num"><code class="mono">{fmtTokens(r.outputTokens)}</code></td>
								<td class="num"><code class="mono">{fmtTokens(r.reasoningTokens)}</code></td>
								<td class="num"><code class="mono">{fmtTokens(rowTotalTokens(r))}</code></td>
								<td class="num"><code class="mono">{r.calls.toLocaleString()} {r.callUnit}{r.calls === 1 ? '' : 's'}</code></td>
								<td class="num"><code class="mono">{fmtUsd(r.cost?.totalUsd ?? null)}</code></td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<th scope="row" colspan="3">Total</th>
							<td class="num"><code class="mono">{fmtTokens(data.summary.inputTokens)}</code></td>
							<td class="num"><code class="mono">{fmtTokens(data.summary.outputTokens)}</code></td>
							<td class="num muted">—</td>
							<td class="num"><code class="mono">{fmtTokens(data.summary.totalTokens)}</code></td>
							<td class="num muted" title="Steps and analyses are different units — not summed">—</td>
							<td class="num"><code class="mono">{fmtUsd(data.summary.totalCostUsd)}</code></td>
						</tr>
					</tfoot>
				</table>
			</div>
			<p class="note">{coverageNote}</p>
			<p class="note">
				“Thinking” tokens are a subset of Output (already inside Total), shown for transparency — never
				added on top.
			</p>
		{/if}
	</Card>

	<!-- Image analysis volume -->
	{#await data.volume then volume}
		{#if volume.length > 0}
			<Card>
				{#snippet header()}
					<h2 class="text-fluid-lg font-semibold">Image Analyses per Day (30 days)</h2>
				{/snippet}
				<VolumeBarChart data={volume} caption="Image analyses per day over the last 30 days" unit="analyses" />
			</Card>
		{/if}
	{:catch}
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Image Analyses per Day (30 days)</h2>
			{/snippet}
			<p class="error-text">Failed to load the analysis volume.</p>
		</Card>
	{/await}
</Stack>

<style>
	.intro {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		max-width: 70ch;
	}

	/* KPI tiles */
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: var(--spacing-4);
	}

	.stat-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.stat-value {
		font-size: var(--text-fluid-xl);
		font-weight: 700;
		font-family: ui-monospace, monospace;
	}

	.stat-value--sm {
		font-size: var(--text-fluid-md);
	}

	/* Conversion funnel */
	.funnel {
		margin-top: var(--spacing-4);
	}

	.funnel-bar {
		display: flex;
		height: 14px;
		border-radius: var(--radius-full);
		overflow: hidden;
		background: var(--color-border);
	}

	.funnel-seg--saved {
		background: var(--color-success);
	}

	.funnel-seg--abandoned {
		background: var(--color-muted);
	}

	.funnel-legend {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-4);
		margin-top: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.funnel-key {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	.funnel-icon {
		width: 0.9rem;
		height: 0.9rem;
	}

	.funnel-icon--saved {
		color: var(--color-success);
	}

	.funnel-icon--abandoned {
		color: var(--color-muted);
	}

	.skeleton-funnel {
		height: 14px;
		margin-top: var(--spacing-4);
		background: var(--color-subtle);
		border-radius: var(--radius-full);
		animation: pulse 1.5s ease-in-out infinite;
	}

	/* Tables */
	.table-wrap {
		overflow-x: auto;
	}

	.table-wrap:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.data-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.data-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.data-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.data-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.data-table tfoot th,
	.data-table tfoot td {
		border-top: 2px solid var(--color-border);
		border-bottom: none;
		font-weight: 700;
		padding-top: var(--spacing-3);
	}

	.mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}

	.muted {
		color: var(--color-muted);
	}

	.note {
		margin: var(--spacing-3) 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.disclaimer {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.error-text {
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
		margin: var(--spacing-2) 0 0;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	@media (prefers-reduced-motion: reduce) {
		.skeleton-funnel {
			animation: none;
			opacity: 0.6;
		}
	}
</style>
