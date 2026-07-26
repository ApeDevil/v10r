<script lang="ts">
import { Card, DiagGrid, NavSection, PageHeader, ShowcaseDocs } from '$lib/components/composites';
import CodeBlock from '$lib/components/composites/info-dialog/CodeBlock.svelte';
import { PageContainer, Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import ThreadDemo from './_components/ThreadDemo.svelte';

let { data } = $props();

const sections = $derived([
	{ id: 'workers-meanings', label: m.showcase_workers_section_meanings() },
	{ id: 'workers-thread', label: m.showcase_workers_section_thread() },
	{ id: 'workers-queue', label: m.showcase_workers_section_queue() },
	{ id: 'workers-not-jobs', label: m.showcase_workers_section_not_jobs() },
]);

const retryCurve = $derived(
	Array.from({ length: data.policy.maxAttempts - 1 }, (_, i) => {
		const ms = data.policy.retryBaseMs * data.policy.retryFactor ** i;
		return ms >= 60_000 ? `${Math.round(ms / 60_000)}m` : `${Math.round(ms / 1000)}s`;
	}).join(' → '),
);
</script>

<PageContainer class="py-7">
	<PageHeader
		title={m.showcase_workers_title()}
		description={m.showcase_workers_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_workers_title() }
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<NavSection {sections} />

	<Stack gap="6">
		<!-- Two meanings -->
		<Card id="workers-meanings">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_workers_section_meanings()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_workers_meanings_intro()}</p>

				<DiagGrid>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_meaning_thread_label()}</span>
						<span class="diag-value">{m.showcase_workers_meaning_thread_desc()}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_meaning_queue_label()}</span>
						<span class="diag-value">{m.showcase_workers_meaning_queue_desc()}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_meaning_service_label()}</span>
						<span class="diag-value">
							{m.showcase_workers_meaning_service_desc()}
							<a href="/showcases/pwa" class="inline-link">{m.showcase_workers_meaning_service_link()}</a>
						</span>
					</div>
				</DiagGrid>

				<p class="tell">{m.showcase_workers_meanings_tell()}</p>
			</div>
		</Card>

		<!-- Worker A: browser thread -->
		<Card id="workers-thread">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_workers_section_thread()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_workers_thread_intro()}</p>
				<ThreadDemo />
				<p class="footnote">{m.showcase_workers_thread_transfer_note()}</p>
			</div>
		</Card>

		<!-- Worker B: queue worker -->
		<Card id="workers-queue">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_workers_section_queue()}</h2>
			{/snippet}

			<div class="prose-block">
				<div class="platform-badge" class:dormant={!data.platform.persistent}>
					<Badge variant={data.platform.persistent ? 'success' : 'warning'}>
						{data.platform.persistent
							? m.showcase_workers_queue_state_running()
							: m.showcase_workers_queue_state_dormant()}
					</Badge>
					<p class="platform-text">
						{data.platform.persistent
							? m.showcase_workers_queue_running_note({
									platform: data.platform.id,
									seconds: String(Math.round(data.policy.intervalMs / 1000))
								})
							: m.showcase_workers_queue_dormant_note({ platform: data.platform.id })}
					</p>
				</div>

				<p>{m.showcase_workers_queue_intro()}</p>

				<CodeBlock highlightedHtml={data.claimSql} language="sql" filename="outbox.ts — claimDeliveries()" />

				<DiagGrid>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_queue_label_batch()}</span>
						<span class="diag-value">{data.policy.batchSize}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_queue_label_attempts()}</span>
						<span class="diag-value">{data.policy.maxAttempts}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_queue_label_backoff()}</span>
						<span class="diag-value">{retryCurve}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_queue_label_lease()}</span>
						<span class="diag-value">{Math.round(data.policy.leaseMs / 60_000)}m</span>
					</div>
				</DiagGrid>

				<h3 class="sub-heading">{m.showcase_workers_queue_depth_heading()}</h3>
				<div class="queue-grid">
					{#each [
						{ key: 'pending', value: data.queue.pending, label: m.showcase_workers_queue_status_pending() },
						{ key: 'processing', value: data.queue.processing, label: m.showcase_workers_queue_status_processing() },
						{ key: 'sent', value: data.queue.sent, label: m.showcase_workers_queue_status_sent() },
						{ key: 'failed', value: data.queue.failed, label: m.showcase_workers_queue_status_failed() },
						{ key: 'dead', value: data.queue.dead, label: m.showcase_workers_queue_status_dead() }
					] as stat (stat.key)}
						<div class="queue-stat">
							<span class="queue-value">{stat.value}</span>
							<span class="queue-label">{stat.label}</span>
						</div>
					{/each}
				</div>

				<p class="footnote">{m.showcase_workers_queue_fence_note()}</p>
			</div>
		</Card>

		<!-- Not workers: jobs -->
		<Card id="workers-not-jobs">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_workers_section_not_jobs()}</h2>
			{/snippet}

			<div class="prose-block">
				<p>{m.showcase_workers_not_jobs_intro()}</p>

				<DiagGrid>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_not_jobs_job_label()}</span>
						<span class="diag-value">{m.showcase_workers_not_jobs_job_desc()}</span>
					</div>
					<div class="diag-row">
						<span class="diag-label">{m.showcase_workers_not_jobs_worker_label()}</span>
						<span class="diag-value">{m.showcase_workers_not_jobs_worker_desc()}</span>
					</div>
				</DiagGrid>

				<p>
					{m.showcase_workers_not_jobs_outro()}
					<a href="/showcases/jobs" class="inline-link">{m.showcase_workers_not_jobs_link()}</a>
				</p>
			</div>
		</Card>
	</Stack>
</PageContainer>

<style>
	.prose-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.prose-block p {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}

	.tell {
		border-left: 2px solid var(--color-primary);
		padding-left: var(--spacing-3);
	}

	.footnote {
		font-size: var(--text-fluid-xs) !important;
	}

	.sub-heading {
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.inline-link {
		color: var(--color-primary);
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
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
		white-space: nowrap;
	}

	.diag-value {
		font-size: var(--text-fluid-sm);
		text-align: right;
	}

	.platform-badge {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.platform-badge.dormant {
		border-color: color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
	}

	.platform-text {
		flex: 1 1 14rem;
	}

	.queue-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
		gap: var(--spacing-2);
	}

	.queue-stat {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.queue-value {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
	}

	.queue-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
