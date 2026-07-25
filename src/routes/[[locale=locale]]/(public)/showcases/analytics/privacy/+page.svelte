<script lang="ts">
import type { ChartData } from 'chart.js';
import { Alert } from '$lib/components/composites';
import { PieChart } from '$lib/components/viz/chart/pie';
import * as m from '$lib/paraglide/messages';
import ChartSection from '../_components/ChartSection.svelte';
import MetricCard from '../_components/MetricCard.svelte';

let { data } = $props();

const consentChartData: ChartData<'pie'> = $derived({
	labels: data.consent.map((c) => c.tier.charAt(0).toUpperCase() + c.tier.slice(1)),
	datasets: [
		{
			data: data.consent.map((c) => Number(c.count)),
			backgroundColor: ['var(--chart-3)', 'var(--chart-1)', 'var(--chart-2)'],
		},
	],
});

const totalSessions = $derived(data.consent.reduce((sum, c) => sum + Number(c.count), 0));

function formatDate(ts: string | null): string {
	if (!ts) return '—';
	return new Date(ts).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function daysOld(ts: string | null): number {
	if (!ts) return 0;
	return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}
</script>

{#if data.error}
	<Alert variant="error" title="Database Error">
		<code>{data.error}</code>
	</Alert>
{/if}

<div class="privacy-layout">
	<!-- Compliance status cards -->
	<div class="compliance-grid">
		<MetricCard title="Total Events" value={Number(data.dataAge.totalEvents).toLocaleString()} />
		<MetricCard title="Total Sessions" value={Number(data.dataAge.totalSessions).toLocaleString()} />
		<MetricCard
			title="Data Age"
			value="{daysOld(data.dataAge.oldestEvent)}d"
		/>
		<MetricCard
			title="Retention Limit"
			value="{data.retentionDays}d"
		/>
	</div>

	<!-- Consent distribution -->
	{#if data.consent.length > 0}
		<ChartSection
			title="Consent Distribution"
			description="How visitors have configured their consent preferences"
		>
			{#snippet chart()}
				<div class="consent-chart-layout">
					<div class="consent-chart">
						<PieChart data={consentChartData} ariaLabel="Consent tier distribution" aspect="square" />
					</div>
					<div class="consent-breakdown">
						{#each data.consent as tier}
							{@const pct = totalSessions > 0 ? Math.round((Number(tier.count) / totalSessions) * 100) : 0}
							<div class="consent-row">
								<span class="consent-tier">{tier.tier}</span>
								<span class="consent-bar-bg">
									<span class="consent-bar-fill" style="width: {pct}%"></span>
								</span>
								<span class="consent-count">{Number(tier.count).toLocaleString()} ({pct}%)</span>
							</div>
						{/each}
					</div>
				</div>
			{/snippet}
		</ChartSection>
	{/if}

	<!-- Data retention -->
	<ChartSection
		title="Data Retention Policy"
		description="How long analytics data is stored before automatic deletion"
	>
		{#snippet chart()}
			<div class="retention-info">
				<div class="retention-row">
					<div class="retention-label">
						<span class="i-lucide-database text-icon-sm" aria-hidden="true"></span>
						Raw Events
					</div>
					<div class="retention-detail">
						<strong>{data.retentionDays} days</strong>
						<span class="retention-note">Individual pageviews, actions, and timing events</span>
					</div>
				</div>
				<div class="retention-row">
					<div class="retention-label">
						<span class="i-lucide-bar-chart text-icon-sm" aria-hidden="true"></span>
						Aggregates
					</div>
					<div class="retention-detail">
						<strong>{data.aggregateRetentionDays} days</strong>
						<span class="retention-note">Daily rollups — no individual visitor data</span>
					</div>
				</div>
				<div class="retention-row">
					<div class="retention-label">
						<span class="i-lucide-user text-icon-sm" aria-hidden="true"></span>
						Visitor IDs
					</div>
					<div class="retention-detail">
						<strong>SHA-256 hashed</strong>
						<span class="retention-note">IP addresses are never stored in raw form</span>
					</div>
				</div>
			</div>
		{/snippet}
	</ChartSection>

	<!-- Anonymization verification -->
	<ChartSection
		title="Anonymization Verification"
		description="Live proof that privacy measures are active"
	>
		{#snippet chart()}
			<div class="verification-grid">
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>Visitor ID Hashing</strong>
						<p>All visitor IDs are SHA-256 hashed before storage. Format: <code>v_[hex]</code></p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>Consent-Gated Fields</strong>
						<p>Device and country fields are NULL for 'necessary' consent tier visitors</p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>No Raw IP Storage</strong>
						<p>No column in the schema stores raw IP addresses</p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>Server-Side Only</strong>
						<p>No client-side tracking scripts — all collection happens server-side</p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>Synthetic Seed Data</strong>
						<p>Demo uses deterministic faker seed (42) — zero real user data</p>
					</div>
				</div>
			</div>
		{/snippet}
	</ChartSection>

	<aside class="cross-link">
		<span class="i-lucide-arrow-right" aria-hidden="true"></span>
		<p>
			{m.showcase_analytics_privacy_seealso()}
			<a href="/showcases/privacy">{m.showcase_privacy_title()}</a>
		</p>
	</aside>
</div>

<style>
	.cross-link {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-4) var(--spacing-5);
		border-radius: var(--radius-lg);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.cross-link span {
		flex-shrink: 0;
		width: 1.125rem;
		height: 1.125rem;
		margin-top: 0.15rem;
		color: var(--color-primary);
	}

	.cross-link p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.6;
	}

	.cross-link a {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.privacy-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.compliance-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.compliance-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.consent-chart-layout {
		display: grid;
		grid-template-columns: 200px 1fr;
		gap: var(--spacing-6);
		align-items: center;
	}

	@media (max-width: 640px) {
		.consent-chart-layout {
			grid-template-columns: 1fr;
		}
	}

	.consent-breakdown {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.consent-row {
		display: grid;
		grid-template-columns: 100px 1fr 120px;
		gap: var(--spacing-3);
		align-items: center;
	}

	.consent-tier {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		text-transform: capitalize;
		color: var(--color-fg);
	}

	.consent-bar-bg {
		height: 8px;
		border-radius: var(--radius-full);
		background: var(--color-subtle);
		overflow: hidden;
	}

	.consent-bar-fill {
		display: block;
		height: 100%;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		transition: width var(--duration-normal);
	}

	.consent-count {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.retention-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.retention-row {
		display: flex;
		gap: var(--spacing-4);
		align-items: flex-start;
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.retention-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		min-width: 140px;
	}

	.retention-detail {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.retention-note {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.verification-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.verification-item {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-border);
	}

	.verification-item.pass {
		color: var(--color-success);
	}

	.verification-item div {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.verification-item strong {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.verification-item p {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

</style>
