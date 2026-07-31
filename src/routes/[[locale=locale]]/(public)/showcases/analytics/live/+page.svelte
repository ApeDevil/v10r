<script lang="ts">
import { page } from '$app/state';
import { Alert } from '$lib/components/composites';
import { Sparkline } from '$lib/components/viz/chart/sparkline';
import { getFormattingLocale } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { baseLocale, extractLocaleFromUrl } from '$lib/paraglide/runtime';
import ChartSection from '../_components/ChartSection.svelte';
import MetricCard from '../_components/MetricCard.svelte';

interface LiveEvent {
	id: number;
	type: string;
	path: string;
	timestamp: string;
	sessionId?: string;
}

let events = $state<LiveEvent[]>([]);
let activeSessions = $state(0);
let connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');

const formattingLocale = $derived(getFormattingLocale(extractLocaleFromUrl(page.url.href) ?? baseLocale));

// Rolling count of events per minute (last 10 minutes)
let minuteBuckets = $state<number[]>(new Array(10).fill(0));
const eventsPerMinute = $derived([...minuteBuckets]);

function addEvent(event: LiveEvent) {
	events = [event, ...events].slice(0, 50);
	minuteBuckets[minuteBuckets.length - 1]++;
}

$effect(() => {
	let source: EventSource;
	let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

	function connect() {
		source = new EventSource('/api/analytics/stream');

		source.onopen = () => {
			connectionStatus = 'connected';
		};

		source.onmessage = (e) => {
			try {
				const data = JSON.parse(e.data);
				if (data.type === 'init') {
					activeSessions = data.activeSessions ?? 0;
				} else if (data.type === 'event') {
					addEvent(data.event);
				} else if (data.type === 'sessions') {
					activeSessions = data.count;
				}
			} catch {
				// Ignore parse errors (heartbeats, etc.)
			}
		};

		source.onerror = () => {
			connectionStatus = 'disconnected';
			source.close();
			reconnectTimer = setTimeout(connect, 3000);
		};
	}

	connect();

	const bucketTimer = setInterval(() => {
		minuteBuckets = [...minuteBuckets.slice(1), 0];
	}, 60000);

	return () => {
		source.close();
		clearInterval(bucketTimer);
		if (reconnectTimer) clearTimeout(reconnectTimer);
	};
});

function formatTime(ts: string): string {
	return new Date(ts).toLocaleTimeString(formattingLocale, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

const eventTypeIcon: Record<string, string> = {
	pageview: 'i-lucide-eye',
	action: 'i-lucide-mouse-pointer-click',
	error: 'i-lucide-alert-triangle',
	timing: 'i-lucide-timer',
};
</script>

<div class="live-layout">
	<!-- Connection status -->
	<div class="connection-status" class:connecting={connectionStatus === 'connecting'} class:connected={connectionStatus === 'connected'} class:disconnected={connectionStatus === 'disconnected'} aria-live="polite" role="status">
		<span class="status-dot"></span>
		{#if connectionStatus === 'connecting'}
			{m.showcase_analytics_live_status_connecting()}
		{:else if connectionStatus === 'connected'}
			{m.showcase_analytics_live_status_connected()}
		{:else}
			{m.showcase_analytics_live_status_disconnected()}
		{/if}
	</div>

	<!-- Live metrics -->
	<div class="live-metrics">
		<MetricCard
			title={m.showcase_analytics_live_metric_sessions()}
			value={activeSessions}
		/>
		<MetricCard
			title={m.showcase_analytics_live_metric_events10m()}
			value={eventsPerMinute.reduce((a, b) => a + b, 0)}
			sparklineData={eventsPerMinute}
		/>
		<MetricCard
			title={m.showcase_analytics_live_metric_feed()}
			value={events.length}
		/>
	</div>

	<!-- Live event feed -->
	<ChartSection
		title={m.showcase_analytics_live_chart_feed()}
		description={m.showcase_analytics_live_desc_feed()}
	>
		{#snippet chart()}
			{#if events.length === 0}
				<div class="empty-feed">
					<span class="i-lucide-radio text-icon-lg" aria-hidden="true"></span>
					<p>{m.showcase_analytics_live_empty_title()}</p>
					<p class="text-fluid-xs">{m.showcase_analytics_live_empty_desc()}</p>
				</div>
			{:else}
				<div class="event-feed" role="log" aria-live="polite" aria-label={m.showcase_analytics_live_aria_feed()}>
					{#each events as event (event.id)}
						<div class="event-row">
							<span class={eventTypeIcon[event.type] ?? 'i-lucide-circle'} aria-hidden="true"></span>
							<span class="event-type">{event.type}</span>
							<code class="event-path">{event.path}</code>
							<span class="event-time">{formatTime(event.timestamp)}</span>
						</div>
					{/each}
				</div>
			{/if}
		{/snippet}
	</ChartSection>
</div>

<style>
	.live-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.connection-status {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-4);
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-muted);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-full);
		width: fit-content;
	}

	.connection-status.connected {
		color: var(--color-success);
		border-color: var(--color-success);
	}

	.connection-status.disconnected {
		color: var(--color-error);
		border-color: var(--color-error);
	}

	.connection-status.connecting {
		color: var(--color-warning);
		border-color: var(--color-warning);
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: currentColor;
	}

	.connection-status.connected .status-dot {
		animation: pulse-dot 2s ease-in-out infinite;
	}

	.connection-status.connecting .status-dot {
		background: var(--color-warning);
		animation: pulse-dot 1.5s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.live-metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 640px) {
		.live-metrics {
			grid-template-columns: 1fr;
		}
	}

	.empty-feed {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-8) 0;
		color: var(--color-muted);
		text-align: center;
	}

	.event-feed {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		max-height: 500px;
		overflow-y: auto;
	}

	.event-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		font-size: var(--text-fluid-sm);
		animation: slide-in 0.2s ease-out;
	}

	.event-row:hover {
		background: var(--color-subtle);
	}

	@keyframes slide-in {
		from { opacity: 0; transform: translateY(-8px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.event-type {
		font-weight: 500;
		color: var(--color-muted);
		min-width: 80px;
	}

	.event-path {
		flex: 1;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.event-time {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
</style>
