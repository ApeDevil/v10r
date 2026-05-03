<script lang="ts">
import { enhance } from '$app/forms';
import { Alert, Card, DiagGrid, DiagRow } from '$lib/components/composites';
import {
	Accordion,
	Body,
	Button,
	Cell,
	Header,
	HeaderCell,
	Progress,
	Row,
	Skeleton,
	Spinner,
	Table,
	Tag,
} from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { ProviderResult, ThresholdLevel } from '$lib/server/monitoring';

let { data }: PageProps = $props();

let refreshing = $state(false);

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function formatNumber(n: number): string {
	return n.toLocaleString();
}

function thresholdToProgressVariant(threshold: ThresholdLevel): 'default' | 'success' | 'warning' | 'error' {
	if (threshold === 'ok') return 'default';
	return threshold;
}

function thresholdToTagVariant(threshold: ThresholdLevel): 'success' | 'warning' | 'error' | 'secondary' {
	if (threshold === 'ok') return 'success';
	return threshold;
}

function statusToTagVariant(status: ProviderResult<unknown>['status']): 'success' | 'warning' | 'error' | 'secondary' {
	if (status === 'ok') return 'success';
	if (status === 'error') return 'error';
	return 'secondary';
}

function statusLabel(status: ProviderResult<unknown>['status']): string {
	if (status === 'ok') return m.admin_db_status_healthy();
	if (status === 'error') return m.admin_db_status_error();
	return m.admin_db_status_unavailable();
}

function timeAgo(iso: string): string {
	const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (seconds < 60) return m.admin_db_time_just_now();
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return m.admin_db_time_minutes_ago({ minutes });
	const hours = Math.floor(minutes / 60);
	return m.admin_db_time_hours_ago({ hours });
}

// ── Alert visibility: any resolved provider in warning/error state ─────────────

const resolvedAlert = $derived.by(() => {
	const providers = [data.upstash, data.r2];
	for (const p of providers) {
		if (p.status === 'error') return 'error' as const;
	}
	for (const p of providers) {
		if (p.status === 'unavailable') return 'warning' as const;
	}
	return null;
});
</script>
<div class="flex items-center justify-between mb-6">
	<form
		method="POST"
		action="?/retest"
		use:enhance={() => {
			refreshing = true;
			return async ({ update }) => {
				await update();
				refreshing = false;
			};
		}}
	>
		<Button type="submit" variant="outline" size="sm" disabled={refreshing}>
			{#if refreshing}
				<Spinner size="xs" class="mr-1" />
			{/if}
			{m.admin_action_refresh()}
		</Button>
	</form>
</div>

{#if resolvedAlert}
	<Alert
		variant={resolvedAlert}
		title={resolvedAlert === 'error' ? m.admin_db_alert_error_title() : m.admin_db_alert_unavailable_title()}
		description={m.admin_db_alert_desc()}
		closable
		class="mb-6"
	/>
{/if}

<div class="grid grid-cols-1 gap-6 md:grid-cols-2">

	<!-- ── PostgreSQL (Neon) ──────────────────────────────────────────────────── -->
	{#await data.neon}
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<div class="flex items-center gap-2">
						<span class="i-lucide-database provider-icon" aria-hidden="true"></span>
						<Skeleton variant="text" width="8rem" height="1.25rem" />
					</div>
					<Skeleton variant="rectangular" width="4rem" height="1.5rem" rounded="full" />
				</div>
			{/snippet}
			{#snippet children()}
				<div class="flex flex-col gap-4">
					<Skeleton variant="rectangular" height="0.625rem" />
					<Skeleton variant="text" width="80%" />
					<Skeleton variant="text" width="70%" />
					<Skeleton variant="text" width="60%" />
				</div>
			{/snippet}
		</Card>
	{:then neon}
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<div class="flex items-center gap-2">
						<span class="i-lucide-database provider-icon" aria-hidden="true"></span>
						<h2 class="text-fluid-base font-semibold">PostgreSQL</h2>
					</div>
					{#if neon.status === 'ok' && neon.data}
						<Tag
							variant={thresholdToTagVariant(neon.data.threshold)}
							label={neon.data.threshold === 'ok' ? m.admin_db_status_healthy() : neon.data.threshold === 'warning' ? m.admin_db_status_warning() : m.admin_db_status_critical()}
						/>
					{:else}
						<Tag variant={statusToTagVariant(neon.status)} label={statusLabel(neon.status)} />
					{/if}
				</div>
				{#if neon.measuredAt}
					<p class="text-fluid-xs text-muted">{timeAgo(neon.measuredAt)}</p>
				{/if}
			{/snippet}
			{#snippet children()}
				{#if neon.status === 'ok' && neon.data}
					{@const d = neon.data}
					<div class="flex flex-col gap-4">
						<div>
							<div class="flex justify-between text-fluid-xs text-muted mb-1">
								<span>{m.admin_db_label_storage()}</span>
								<span>{d.percentage}%</span>
							</div>
							<Progress
								value={d.percentage}
								max={100}
								variant={thresholdToProgressVariant(d.threshold)}
								showLabel={false}
							/>
						</div>

						<DiagGrid>
							<DiagRow label={m.admin_db_label_db_size()}>{formatBytes(d.totalBytes)}</DiagRow>
							<DiagRow label={m.admin_db_label_limit()}>{formatBytes(d.limitBytes)}</DiagRow>
							<DiagRow label={m.admin_db_label_tables()}>{d.tables.length}</DiagRow>
							<DiagRow label={m.admin_db_label_latency()}><code>{neon.latencyMs}ms</code></DiagRow>
						</DiagGrid>

						{#snippet neonTableBreakdown()}
							<Table>
								{#snippet children()}
									<Header>
										{#snippet children()}
											<Row hoverable={false}>
												{#snippet children()}
													<HeaderCell>{m.admin_db_col_schema()}</HeaderCell>
													<HeaderCell>{m.admin_db_col_table()}</HeaderCell>
													<HeaderCell>{m.admin_db_col_size()}</HeaderCell>
													<HeaderCell>{m.admin_db_col_live_rows()}</HeaderCell>
													<HeaderCell>{m.admin_db_col_dead_rows()}</HeaderCell>
													<HeaderCell>{m.admin_db_col_last_vacuum()}</HeaderCell>
												{/snippet}
											</Row>
										{/snippet}
									</Header>
									<Body>
										{#snippet children()}
											{#each d.tables as t (t.schema + '.' + t.table)}
												<Row>
													{#snippet children()}
														<Cell><code>{t.schema}</code></Cell>
														<Cell><code>{t.table}</code></Cell>
														<Cell>{formatBytes(t.totalBytes)}</Cell>
														<Cell>{formatNumber(t.liveRows)}</Cell>
														<Cell class={t.deadRows > 0 ? 'text-warning' : ''}>{formatNumber(t.deadRows)}</Cell>
														<Cell>
															{#if t.lastAutovacuum}
																{timeAgo(t.lastAutovacuum)}
															{:else}
																<span class="text-muted">{m.admin_db_vacuum_never()}</span>
															{/if}
														</Cell>
													{/snippet}
												</Row>
											{/each}
										{/snippet}
									</Body>
								{/snippet}
							</Table>
						{/snippet}

						<Accordion
							items={[
								{
									value: 'tables',
									title: m.admin_db_table_breakdown({ count: d.tables.length }),
									content: neonTableBreakdown,
								},
							]}
						/>
					</div>
				{:else}
					<Alert
						variant="error"
						title={m.admin_db_pg_unavailable_title()}
						description={neon.error ?? m.admin_db_pg_unavailable_desc()}
					/>
					<p class="text-fluid-xs text-muted mt-3">
						<a
							href="https://console.neon.tech"
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary hover:underline"
						>{m.admin_db_pg_view_console()}</a>
					</p>
				{/if}
			{/snippet}
		</Card>
	{:catch err}
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<div class="flex items-center gap-2">
						<span class="i-lucide-database provider-icon" aria-hidden="true"></span>
						<h2 class="text-fluid-base font-semibold">PostgreSQL</h2>
					</div>
					<Tag variant="error" label={m.admin_db_status_error()} />
				</div>
			{/snippet}
			{#snippet children()}
				<Alert
					variant="error"
					title={m.admin_db_pg_unavailable_title()}
					description={m.admin_db_pg_unavailable_desc()}
				/>
			{/snippet}
		</Card>
	{/await}

	<!-- ── Neo4j ──────────────────────────────────────────────────────────────── -->
	{#await data.neo4j}
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<div class="flex items-center gap-2">
						<span class="i-lucide-share-2 provider-icon" aria-hidden="true"></span>
						<Skeleton variant="text" width="6rem" height="1.25rem" />
					</div>
					<Skeleton variant="rectangular" width="4rem" height="1.5rem" rounded="full" />
				</div>
			{/snippet}
			{#snippet children()}
				<div class="flex flex-col gap-4">
					<Skeleton variant="text" width="80%" />
					<Skeleton variant="text" width="70%" />
					<Skeleton variant="text" width="60%" />
					<Skeleton variant="text" width="55%" />
				</div>
			{/snippet}
		</Card>
	{:then neo4j}
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<div class="flex items-center gap-2">
						<span class="i-lucide-share-2 provider-icon" aria-hidden="true"></span>
						<h2 class="text-fluid-base font-semibold">Neo4j</h2>
					</div>
					{#if neo4j.status === 'ok' && neo4j.data}
						{@const worstThreshold = neo4j.data.nodeThreshold === 'error' || neo4j.data.relThreshold === 'error'
							? 'error'
							: neo4j.data.nodeThreshold === 'warning' || neo4j.data.relThreshold === 'warning'
								? 'warning'
								: 'ok'}
						<Tag
							variant={thresholdToTagVariant(worstThreshold)}
							label={worstThreshold === 'ok' ? m.admin_db_status_healthy() : worstThreshold === 'warning' ? m.admin_db_status_warning() : m.admin_db_status_critical()}
						/>
					{:else}
						<Tag variant={statusToTagVariant(neo4j.status)} label={statusLabel(neo4j.status)} />
					{/if}
				</div>
				{#if neo4j.measuredAt}
					<p class="text-fluid-xs text-muted">{timeAgo(neo4j.measuredAt)}</p>
				{/if}
			{/snippet}
			{#snippet children()}
				{#if neo4j.status === 'ok' && neo4j.data}
					{@const d = neo4j.data}
					<div class="flex flex-col gap-4">
						<DiagGrid>
							<DiagRow label={m.admin_db_label_nodes()}>
								{formatNumber(d.nodeCount)}
								<span class="text-muted text-fluid-xs">/ {formatNumber(d.nodeLimit)}</span>
							</DiagRow>
							<DiagRow label={m.admin_db_label_relationships()}>
								{formatNumber(d.relCount)}
								<span class="text-muted text-fluid-xs">/ {formatNumber(d.relLimit)}</span>
							</DiagRow>
							<DiagRow label={m.admin_db_label_node_usage()}>{d.nodePercentage}%</DiagRow>
							<DiagRow label={m.admin_db_label_rel_usage()}>{d.relPercentage}%</DiagRow>
							<DiagRow label={m.admin_db_label_latency()}><code>{neo4j.latencyMs}ms</code></DiagRow>
						</DiagGrid>

						<p class="text-fluid-xs text-muted">
							{m.admin_db_neo4j_storage_note()}
							<a
								href="https://console.neo4j.io"
								target="_blank"
								rel="noopener noreferrer"
								class="text-primary hover:underline"
							>{m.admin_db_neo4j_view_console()}</a>
						</p>

						{#snippet neo4jDetail()}
							<div class="neo4j-detail">
								{#if d.labels.length > 0}
									<div class="detail-section">
										<h4 class="detail-section-title">{m.admin_db_neo4j_node_labels()}</h4>
										<DiagGrid>
											{#each d.labels as l}
												<DiagRow label={l.label}>{formatNumber(l.count)}</DiagRow>
											{/each}
										</DiagGrid>
									</div>
								{/if}
								{#if d.relTypes.length > 0}
									<div class="detail-section">
										<h4 class="detail-section-title">{m.admin_db_neo4j_rel_types()}</h4>
										<DiagGrid>
											{#each d.relTypes as r}
												<DiagRow label={r.type}>{formatNumber(r.count)}</DiagRow>
											{/each}
										</DiagGrid>
									</div>
								{/if}
								{#if d.labels.length === 0 && d.relTypes.length === 0}
									<p class="text-fluid-sm text-muted">{m.admin_db_neo4j_no_data()}</p>
								{/if}
							</div>
						{/snippet}

						<Accordion
							items={[
								{
									value: 'topology',
									title: m.admin_db_neo4j_topology({ labels: d.labels.length, rels: d.relTypes.length }),
									content: neo4jDetail,
								},
							]}
						/>
					</div>
				{:else}
					<Alert
						variant="error"
						title={m.admin_db_neo4j_unavailable_title()}
						description={neo4j.error ?? m.admin_db_neo4j_unavailable_desc()}
					/>
					<p class="text-fluid-xs text-muted mt-3">
						<a
							href="https://console.neo4j.io"
							target="_blank"
							rel="noopener noreferrer"
							class="text-primary hover:underline"
						>{m.admin_db_neo4j_view_console()}</a>
					</p>
				{/if}
			{/snippet}
		</Card>
	{:catch}
		<Card>
			{#snippet header()}
				<div class="card-header-row">
					<div class="flex items-center gap-2">
						<span class="i-lucide-share-2 provider-icon" aria-hidden="true"></span>
						<h2 class="text-fluid-base font-semibold">Neo4j</h2>
					</div>
					<Tag variant="error" label={m.admin_db_status_error()} />
				</div>
			{/snippet}
			{#snippet children()}
				<Alert
					variant="error"
					title={m.admin_db_neo4j_unavailable_title()}
					description={m.admin_db_neo4j_unavailable_desc()}
				/>
			{/snippet}
		</Card>
	{/await}

	<!-- ── Upstash Redis ──────────────────────────────────────────────────────── -->
	<Card>
		{#snippet header()}
			<div class="card-header-row">
				<div class="flex items-center gap-2">
					<span class="i-lucide-zap provider-icon" aria-hidden="true"></span>
					<h2 class="text-fluid-base font-semibold">Upstash Redis</h2>
				</div>
				{#if data.upstash.status === 'ok' && data.upstash.data}
					{@const worstThreshold = data.upstash.data.commandsThreshold === 'error' || data.upstash.data.storageThreshold === 'error'
						? 'error'
						: data.upstash.data.commandsThreshold === 'warning' || data.upstash.data.storageThreshold === 'warning'
							? 'warning'
							: 'ok'}
					<Tag
						variant={thresholdToTagVariant(worstThreshold)}
						label={worstThreshold === 'ok' ? m.admin_db_status_healthy() : worstThreshold === 'warning' ? m.admin_db_status_warning() : m.admin_db_status_critical()}
					/>
				{:else}
					<Tag variant={statusToTagVariant(data.upstash.status)} label={statusLabel(data.upstash.status)} />
				{/if}
			</div>
			{#if data.upstash.measuredAt}
				<p class="text-fluid-xs text-muted">{timeAgo(data.upstash.measuredAt)}</p>
			{/if}
		{/snippet}
		{#snippet children()}
			{#if data.upstash.status === 'ok' && data.upstash.data}
				{@const d = data.upstash.data}
				<div class="flex flex-col gap-4">
					<div>
						<div class="flex justify-between text-fluid-xs text-muted mb-1">
							<span>{m.admin_db_upstash_commands_month()}</span>
							<span>{d.commandsPercentage}%</span>
						</div>
						<Progress
							value={d.commandsPercentage}
							max={100}
							variant={thresholdToProgressVariant(d.commandsThreshold)}
							showLabel={false}
						/>
					</div>

					<div>
						<div class="flex justify-between text-fluid-xs text-muted mb-1">
							<span>{m.admin_db_label_storage()}</span>
							<span>{d.storagePercentage}%</span>
						</div>
						<Progress
							value={d.storagePercentage}
							max={100}
							variant={thresholdToProgressVariant(d.storageThreshold)}
							showLabel={false}
						/>
					</div>

					<DiagGrid>
						<DiagRow label={m.admin_db_label_commands_used()}>{formatNumber(d.commandsUsed)}</DiagRow>
						<DiagRow label={m.admin_db_label_commands_limit()}>{formatNumber(d.commandsLimit)} {m.admin_db_label_commands_limit_suffix()}</DiagRow>
						<DiagRow label={m.admin_db_label_storage_used()}>{formatBytes(d.storageBytes)}</DiagRow>
						<DiagRow label={m.admin_db_label_storage_limit()}>{formatBytes(d.storageLimit)}</DiagRow>
						<DiagRow label={m.admin_db_label_latency()}><code>{data.upstash.latencyMs}ms</code></DiagRow>
					</DiagGrid>
				</div>
			{:else}
				<Alert
					variant={data.upstash.status === 'error' ? 'error' : 'warning'}
					title={m.admin_db_upstash_unavailable_title()}
					description={data.upstash.error ?? m.admin_db_upstash_unavailable_desc()}
				/>
				<p class="text-fluid-xs text-muted mt-3">
					<a
						href="https://console.upstash.com"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline"
					>{m.admin_db_upstash_view_console()}</a>
				</p>
			{/if}
		{/snippet}
	</Card>

	<!-- ── Cloudflare R2 ──────────────────────────────────────────────────────── -->
	<Card>
		{#snippet header()}
			<div class="card-header-row">
				<div class="flex items-center gap-2">
					<span class="i-lucide-hard-drive provider-icon" aria-hidden="true"></span>
					<h2 class="text-fluid-base font-semibold">Cloudflare R2</h2>
				</div>
				{#if data.r2.status === 'ok' && data.r2.data}
					<Tag
						variant={thresholdToTagVariant(data.r2.data.storageThreshold)}
						label={data.r2.data.storageThreshold === 'ok' ? m.admin_db_status_healthy() : data.r2.data.storageThreshold === 'warning' ? m.admin_db_status_warning() : m.admin_db_status_critical()}
					/>
				{:else}
					<Tag variant={statusToTagVariant(data.r2.status)} label={statusLabel(data.r2.status)} />
				{/if}
			</div>
			{#if data.r2.measuredAt}
				<p class="text-fluid-xs text-muted">{timeAgo(data.r2.measuredAt)}</p>
			{/if}
		{/snippet}
		{#snippet children()}
			{#if data.r2.status === 'ok' && data.r2.data}
				{@const d = data.r2.data}
				<div class="flex flex-col gap-4">
					<div>
						<div class="flex justify-between text-fluid-xs text-muted mb-1">
							<span>{m.admin_db_label_storage()}</span>
							<span>{d.storagePercentage}%</span>
						</div>
						<Progress
							value={d.storagePercentage}
							max={100}
							variant={thresholdToProgressVariant(d.storageThreshold)}
							showLabel={false}
						/>
					</div>

					<DiagGrid>
						<DiagRow label={m.admin_db_label_storage_used()}>{formatBytes(d.storageBytes)}</DiagRow>
						<DiagRow label={m.admin_db_label_storage_limit()}>{formatBytes(d.storageLimit)}</DiagRow>
						<DiagRow label={m.admin_db_label_objects()}>{formatNumber(d.objectCount)}</DiagRow>
						<DiagRow label={m.admin_db_label_latency()}><code>{data.r2.latencyMs}ms</code></DiagRow>
					</DiagGrid>

					<p class="text-fluid-xs text-muted">
						<span class="i-lucide-info inline-block mr-1 align-middle" aria-hidden="true"></span>
						{m.admin_db_r2_analytics_note()}
					</p>
				</div>
			{:else}
				<Alert
					variant={data.r2.status === 'error' ? 'error' : 'warning'}
					title={m.admin_db_r2_unavailable_title()}
					description={data.r2.error ?? m.admin_db_r2_unavailable_desc()}
				/>
				<p class="text-fluid-xs text-muted mt-3">
					<a
						href="https://dash.cloudflare.com"
						target="_blank"
						rel="noopener noreferrer"
						class="text-primary hover:underline"
					>{m.admin_db_r2_view_console()}</a>
				</p>
			{/if}
		{/snippet}
	</Card>

</div>

<style>
	.card-header-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.provider-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.neo4j-detail {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.detail-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.detail-section-title {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}
</style>
