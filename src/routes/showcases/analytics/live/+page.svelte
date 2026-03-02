<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Alert } from '$lib/components/composites';
	import { Sparkline } from '$lib/components/viz/chart/sparkline';
	import MetricCard from '../_components/MetricCard.svelte';
	import ChartSection from '../_components/ChartSection.svelte';

	interface LiveEvent {
		id: number;
		type: string;
		path: string;
		timestamp: string;
		sessionId?: string;
	}

	let events = $state<LiveEvent[]>([]);
	let activeSessions = $state(0);
	let eventsPerMinute = $state<number[]>([]);
	let connectionStatus = $state<'connecting' | 'connected' | 'disconnected'>('connecting');
	let eventSource: EventSource | undefined;

	// Rolling count of events per minute (last 10 minutes)
	let minuteBuckets = $state<number[]>(new Array(10).fill(0));

	function addEvent(event: LiveEvent) {
		events = [event, ...events].slice(0, 50);
		minuteBuckets[minuteBuckets.length - 1]++;
		eventsPerMinute = [...minuteBuckets];
	}

	onMount(() => {
		eventSource = new EventSource('/api/analytics/stream');

		eventSource.onopen = () => {
			connectionStatus = 'connected';
		};

		eventSource.onmessage = (e) => {
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

		eventSource.onerror = () => {
			connectionStatus = 'disconnected';
		};

		// Rotate minute buckets every 60s
		const bucketTimer = setInterval(() => {
			minuteBuckets = [...minuteBuckets.slice(1), 0];
		}, 60000);

		return () => {
			clearInterval(bucketTimer);
		};
	});

	onDestroy(() => {
		eventSource?.close();
	});

	function formatTime(ts: string): string {
		return new Date(ts).toLocaleTimeString('en-US', {
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
	<div class="connection-status" class:connected={connectionStatus === 'connected'} class:disconnected={connectionStatus === 'disconnected'}>
		<span class="status-dot"></span>
		{#if connectionStatus === 'connecting'}
			Connecting to event stream...
		{:else if connectionStatus === 'connected'}
			Live — receiving events
		{:else}
			Disconnected — events may be stale
		{/if}
	</div>

	<!-- Live metrics -->
	<div class="live-metrics">
		<MetricCard
			title="Active Sessions"
			value={activeSessions}
		/>
		<MetricCard
			title="Events (last 10m)"
			value={eventsPerMinute.reduce((a, b) => a + b, 0)}
			sparklineData={eventsPerMinute}
		/>
		<MetricCard
			title="Events in Feed"
			value={events.length}
		/>
	</div>

	<!-- Live event feed -->
	<ChartSection
		title="Live Event Feed"
		description="Real-time analytics events as they occur (simulated for demo)"
		details="Events are streamed via Server-Sent Events (SSE) from /api/analytics/stream. In production, this would show actual pageviews and interactions. For the demo, synthetic events are generated at random intervals."
	>
		{#snippet chart()}
			{#if events.length === 0}
				<div class="empty-feed">
					<span class="i-lucide-radio text-icon-lg" aria-hidden="true"></span>
					<p>Waiting for events...</p>
					<p class="text-fluid-xs">Simulated events will appear here shortly.</p>
				</div>
			{:else}
				<div class="event-feed" role="log" aria-live="polite" aria-label="Live analytics events">
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

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: var(--radius-full);
		background: currentColor;
	}

	.connection-status.connected .status-dot {
		animation: pulse-dot 2s ease-in-out infinite;
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
