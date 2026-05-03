<script lang="ts">
import { enhance } from '$app/forms';
import { Card, DiagGrid, DiagRow, EmptyState } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

let refreshing = $state(false);

// SSE connection state
let sseStatus = $state<'connecting' | 'connected' | 'disconnected'>('disconnected');
let unreadCount = $state(0);
let lastEvent = $state<{ type: string; time: string } | null>(null);

$effect(() => {
	const es = new EventSource('/api/notifications/stream');

	es.onopen = () => {
		sseStatus = 'connected';
	};

	es.addEventListener('init', (e) => {
		try {
			const payload = JSON.parse(e.data);
			unreadCount = payload.unreadCount ?? 0;
		} catch {}
	});

	es.addEventListener('new', (_e) => {
		unreadCount++;
		lastEvent = { type: 'new', time: new Date().toLocaleTimeString() };
	});

	es.addEventListener('read', () => {
		if (unreadCount > 0) unreadCount--;
		lastEvent = { type: 'read', time: new Date().toLocaleTimeString() };
	});

	es.addEventListener('read-all', () => {
		unreadCount = 0;
		lastEvent = { type: 'read-all', time: new Date().toLocaleTimeString() };
	});

	es.onerror = () => {
		sseStatus = 'disconnected';
	};

	return () => {
		es.close();
		sseStatus = 'disconnected';
	};
});

function relativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'just now';
	if (mins < 60) return `${mins}m ago`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

type BadgeVariant = 'success' | 'secondary' | 'warning' | 'error';

function statusVariant(status: string): BadgeVariant {
	const map: Record<string, BadgeVariant> = {
		pending: 'secondary',
		processing: 'warning',
		sent: 'success',
		failed: 'error',
		skipped: 'secondary',
	};
	return map[status] ?? 'secondary';
}

function channelStatus(deliveries: { channel: string; status: string }[], channel: string): string | null {
	const d = deliveries.find((d) => d.channel === channel);
	return d?.status ?? null;
}
</script>
<Stack gap="6">
	<!-- SSE Live -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_notifications_pipeline_card_sse()}</h2>
		{/snippet}

		<DiagGrid>
			<DiagRow label="Connection">
				{#if sseStatus === 'connected'}
					<Badge variant="success">Connected</Badge>
				{:else if sseStatus === 'connecting'}
					<Badge variant="warning">Connecting</Badge>
				{:else}
					<Badge variant="error">Disconnected</Badge>
				{/if}
			</DiagRow>

			<DiagRow label="Unread Count">
				<Badge variant={unreadCount > 0 ? 'warning' : 'secondary'}>{unreadCount}</Badge>
			</DiagRow>

			<DiagRow label="Last Event">
				{#if lastEvent}
					<Badge variant="secondary">{lastEvent.type}</Badge>
					<code>{lastEvent.time}</code>
				{:else}
					&mdash;
				{/if}
			</DiagRow>
		</DiagGrid>
	</Card>

	<!-- Recent Deliveries -->
	<Card>
		{#snippet header()}
			<Cluster justify="between">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_notifications_pipeline_card_deliveries()}</h2>
				<form
					method="POST"
					action="?/refresh"
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
							<Spinner size="xs" class="mr-2" />
						{/if}
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						{m.showcase_notifications_pipeline_btn_refresh()}
					</Button>
				</form>
			</Cluster>
		{/snippet}

		{#if data.recentNotifications.length === 0}
			<EmptyState
				icon="i-lucide-send"
				title={m.showcase_notifications_pipeline_empty_title()}
				description={m.showcase_notifications_pipeline_empty_desc()}
			/>
		{:else}
			<div class="history-table-wrap">
				<table class="history-table">
					<thead>
						<tr>
							<th>{m.showcase_notifications_pipeline_col_title()}</th>
							<th>{m.showcase_notifications_pipeline_col_type()}</th>
							<th>{m.showcase_notifications_pipeline_col_inapp()}</th>
							<th>{m.showcase_notifications_pipeline_col_email()}</th>
							<th>{m.showcase_notifications_pipeline_col_telegram()}</th>
							<th>{m.showcase_notifications_pipeline_col_discord()}</th>
							<th>{m.showcase_notifications_pipeline_col_time()}</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentNotifications as n}
							{@const emailStatus = channelStatus(n.deliveries, 'email')}
							{@const telegramStatus = channelStatus(n.deliveries, 'telegram')}
							{@const discordStatus = channelStatus(n.deliveries, 'discord')}
							<tr>
								<td class="title-cell">{n.title}</td>
								<td><Badge variant="secondary">{n.type}</Badge></td>
								<td><Badge variant="success">sent</Badge></td>
								<td>
									{#if emailStatus}
										<Badge variant={statusVariant(emailStatus)}>{emailStatus}</Badge>
									{:else}
										&mdash;
									{/if}
								</td>
								<td>
									{#if telegramStatus}
										<Badge variant={statusVariant(telegramStatus)}>{telegramStatus}</Badge>
									{:else}
										&mdash;
									{/if}
								</td>
								<td>
									{#if discordStatus}
										<Badge variant={statusVariant(discordStatus)}>{discordStatus}</Badge>
									{:else}
										&mdash;
									{/if}
								</td>
								<td class="time-cell">{relativeTime(n.createdAt)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</Card>
</Stack>

<style>
	.history-table-wrap {
		overflow-x: auto;
	}

	.history-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.history-table th {
		text-align: left;
		padding: var(--spacing-2) var(--spacing-3);
		font-weight: 600;
		color: var(--color-muted);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.history-table td {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		white-space: nowrap;
	}

	.history-table tbody tr:hover {
		background: var(--color-subtle);
	}

	.title-cell {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.time-cell {
		color: var(--color-muted);
	}
</style>
