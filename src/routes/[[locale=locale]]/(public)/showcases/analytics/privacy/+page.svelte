<script lang="ts">
import type { ChartData } from 'chart.js';
import { page } from '$app/state';
import { Alert } from '$lib/components/composites';
import { PieChart } from '$lib/components/viz/chart/pie';
import { getFormattingLocale } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { baseLocale, extractLocaleFromUrl } from '$lib/paraglide/runtime';
import ChartSection from '../_components/ChartSection.svelte';
import MetricCard from '../_components/MetricCard.svelte';

let { data } = $props();

const formattingLocale = $derived(getFormattingLocale(extractLocaleFromUrl(page.url.href) ?? baseLocale));

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
	return new Date(ts).toLocaleDateString(formattingLocale, {
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
	<Alert variant="error" title={m.showcase_analytics_shared_error_title()}>
		<code>{data.error}</code>
	</Alert>
{/if}

<div class="privacy-layout">
	<!-- Compliance status cards -->
	<div class="compliance-grid">
		<MetricCard title={m.showcase_analytics_privacy_metric_events()} value={Number(data.dataAge.totalEvents).toLocaleString()} />
		<MetricCard title={m.showcase_analytics_privacy_metric_sessions()} value={Number(data.dataAge.totalSessions).toLocaleString()} />
		<MetricCard
			title={m.showcase_analytics_privacy_metric_age()}
			value="{daysOld(data.dataAge.oldestEvent)}d"
		/>
		<MetricCard
			title={m.showcase_analytics_privacy_metric_retention()}
			value="{data.eventRetentionDays}d"
		/>
	</div>

	<!-- Consent distribution -->
	{#if data.consent.length > 0}
		<ChartSection
			title={m.showcase_analytics_privacy_chart_consent()}
			description={m.showcase_analytics_privacy_desc_consent()}
		>
			{#snippet chart()}
				<div class="consent-chart-layout">
					<div class="consent-chart">
						<PieChart data={consentChartData} ariaLabel={m.showcase_analytics_privacy_aria_consent()} aspect="square" />
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
		title={m.showcase_analytics_privacy_chart_retention()}
		description={m.showcase_analytics_privacy_desc_retention()}
	>
		{#snippet chart()}
			<div class="retention-info">
				<div class="retention-row">
					<div class="retention-label">
						<span class="i-lucide-database text-icon-sm" aria-hidden="true"></span>
						{m.showcase_analytics_privacy_retention_row_events()}
					</div>
					<div class="retention-detail">
						<strong>{data.eventRetentionDays} days</strong>
						<span class="retention-note">{m.showcase_analytics_privacy_retention_note_events()}</span>
					</div>
				</div>
				<div class="retention-row">
					<div class="retention-label">
						<span class="i-lucide-bar-chart text-icon-sm" aria-hidden="true"></span>
						{m.showcase_analytics_privacy_retention_row_aggregates()}
					</div>
					<div class="retention-detail">
						<strong>{data.aggregateRetentionDays} days</strong>
						<span class="retention-note">{m.showcase_analytics_privacy_retention_note_aggregates()}</span>
					</div>
				</div>
				<div class="retention-row">
					<div class="retention-label">
						<span class="i-lucide-user text-icon-sm" aria-hidden="true"></span>
						{m.showcase_analytics_privacy_retention_row_visitor_ids()}
					</div>
					<div class="retention-detail">
						<strong>{m.showcase_analytics_privacy_retention_value_hashed()}</strong>
						<span class="retention-note">{m.showcase_analytics_privacy_retention_note_ids()}</span>
					</div>
				</div>
			</div>
		{/snippet}
	</ChartSection>

	<!-- Anonymization verification -->
	<ChartSection
		title={m.showcase_analytics_privacy_chart_verification()}
		description={m.showcase_analytics_privacy_desc_verification()}
	>
		{#snippet chart()}
			<div class="verification-grid">
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>{m.showcase_analytics_privacy_verify_item_hashing_title()}</strong>
						<p>{m.showcase_analytics_privacy_verify_hashing_desc()} <code>v_[hex]</code></p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>{m.showcase_analytics_privacy_verify_item_consent_title()}</strong>
						<p>{m.showcase_analytics_privacy_verify_consent_desc()}</p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>{m.showcase_analytics_privacy_verify_item_noip_title()}</strong>
						<p>{m.showcase_analytics_privacy_verify_noip_desc()}</p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>{m.showcase_analytics_privacy_verify_item_serverside_title()}</strong>
						<p>{m.showcase_analytics_privacy_verify_serverside_desc()}</p>
					</div>
				</div>
				<div class="verification-item pass">
					<span class="i-lucide-check-circle text-icon-sm" aria-hidden="true"></span>
					<div>
						<strong>{m.showcase_analytics_privacy_verify_item_seed_title()}</strong>
						<p>{m.showcase_analytics_privacy_verify_seed_desc()}</p>
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
