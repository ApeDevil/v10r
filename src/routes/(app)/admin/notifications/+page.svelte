<script lang="ts">
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { Alert, Card, ConfirmDialog, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Skeleton, Spinner, Tag, Textarea } from '$lib/components/primitives';
import AnnouncementBanner from '$lib/components/shell/AnnouncementBanner.svelte';
import { getToast } from '$lib/state/toast.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();
const toast = getToast();

// ── State ────────────────────────────────────────────────────────────────────

let submitting = $state(false);
let expandedDelivery = $state<string | null>(null);
let deactivatingId = $state<string | null>(null);
let confirmDeactivate = $state(false);

// Compose form state
let composeTitle = $state('');
let composeBody = $state('');
let composeSeverity = $state<'info' | 'warning' | 'critical'>('info');
let composeStartsAt = $state('');
let composeEndsAt = $state('');

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(d: Date | string | null): string {
	if (!d) return 'never';
	const diff = Date.now() - new Date(d).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

function healthStatus(channel: string): { label: string; variant: 'success' | 'warning' | 'error' | 'secondary' } {
	const stat = data.healthStats.find((s) => s.channel === channel);
	if (!stat) return { label: 'No data', variant: 'secondary' };
	const total = stat.sent + stat.systemFailures;
	if (total === 0) return { label: 'No activity', variant: 'secondary' };
	const failRate = stat.systemFailures / total;
	if (failRate >= 0.25 || stat.dead > 0) return { label: 'Unhealthy', variant: 'error' };
	if (failRate >= 0.05) return { label: 'Degraded', variant: 'warning' };
	return { label: 'Healthy', variant: 'success' };
}

const channels = [
	{ key: 'discord', label: 'Discord', icon: 'i-lucide-message-circle' },
	{ key: 'telegram', label: 'Telegram', icon: 'i-lucide-send' },
	{ key: 'email', label: 'Email', icon: 'i-lucide-mail' },
];

// Preview announcement for live preview
const previewAnnouncement = $derived(
	composeTitle.trim()
		? [
				{
					id: 'preview',
					title: composeTitle,
					body: composeBody,
					severity: composeSeverity,
					startsAt: null,
					endsAt: null,
					createdAt: new Date(),
				},
			]
		: [],
);

const activeAnnouncements = $derived(data.announcements.filter((a) => a.active));

function resetComposeForm() {
	composeTitle = '';
	composeBody = '';
	composeSeverity = 'info';
	composeStartsAt = '';
	composeEndsAt = '';
}
</script>
<Stack gap="6">

	<!-- ═══ Section 1: Channel Health ═══════════════════════════════════════════ -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Channel Health</h2>
				<form method="POST" action="?/retest" use:enhance>
					<Button type="submit" variant="outline" size="sm">
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						Retest
					</Button>
				</form>
			</Cluster>
		{/snippet}

		<div class="channel-cards">
			{#each channels as ch}
				{@const stat = data.healthStats.find((s) => s.channel === ch.key)}
				{@const health = healthStatus(ch.key)}
				{@const connected = ch.key === 'discord' ? data.connectedAccounts.discord : ch.key === 'telegram' ? data.connectedAccounts.telegram : null}
				<div class="channel-card">
					<div class="channel-card-header">
						<Cluster gap="2" align="center">
							<span class="health-dot health-dot--{health.variant}" aria-hidden="true"></span>
							<span class={`${ch.icon} h-4 w-4`} aria-hidden="true"></span>
							<span class="channel-name">{ch.label}</span>
						</Cluster>
						<Tag variant={health.variant} label={health.label} />
					</div>

					<div class="channel-stats">
						{#if stat}
							<div class="channel-stat">
								<span class="channel-stat-label">Last sent</span>
								<span class="channel-stat-value">{relativeTime(stat.lastSentAt)}</span>
							</div>
							<div class="channel-stat">
								<span class="channel-stat-label">Sent (24h)</span>
								<span class="channel-stat-value">{stat.sent}</span>
							</div>
							<div class="channel-stat">
								<span class="channel-stat-label">Failures</span>
								<span class="channel-stat-value">{stat.systemFailures}</span>
							</div>
							{#if stat.userFailures > 0}
								<div class="channel-stat">
									<span class="channel-stat-label">User issues</span>
									<span class="channel-stat-value text-warning">{stat.userFailures}</span>
								</div>
							{/if}
						{:else}
							<p class="text-muted text-fluid-xs">No delivery data</p>
						{/if}
						{#if connected !== null}
							<div class="channel-stat">
								<span class="channel-stat-label">Connected</span>
								<span class="channel-stat-value">{connected} users</span>
							</div>
						{/if}
					</div>

					<!-- Live probe status (streamed) -->
					{#await data.liveProbes}
						<div class="probe-status">
							<Skeleton variant="text" width="6rem" height="1rem" />
						</div>
					{:then probes}
						{@const probe = ch.key === 'discord' ? probes.discord : ch.key === 'telegram' ? probes.telegram : null}
						{#if probe}
							<div class="probe-status">
								{#if probe.status === 'ok'}
									<span class="text-fluid-xs text-success">API reachable ({probe.latencyMs}ms)</span>
								{:else if probe.status === 'unconfigured'}
									<span class="text-fluid-xs text-warning">Not configured</span>
								{:else}
									<span class="text-fluid-xs text-error">{probe.message}</span>
								{/if}
							</div>
						{/if}
					{:catch}
						<div class="probe-status">
							<span class="text-fluid-xs text-muted">Probe failed</span>
						</div>
					{/await}
				</div>
			{/each}
		</div>
	</Card>

	<!-- ═══ Section 2: Delivery Log ════════════════════════════════════════════ -->

	<!-- Needs Attention -->
	{#if data.deadEntries.length > 0}
		<Card>
			{#snippet header()}
				<Cluster gap="2" align="center">
					<span class="i-lucide-alert-triangle h-5 w-5 text-error" aria-hidden="true"></span>
					<h2 class="text-fluid-lg font-semibold">Needs Attention</h2>
					<Tag variant="error" label={String(data.deadEntries.length)} />
				</Cluster>
			{/snippet}

			<div class="dead-entries">
				{#each data.deadEntries as entry}
					<div class="dead-entry">
						<div class="dead-entry-info">
							<Badge variant="error">{entry.channel}</Badge>
							<span class="text-fluid-sm">{entry.notificationTitle}</span>
							{#if entry.errorMessage}
								<code class="text-fluid-xs text-error">{entry.errorMessage}</code>
							{/if}
						</div>
						<form method="POST" action="?/retryDelivery" use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'success') {
									toast.success('Delivery queued for retry.');
								}
								return update();
							};
						}}>
							<input type="hidden" name="delivery_id" value={entry.id} />
							<Button type="submit" variant="outline" size="sm">Retry</Button>
						</form>
					</div>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Delivery Log Table -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">Delivery Log</h2>
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					Refresh
				</Button>
			</Cluster>
		{/snippet}

		<!-- Filters -->
		<form method="GET" class="filter-form">
			<select name="channel" class="filter-select">
				<option value="all" selected={data.filters.channel === 'all'}>All channels</option>
				{#each channels as ch}
					<option value={ch.key} selected={data.filters.channel === ch.key}>{ch.label}</option>
				{/each}
			</select>
			<select name="status" class="filter-select">
				<option value="all" selected={data.filters.status === 'all'}>All statuses</option>
				<option value="sent" selected={data.filters.status === 'sent'}>Sent</option>
				<option value="failed" selected={data.filters.status === 'failed'}>Failed</option>
				<option value="dead" selected={data.filters.status === 'dead'}>Dead</option>
				<option value="pending" selected={data.filters.status === 'pending'}>Pending</option>
			</select>
			<Button type="submit" variant="outline" size="sm">Filter</Button>
			{#if data.filters.channel !== 'all' || data.filters.status !== 'all'}
				<a href="/admin/notifications" class="text-primary text-fluid-xs hover:underline">Clear</a>
			{/if}
		</form>

		{#await data.deliveryLog}
			<div class="flex flex-col gap-2 mt-4">
				{#each Array(5) as _}
					<Skeleton variant="text" height="2rem" />
				{/each}
			</div>
		{:then log}
			{#if log.entries.length === 0}
				<EmptyState
					icon="i-lucide-send"
					title={data.filters.channel !== 'all' || data.filters.status !== 'all'
						? 'No deliveries match these filters'
						: 'No notifications sent yet'}
					description={data.filters.channel !== 'all' || data.filters.status !== 'all'
						? 'Try different filter criteria.'
						: 'Notifications will appear here when sent.'}
				>
					{#if data.filters.channel !== 'all' || data.filters.status !== 'all'}
						<a href="/admin/notifications" class="text-primary hover:underline text-fluid-sm">Clear filters</a>
					{/if}
				</EmptyState>
			{:else}
				<div class="delivery-table-wrap">
					<table class="delivery-table">
						<thead>
							<tr>
								<th>Time</th>
								<th>Channel</th>
								<th>Type</th>
								<th>Status</th>
								<th>Attempts</th>
								<th>Detail</th>
							</tr>
						</thead>
						<tbody>
							{#each log.entries as entry}
								<tr
									class:error-row={entry.status === 'failed' || entry.status === 'dead'}
									class:clickable={!!entry.errorMessage}
									onclick={() => {
										if (entry.errorMessage) {
											expandedDelivery = expandedDelivery === entry.id ? null : entry.id;
										}
									}}
									onkeydown={(e) => {
										if (entry.errorMessage && (e.key === 'Enter' || e.key === ' ')) {
											expandedDelivery = expandedDelivery === entry.id ? null : entry.id;
										}
									}}
									tabindex={entry.errorMessage ? 0 : -1}
									role={entry.errorMessage ? 'button' : undefined}
								>
									<td class="time-cell">{relativeTime(entry.createdAt)}</td>
									<td><Badge variant="secondary">{entry.channel}</Badge></td>
									<td><code class="text-fluid-xs">{entry.notificationType}</code></td>
									<td>
										<Badge variant={entry.status === 'sent' ? 'success' : entry.status === 'dead' ? 'error' : entry.status === 'failed' ? 'error' : 'secondary'}>
											{entry.status}
										</Badge>
									</td>
									<td>{entry.attempts}</td>
									<td>
										{#if entry.errorMessage}
											<span class="text-fluid-xs text-primary cursor-pointer">Show</span>
										{:else}
											<span class="text-muted">—</span>
										{/if}
									</td>
								</tr>
								{#if entry.errorMessage && expandedDelivery === entry.id}
									<tr class="error-detail-row">
										<td colspan="6">
											<div class="error-detail">
												<span class="i-lucide-alert-triangle h-4 w-4 error-icon"></span>
												<div>
													{#if entry.errorCode}
														<code class="text-fluid-xs font-semibold">{entry.errorCode}</code>
														<br />
													{/if}
													<code class="text-fluid-xs">{entry.errorMessage}</code>
												</div>
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if log.totalPages > 1}
					<div class="pagination">
						{#if log.page > 1}
							<a href="/admin/notifications?channel={data.filters.channel}&status={data.filters.status}&page={log.page - 1}" class="page-link">
								<span class="i-lucide-chevron-left h-4 w-4"></span> Prev
							</a>
						{/if}
						<span class="page-info">Page {log.page} of {log.totalPages}</span>
						{#if log.page < log.totalPages}
							<a href="/admin/notifications?channel={data.filters.channel}&status={data.filters.status}&page={log.page + 1}" class="page-link">
								Next <span class="i-lucide-chevron-right h-4 w-4"></span>
							</a>
						{/if}
					</div>
				{/if}
			{/if}
		{:catch}
			<Alert variant="error" title="Failed to load delivery log" description="Could not fetch delivery data.">
				<Button variant="outline" size="sm" onclick={() => invalidateAll()}>Try again</Button>
			</Alert>
		{/await}
	</Card>

	<!-- ═══ Section 3: Broadcast Announcements ════════════════════════════════ -->
	<div class="section-divider"></div>

	<h2 class="text-fluid-xl font-semibold">Broadcast Announcements</h2>

	<div class="announcements-grid">
		<!-- Compose Form -->
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-lg font-semibold">New Announcement</h3>
			{/snippet}

			<form
				method="POST"
				action="?/createAnnouncement"
				use:enhance={() => {
					submitting = true;
					return async ({ result, update }) => {
						if (result.type === 'success') {
							toast.success('Announcement published.');
							resetComposeForm();
						} else if (result.type === 'failure') {
							toast.error((result.data?.message as string) || 'Failed to create announcement.');
						}
						submitting = false;
						return update();
					};
				}}
			>
				<Stack gap="4">
					<div>
						<label for="ann-title" class="field-label">Title</label>
						<Input
							id="ann-title"
							name="title"
							bind:value={composeTitle}
							maxlength={120}
							placeholder="System maintenance scheduled..."
							required
						/>
						<span class="char-count">{composeTitle.length} / 120</span>
					</div>

					<div>
						<label for="ann-body" class="field-label">Body</label>
						<Textarea
							id="ann-body"
							name="body"
							bind:value={composeBody}
							placeholder="Describe the announcement..."
							rows={3}
							required
						/>
						<span class="field-hint">Displayed as plain text. No formatting.</span>
					</div>

					<div>
						<span class="field-label">Severity</span>
						<div class="severity-group" role="radiogroup" aria-label="Announcement severity">
							{#each ['info', 'warning', 'critical'] as sev}
								<label class="severity-option" class:active={composeSeverity === sev} class:severity-info={sev === 'info'} class:severity-warning={sev === 'warning'} class:severity-critical={sev === 'critical'}>
									<input type="radio" name="severity" value={sev} bind:group={composeSeverity} class="sr-only" />
									{sev}
								</label>
							{/each}
						</div>
					</div>

					{#if composeSeverity === 'critical'}
						<Alert variant="info" title="Non-dismissible" description="Critical announcements cannot be dismissed by users. They remain visible until you deactivate this announcement." />
					{/if}

					<div class="schedule-row">
						<div>
							<label for="ann-starts" class="field-label">Active from</label>
							<input type="datetime-local" id="ann-starts" name="starts_at" bind:value={composeStartsAt} class="schedule-input" />
						</div>
						<div>
							<label for="ann-ends" class="field-label">Until</label>
							<input type="datetime-local" id="ann-ends" name="ends_at" bind:value={composeEndsAt} class="schedule-input" />
						</div>
					</div>
					<span class="field-hint">Leave both blank for an immediately active, permanent announcement.</span>

					<!-- Live preview -->
					{#if previewAnnouncement.length > 0}
						<div>
							<span class="detail-section-title">Preview</span>
							<div class="preview-container">
								<AnnouncementBanner announcements={previewAnnouncement} />
							</div>
						</div>
					{/if}

					<Button type="submit" disabled={submitting}>
						{#if submitting}
							<Spinner size="xs" class="mr-1" />
						{/if}
						Publish
					</Button>
				</Stack>
			</form>
		</Card>

		<!-- Active Announcements List -->
		<Card>
			{#snippet header()}
				<Cluster gap="2" align="center">
					<h3 class="text-fluid-lg font-semibold">Active</h3>
					{#if activeAnnouncements.length > 0}
						<Tag variant="secondary" label={String(activeAnnouncements.length)} />
					{/if}
				</Cluster>
			{/snippet}

			{#if activeAnnouncements.length === 0}
				<EmptyState
					icon="i-lucide-megaphone"
					title="No active announcements"
					description="Create an announcement to notify all users."
				/>
			{:else}
				<Stack gap="3">
					{#each activeAnnouncements as ann}
						<div class="announcement-card">
							<div class="announcement-card-header">
								<span class="font-semibold text-fluid-sm">{ann.title}</span>
								<Tag variant={ann.severity === 'critical' ? 'error' : ann.severity === 'warning' ? 'warning' : 'default'} label={ann.severity} />
							</div>
							<p class="announcement-body">{ann.body}</p>
							<div class="announcement-meta">
								<span>Published {relativeTime(ann.createdAt)}</span>
								{#if ann.endsAt}
									<span>Expires {relativeTime(ann.endsAt)}</span>
								{:else}
									<span>No expiry</span>
								{/if}
							</div>
							<div class="announcement-stats">
								{#if ann.severity === 'critical'}
									<span>Non-dismissible</span>
									<span>{ann.acknowledgedCount} acknowledged</span>
								{:else}
									<span>{ann.dismissedCount} dismissed</span>
								{/if}
								<span>{ann.totalUsers - ann.dismissedCount - ann.acknowledgedCount} seeing</span>
							</div>
							<Button
								variant="ghost"
								size="sm"
								onclick={() => {
									deactivatingId = ann.id;
									confirmDeactivate = true;
								}}
							>Deactivate</Button>
						</div>
					{/each}
				</Stack>
			{/if}
		</Card>
	</div>
</Stack>

<!-- Deactivate confirmation -->
<ConfirmDialog
	bind:open={confirmDeactivate}
	title="Deactivate announcement"
	description="All users will stop seeing this announcement immediately."
	confirmLabel="Deactivate"
	onconfirm={() => {
		if (!deactivatingId) return;
		const form = document.createElement('form');
		form.method = 'POST';
		form.action = '?/deactivateAnnouncement';
		form.style.display = 'none';
		const input = document.createElement('input');
		input.name = 'id';
		input.value = deactivatingId;
		form.appendChild(input);
		document.body.appendChild(form);
		form.submit();
	}}
	oncancel={() => { confirmDeactivate = false; }}
/>

<style>
	/* Channel Health Cards */
	.channel-cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: var(--spacing-4);
	}

	.channel-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.channel-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.health-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
	}

	.health-dot--success { background: var(--color-success); }
	.health-dot--warning { background: var(--color-warning); }
	.health-dot--error { background: var(--color-error); }
	.health-dot--secondary { background: var(--color-muted); }

	.channel-name {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
	}

	.channel-stats {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-1);
	}

	.channel-stat {
		display: flex;
		flex-direction: column;
	}

	.channel-stat-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.channel-stat-value {
		font-size: var(--text-fluid-sm);
		font-family: ui-monospace, monospace;
	}

	.probe-status {
		padding-top: var(--spacing-1);
		border-top: 1px solid var(--color-border);
	}

	/* Dead Entries */
	.dead-entries {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.dead-entry {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		background: color-mix(in srgb, var(--color-error) 5%, transparent);
		border-radius: var(--radius-sm);
	}

	.dead-entry-info {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
	}

	/* Filter Form */
	.filter-form {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		margin-bottom: var(--spacing-4);
	}

	.filter-select {
		padding: var(--spacing-1) var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-xs);
	}

	/* Delivery Table (same pattern as jobs) */
	.delivery-table-wrap {
		overflow-x: auto;
	}

	.delivery-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.delivery-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.delivery-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.delivery-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.error-row {
		background: color-mix(in srgb, var(--color-error) 5%, transparent);
	}

	.clickable { cursor: pointer; }
	.time-cell { color: var(--color-muted); }

	.error-detail-row td {
		padding: 0 var(--spacing-3) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
	}

	.error-detail {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		background: color-mix(in srgb, var(--color-error) 8%, transparent);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-xs);
	}

	.error-icon {
		color: var(--color-error);
		flex-shrink: 0;
		margin-top: 2px;
	}

	/* Pagination (same as jobs) */
	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
		margin-top: var(--spacing-4);
	}

	.page-link {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
		text-decoration: none;
	}

	.page-link:hover { text-decoration: underline; }
	.page-info { font-size: var(--text-fluid-sm); color: var(--color-muted); }

	/* Section Divider */
	.section-divider {
		border-top: 1px solid var(--color-border);
		margin: var(--spacing-2) 0;
	}

	/* Announcements Grid */
	.announcements-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--spacing-6);
	}

	@media (max-width: 768px) {
		.announcements-grid {
			grid-template-columns: 1fr;
		}
	}

	/* Compose Form */
	.field-label {
		display: block;
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		margin-bottom: var(--spacing-1);
	}

	.field-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.char-count {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		float: right;
	}

	/* Severity Radio Group */
	.severity-group {
		display: flex;
		gap: 0;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	.severity-option {
		flex: 1;
		padding: var(--spacing-2) var(--spacing-3);
		text-align: center;
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		text-transform: capitalize;
		cursor: pointer;
		background: var(--color-subtle);
		border-right: 1px solid var(--color-border);
		transition: background 0.1s;
	}

	.severity-option:last-child {
		border-right: none;
	}

	.severity-option:hover {
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
	}

	.severity-option.active.severity-info {
		background: color-mix(in srgb, var(--color-primary) 20%, transparent);
		color: var(--color-primary);
	}

	.severity-option.active.severity-warning {
		background: color-mix(in srgb, var(--color-warning) 20%, transparent);
		color: var(--color-warning);
	}

	.severity-option.active.severity-critical {
		background: color-mix(in srgb, var(--color-error) 20%, transparent);
		color: var(--color-error);
	}

	/* Schedule */
	.schedule-row {
		display: flex;
		gap: var(--spacing-3);
	}

	.schedule-row > div {
		flex: 1;
	}

	.schedule-input {
		width: 100%;
		padding: var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}

	/* Preview */
	.detail-section-title {
		display: block;
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--spacing-2);
	}

	.preview-container {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}

	/* Active Announcement Cards */
	.announcement-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
	}

	.announcement-card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.announcement-body {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.announcement-meta {
		display: flex;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.announcement-stats {
		display: flex;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-style: italic;
	}
</style>
