<script lang="ts">
import { onMount } from 'svelte';
import { EmptyState } from '$lib/components/composites';
import { Switch } from '$lib/components/primitives';
import type { LiveEvent } from '$lib/types/analytics-live';
import FeedRow from './FeedRow.svelte';
import PairingDialog from './PairingDialog.svelte';

interface Props {
	initialEvents: LiveEvent[];
	pairedActive: boolean;
}

let { initialEvents, pairedActive = $bindable(false) }: Props = $props();

const POLL_INTERVAL_MS = 5000;
const VISIBLE_CAP = 50;

let events = $state<LiveEvent[]>([...initialEvents]);
let pendingWhilePaused = $state<LiveEvent[]>([]);
let paused = $state(false);
let pinnedIds = $state(new Set<number>());
let connectionMode = $state<'polling' | 'offline'>('polling');
let backoffMs = $state(POLL_INTERVAL_MS);
let activeSessions = $state(0);
let pairedSessions = $state(0);
let filterPaired = $state(false);
let pathFilter = $state('');
let dialogOpen = $state(false);
let lastAnnouncement = $state(0);
let announcementText = $state('');
let lastEventId = $derived(events.length > 0 ? events[events.length - 1].id : 0);

const filterMode = $derived(filterPaired ? 'paired' : 'all');

const visible = $derived.by(() => {
	let xs = events;
	if (pathFilter.trim()) {
		const needle = pathFilter.trim().toLowerCase();
		xs = xs.filter((e) => e.path.toLowerCase().includes(needle));
	}
	// Newest at top, but keep pinned items.
	const sorted = [...xs].sort((a, b) => b.id - a.id);
	if (sorted.length > VISIBLE_CAP) {
		const pins = sorted.filter((e) => pinnedIds.has(e.id));
		const recents = sorted.filter((e) => !pinnedIds.has(e.id)).slice(0, VISIBLE_CAP - pins.length);
		return [...recents, ...pins].sort((a, b) => b.id - a.id);
	}
	return sorted;
});

function togglePin(id: number) {
	const next = new Set(pinnedIds);
	if (next.has(id)) next.delete(id);
	else next.add(id);
	pinnedIds = next;
}

function flushPending() {
	if (pendingWhilePaused.length) {
		events = [...events, ...pendingWhilePaused];
		pendingWhilePaused = [];
	}
}

async function poll() {
	try {
		const url = `/api/admin/analytics/recent?since=${lastEventId}&filter=${filterMode}&limit=100`;
		const res = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } });
		if (!res.ok) throw new Error(String(res.status));
		const json = (await res.json()) as {
			data: {
				events: LiveEvent[];
				cursor: string;
				hasMore: boolean;
				activeSessions: number;
				pairedSessions: number;
			};
		};
		const incoming = json.data.events;
		activeSessions = json.data.activeSessions;
		pairedSessions = json.data.pairedSessions;
		connectionMode = 'polling';
		backoffMs = POLL_INTERVAL_MS;

		if (incoming.length > 0) {
			if (paused) pendingWhilePaused = [...pendingWhilePaused, ...incoming];
			else events = [...events, ...incoming];
			maybeAnnounce(incoming.length);
		}
	} catch {
		connectionMode = 'offline';
		backoffMs = Math.min(backoffMs * 2, 30_000);
	}
}

function maybeAnnounce(n: number) {
	const now = Date.now();
	if (now - lastAnnouncement < 10_000) return;
	lastAnnouncement = now;
	announcementText = `${n} new event${n === 1 ? '' : 's'}.`;
}

onMount(() => {
	let cancelled = false;
	let timer: ReturnType<typeof setTimeout>;
	function loop() {
		if (cancelled) return;
		void poll().finally(() => {
			if (!cancelled) timer = setTimeout(loop, backoffMs);
		});
	}
	loop();
	return () => {
		cancelled = true;
		clearTimeout(timer);
	};
});
</script>

<section
	class="feed-card"
	onmouseenter={() => (paused = true)}
	onmouseleave={() => {
		paused = false;
		flushPending();
	}}
>
	<header class="feed-header">
		<div class="title-row">
			<h2 class="title">Live Activity</h2>
			<div class="indicator-cluster">
				<button
					type="button"
					class="pair-button"
					onclick={() => (dialogOpen = true)}
					aria-label="Pair a device"
				>
					<span class="i-lucide-smartphone" aria-hidden="true"></span>
					<span>Pair a device</span>
				</button>

				<div class="connection" data-mode={connectionMode}>
					<span class="dot" aria-hidden="true"></span>
					<span class="conn-label">
						{#if connectionMode === 'polling'}
							Live (5s)
						{:else}
							Reconnecting…
						{/if}
					</span>
				</div>
			</div>
		</div>

		<div class="meta-row">
			<span class="meta-stat">
				<strong>{activeSessions}</strong> active
				{#if pairedSessions > 0}
					· <strong>{pairedSessions}</strong> paired
				{/if}
			</span>
			{#if pendingWhilePaused.length > 0}
				<span class="paused-badge">Paused — {pendingWhilePaused.length} new</span>
			{/if}
		</div>

		<div class="filter-row">
			<input
				type="search"
				class="path-input"
				placeholder="Filter by path…"
				bind:value={pathFilter}
				aria-label="Filter by path"
			/>
			{#if pairedActive || pairedSessions > 0}
				<label class="paired-toggle">
					<Switch bind:checked={filterPaired} />
					<span>Show paired only</span>
				</label>
			{/if}
		</div>
	</header>

	<div class="feed-body">
		{#if visible.length === 0}
			<EmptyState
				icon="i-lucide-activity"
				title="No activity in the last 5 minutes"
				description="Events will appear here as visitors browse the site."
			/>
		{:else}
			<table class="feed-table">
				<thead>
					<tr class="head-row">
						<th class="th-paired"><span class="sr-only">Paired</span></th>
						<th class="th-path">Path</th>
						<th class="th-frag">Visitor</th>
						<th class="th-device">Device</th>
						<th class="th-country">Country</th>
						<th class="th-tier">Consent</th>
						<th class="th-time">Time</th>
					</tr>
				</thead>
				<tbody>
					{#each visible as event (event.id)}
						<FeedRow {event} pinned={pinnedIds.has(event.id)} onclick={() => togglePin(event.id)} />
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{announcementText}</div>
</section>

<PairingDialog bind:open={dialogOpen} bind:pairedActive />

<style>
	.feed-card {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-2);
	}
	.feed-header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}
	.title-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}
	.title {
		margin: 0;
		font-size: var(--text-fluid-lg);
		font-weight: 600;
	}
	.indicator-cluster {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}
	.pair-button {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-surface-1);
		font: inherit;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		cursor: pointer;
	}
	.pair-button:hover {
		background: color-mix(in srgb, var(--color-primary) 8%, var(--color-surface-1));
	}
	.connection {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-success, #10b981);
	}
	.connection[data-mode='polling'] .dot {
		animation: pulse 2s ease-in-out infinite;
	}
	.connection[data-mode='offline'] .dot {
		background: var(--color-muted);
		animation: none;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
	@media (prefers-reduced-motion: reduce) {
		.connection[data-mode='polling'] .dot {
			animation: none;
		}
	}
	.meta-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	.meta-stat strong {
		color: var(--color-fg);
		font-variant-numeric: tabular-nums;
	}
	.paused-badge {
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 15%, transparent);
		color: var(--color-fg);
		font-size: var(--text-fluid-xs);
	}
	.filter-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}
	.path-input {
		flex: 1;
		min-width: 0;
		padding: var(--spacing-1) var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
		font: inherit;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
	}
	.paired-toggle {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		white-space: nowrap;
	}
	.feed-body {
		min-height: 8rem;
	}
	.feed-table {
		width: 100%;
		border-collapse: collapse;
	}
	.head-row th {
		padding: var(--spacing-1) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		text-align: left;
		white-space: nowrap;
	}
	.th-paired {
		width: 1.25rem;
	}
	.th-device,
	.th-country {
		text-align: center;
	}
	.th-time {
		text-align: right;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
