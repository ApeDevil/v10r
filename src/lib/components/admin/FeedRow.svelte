<script lang="ts">
import { Tag } from '$lib/components/primitives';
import type { LiveEvent } from '$lib/types/analytics-live';

interface Props {
	event: LiveEvent;
	pinned: boolean;
	onclick: () => void;
}

let { event, pinned, onclick }: Props = $props();

const deviceIcon = $derived.by(() => {
	if (event.device === 'mobile') return 'i-lucide-smartphone';
	if (event.device === 'tablet') return 'i-lucide-tablet';
	if (event.device === 'desktop') return 'i-lucide-monitor';
	return 'i-lucide-circle-help';
});

const tierVariant = $derived<'success' | 'secondary' | 'default'>(
	event.consentTier === 'full' ? 'success' : event.consentTier === 'analytics' ? 'default' : 'secondary',
);

const relativeTime = $derived.by(() => {
	const ms = Date.now() - new Date(event.ts).getTime();
	if (ms < 1000) return 'now';
	if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
	if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m`;
	return `${Math.floor(ms / 3_600_000)}h`;
});

function onkeydown(e: KeyboardEvent) {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		onclick();
	}
}
</script>

<tr
	class="row"
	class:pinned
	class:paired={event.isPaired}
	tabindex="0"
	{onclick}
	{onkeydown}
	title={event.path}
>
	<td class="col-paired" aria-hidden="true">
		{#if event.isPaired}
			<span class="paired-dot" title="Paired device"></span>
		{/if}
	</td>
	<td class="col-path"><code>{event.path}</code></td>
	<td class="col-frag">
		{#if event.consentTier === 'necessary'}
			<span class="muted">—</span>
		{:else}
			<code class="frag">{event.visitorFragment.slice(2, 10)}</code>
		{/if}
	</td>
	<td class="col-device">
		{#if event.device}
			<span class="{deviceIcon} device-icon" aria-hidden="true"></span>
			<span class="sr-only">{event.device}</span>
		{:else}
			<span class="muted">—</span>
		{/if}
	</td>
	<td class="col-country">
		{#if event.country}
			<span class="country">{event.country}</span>
		{:else}
			<span class="muted">—</span>
		{/if}
	</td>
	<td class="col-tier">
		<Tag variant={tierVariant} label={event.consentTier} />
	</td>
	<td class="col-time"><time datetime={event.ts}>{relativeTime}</time></td>
</tr>

<style>
	.row {
		cursor: pointer;
		border-bottom: 1px solid var(--color-border);
	}
	.row:hover {
		background: color-mix(in srgb, var(--color-muted) 6%, transparent);
	}
	.row:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: -2px;
	}
	.row.pinned {
		border-left: 3px solid var(--color-primary);
	}
	.row.paired {
		background: color-mix(in srgb, var(--color-warning, #f59e0b) 6%, transparent);
	}
	.row td {
		padding: var(--spacing-2) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		vertical-align: middle;
		white-space: nowrap;
	}
	.col-paired {
		width: 1.25rem;
	}
	.paired-dot {
		display: inline-block;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--color-warning, #f59e0b);
	}
	.col-path {
		max-width: 18rem;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.col-path code {
		font-family: ui-monospace, monospace;
	}
	.col-frag .frag {
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
	}
	.col-device {
		text-align: center;
	}
	.device-icon {
		font-size: 1rem;
		color: var(--color-muted);
	}
	.col-country {
		font-family: ui-monospace, monospace;
		color: var(--color-muted);
		text-align: center;
	}
	.col-time {
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
		text-align: right;
	}
	.muted {
		color: var(--color-muted);
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
