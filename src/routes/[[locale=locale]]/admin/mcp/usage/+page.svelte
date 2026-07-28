<script lang="ts">
import { invalidateAll } from '$app/navigation';
import { Card, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const windows = [
	{ value: '24h', label: '24h' },
	{ value: '7d', label: '7d' },
	{ value: '30d', label: '30d' },
];

/**
 * Sub-millisecond is the CORRECT reading for public tool dispatch — it is pure CPU over a static
 * registry. A bare "0 ms" reads as a broken measurement instead of as a fast one.
 */
function ms(value: number | null | undefined): string {
	if (value === null || value === undefined) return '—';
	return value < 1 ? '<1 ms' : `${value} ms`;
}

/**
 * Always print the raw N beside a percentage, at every volume.
 *
 * One rule that scales, instead of a low-sample banner plus a later decision about when to stop
 * showing it. Below the floor there is no percentage at all: at n=3 a single call moves a rate by
 * 33 points, and a number that unstable is worse than no number.
 */
function rate(part: number, whole: number): string {
	if (whole < 20) return `${part} of ${whole}`;
	return `${Math.round((part / whole) * 100)}% (${part} of ${whole})`;
}

const totalCalls = $derived(data.unavailable ? 0 : data.health.external + data.health.selfTraffic);
</script>

<Stack gap="6">
	<Cluster justify="between" align="center">
		<div>
			<h2 class="text-fluid-lg font-semibold">Usage</h2>
			<p class="text-fluid-sm text-muted">What consumers ask the hosted MCP for, and what they get.</p>
		</div>
		<Cluster gap="2">
			<nav class="filter-bar" aria-label="Time window">
				{#each windows as w (w.value)}
					<a
						href={localizeHref(`/admin/mcp/usage?window=${w.value}`)}
						class="filter-link"
						class:active={data.window === w.value}
						aria-current={data.window === w.value ? 'page' : undefined}>{w.label}</a
					>
				{/each}
			</nav>
			<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
				<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>Refresh
			</Button>
		</Cluster>
	</Cluster>

	{#if data.unavailable}
		<EmptyState
			icon="i-lucide-database-zap"
			title="Telemetry not provisioned"
			description="The mcp.call_log table is not reachable. Run db:push — until then no calls are being recorded, which is not the same as no calls being made."
		/>
	{:else}
		<!-- CARD 1 — the headline. A single gap is actionable at n=1; everything below is context. -->
		<Card>
			{#snippet header()}
				<Cluster justify="between" align="center">
					<div>
						<h3 class="text-fluid-md font-semibold">Capability gaps</h3>
						<p class="text-fluid-xs text-muted">
							Queries that matched nothing — each names something a consumer wanted and the registry
							does not have. Shown once at least {data.minDistinctClients} distinct callers have asked.
						</p>
					</div>
				</Cluster>
			{/snippet}

			{#await data.gaps}
				<div class="skeleton-table"></div>
			{:then gaps}
				{#if gaps.length === 0}
					<EmptyState
						icon="i-lucide-search-x"
						title="No capability gaps yet"
						description="Either nothing has been asked that the registry could not answer, or no question has reached the distinct-caller threshold."
					/>
				{:else}
					<div class="table-wrap" tabindex="0" aria-label="Capability gaps">
						<table class="data-table">
							<thead>
								<tr><th>Query</th><th>Via</th><th>Callers</th><th>Last asked</th></tr>
							</thead>
							<tbody>
								{#each gaps as gap (gap.queryText)}
									<tr>
										<td class="query-cell">{gap.queryText}</td>
										<td><Badge variant="outline">{gap.toolName ?? '—'}</Badge></td>
										<td>{gap.distinctClients}</td>
										<td class="text-muted">{gap.lastSeen ? new Date(gap.lastSeen).toLocaleString() : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			{:catch}
				<p class="text-fluid-sm text-muted">Could not load capability gaps.</p>
			{/await}

			{#snippet footer()}
				{#await data.suppressedGaps then suppressed}
					{#if suppressed > 0}
						<p class="text-fluid-xs text-muted">
							{suppressed} further quer{suppressed === 1 ? 'y is' : 'ies are'} held back below the
							{data.minDistinctClients}-caller threshold.
						</p>
					{/if}
				{/await}
			{/snippet}
		</Card>

		<!-- CARD 2 — tool quality. Only meaningful once something has failed. -->
		{#if data.tools.some((t) => t.empty + t.invalidArgs + t.notFound + t.threw + t.uninstrumented > 0)}
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-md font-semibold">Tool outcomes</h3>
				{/snippet}
				<div class="table-wrap" tabindex="0" aria-label="Tool outcomes">
					<table class="data-table">
						<thead>
							<tr><th>Tool</th><th>Calls</th><th>No match</th><th>Bad args</th><th>Not found</th><th>Threw</th></tr>
						</thead>
						<tbody>
							{#each data.tools as tool (tool.toolName)}
								<tr>
									<td><code>{tool.toolName}</code></td>
									<td>{tool.calls}</td>
									<td>{rate(tool.empty, tool.calls)}</td>
									<td>{rate(tool.invalidArgs, tool.calls)}</td>
									<td>{rate(tool.notFound, tool.calls)}</td>
									<td>{rate(tool.threw, tool.calls)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#snippet footer()}
					{#if data.tools.some((t) => t.uninstrumented > 0)}
						<!-- Not a caller problem: a handler returned isError without a diag, so some call site
						     is uninstrumented and its rows are landing in a bucket that means "unknown". -->
						<Badge variant="warning">
							{data.tools.reduce((n, t) => n + t.uninstrumented, 0)} unclassified tool errors — an errorResult
							call site is missing its reason
						</Badge>
					{/if}
				{/snippet}
			</Card>
		{/if}

		<!-- CARD 3 — independent tallies. Deliberately NOT a funnel: no session key exists, so no
		     drop-off between these numbers can be claimed. -->
		<Card>
			{#snippet header()}
				<div>
					<h3 class="text-fluid-md font-semibold">Call volume by stage</h3>
					<p class="text-fluid-xs text-muted">
						Independent counts over the window, not a journey — there is no session key, so these
						cannot say the same caller moved between stages.
					</p>
				</div>
			{/snippet}
			{#if data.stages.length === 0}
				<EmptyState icon="i-lucide-bar-chart-3" title="No calls in this window" />
			{:else}
				<div class="table-wrap" tabindex="0" aria-label="Call volume by stage">
					<table class="data-table">
						<thead><tr><th>Stage</th><th>Outcome</th><th>Calls</th></tr></thead>
						<tbody>
							{#each data.stages as row (`${row.stage}-${row.outcome}`)}
								<tr>
									<td><Badge variant={row.stage === 'tool' ? 'default' : 'secondary'}>{row.stage}</Badge></td>
									<td><code>{row.outcome}</code></td>
									<td>{row.calls}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</Card>

		<!-- CARD 4 — latency, split so the rate limiter cannot be mistaken for slow tools. -->
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-md font-semibold">Latency</h3>
			{/snippet}
			<Stack gap="3">
				{#if data.health.failOpen > 0}
					<!-- A percentile would smooth over exactly this event, so it gets its own line. It is a
					     security signal: the limit was NOT enforced for those requests. -->
					<Badge variant="warning">
						<span class="i-lucide-shield-alert h-4 w-4 mr-1"></span>
						Rate limiter unavailable — {data.health.failOpen} request(s) allowed through unchecked
					</Badge>
				{:else}
					<Badge variant="success">Rate limiter enforced on every request in this window</Badge>
				{/if}

				{#if data.latency.length > 0}
					<div class="table-wrap" tabindex="0" aria-label="Latency by surface">
						<table class="data-table">
							<thead>
								<tr><th>Surface</th><th>Rate limiter check</th><th>Tool execution</th><th>Total</th></tr>
							</thead>
							<tbody>
								{#each data.latency as row (row.surface)}
									<tr>
										<td>{row.surface}</td>
										<td>{ms(row.gateP50)} / {ms(row.gateP95)}</td>
										<td>{ms(row.dispatchP50)} / {ms(row.dispatchP95)}</td>
										<td>{ms(row.totalP50)} / {ms(row.totalP95)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
					<p class="text-fluid-xs text-muted">
						p50 / p95. "Rate limiter check" is the Upstash round trip and is on the path of every
						request — on the public surface it normally dominates, because tool execution is pure CPU
						over a static registry.
					</p>
				{/if}
			</Stack>
		</Card>

		<!-- CARD 5 — orientation only, deliberately last. Volume answers "is this used at all", never
		     "what should I change", so it must not outrank the gap list. -->
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-md font-semibold">Traffic</h3>
			{/snippet}
			<Stack gap="3">
				<Cluster gap="4">
					<div class="stat">
						<span class="stat-value">{data.health.external}</span>
						<span class="stat-label">External calls</span>
					</div>
					<div class="stat muted">
						<span class="stat-value">{data.health.selfTraffic}</span>
						<span class="stat-label">Your own / preview</span>
					</div>
					<div class="stat muted">
						<span class="stat-value">{data.health.distinctClients}</span>
						<span class="stat-label">Distinct callers</span>
					</div>
				</Cluster>
				{#if totalCalls < 20 && totalCalls > 0}
					<p class="text-fluid-xs text-muted">
						{totalCalls} call(s) in this window — too few to read as rates.
					</p>
				{/if}
				{#if data.health.unknownMethod > 0}
					<Badge variant="secondary">
						{data.health.unknownMethod} call(s) asked for a capability this server does not expose
					</Badge>
				{/if}
				{#if data.health.authFailures > 0}
					<Badge variant="warning">{data.health.authFailures} failed admin credential attempt(s)</Badge>
				{/if}
			</Stack>
			{#snippet footer()}
				{#await data.unsupportedVersions then versions}
					{#if versions.length > 0}
						<p class="text-fluid-xs text-muted">
							Protocol versions requested but not served: {versions
								.map((v) => `${v.requestedProtocolVersion} (${v.calls})`)
								.join(', ')}. Read alongside initialize volume — a conforming client produces one
							such rejection per connection by design.
						</p>
					{/if}
				{/await}
			{/snippet}
		</Card>
	{/if}
</Stack>

<style>
.filter-bar {
	display: flex;
	gap: var(--spacing-1);
}
.filter-link {
	padding: var(--spacing-1) var(--spacing-2);
	border-radius: var(--radius-sm);
	font-size: var(--text-fluid-xs);
	font-family: ui-monospace, monospace;
	color: var(--color-muted);
	text-decoration: none;
}
.filter-link.active {
	background: var(--color-fg);
	color: var(--color-bg);
}
.table-wrap {
	overflow-x: auto;
	border-radius: var(--radius-md);
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
.data-table th,
.data-table td {
	padding: var(--spacing-2) var(--spacing-3);
	text-align: left;
	border-bottom: 1px solid var(--color-border);
	white-space: nowrap;
}
.data-table th {
	color: var(--color-muted);
	font-weight: 500;
}
/* Caller-supplied text: rendered in text position only, never into an attribute. */
.query-cell {
	font-family: ui-monospace, monospace;
	max-width: 32rem;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}
.stat {
	display: flex;
	flex-direction: column;
}
.stat-value {
	font-size: var(--text-fluid-xl);
	font-weight: 600;
}
.stat.muted .stat-value {
	color: var(--color-muted);
	font-weight: 500;
}
.stat-label {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}
.skeleton-table {
	height: 200px;
	background: var(--color-subtle);
	border-radius: var(--radius-md);
	animation: pulse 1.5s ease-in-out infinite;
}
@keyframes pulse {
	0%,
	100% {
		opacity: 1;
	}
	50% {
		opacity: 0.5;
	}
}
@media (prefers-reduced-motion: reduce) {
	.skeleton-table {
		animation: none;
		opacity: 0.6;
	}
}
</style>
