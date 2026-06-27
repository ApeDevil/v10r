<!--
  Generic waterfall / Gantt timeline. Domain-agnostic: consumes `WaterfallRow[]`.
  Geometry is absolute-positioned %: left = startOffset/total, width = max(2px, dur/total).
  `totalMs` defaults to the wall-clock SPAN (max end), never a sum — so parallel rows
  that share a near-equal startOffset visibly overlap (the concurrency proof).

  a11y: each bar is a real <button> with a roving tabindex (one group tab-stop, arrows
  move between bars, Enter/Space selects); status is conveyed by icon + text (never color
  alone); a visually-hidden <table> mirrors the bars; reduced-motion removes animation.
-->
<script lang="ts">
import type { WaterfallProps, WaterfallRow, WaterfallStatus } from './types';

let { rows, totalMs, selectedId = null, onselect }: WaterfallProps = $props();

const total = $derived(
	totalMs && totalMs > 0 ? totalMs : Math.max(1, ...rows.map((r) => r.startOffsetMs + r.durationMs)),
);

/** Flattened render list: band separators interleaved with focusable bar rows. */
type RenderItem =
	| { kind: 'band'; key: string; label: string }
	| { kind: 'row'; key: string; row: WaterfallRow; barIndex: number };

const items = $derived.by<RenderItem[]>(() => {
	const out: RenderItem[] = [];
	let lastGroup: string | undefined;
	let barIndex = 0;
	for (const row of rows) {
		if (row.groupId && row.groupId !== lastGroup) {
			lastGroup = row.groupId;
			out.push({ kind: 'band', key: `band-${row.groupId}`, label: row.groupLabel ?? row.groupId });
		}
		out.push({ kind: 'row', key: row.id, row, barIndex });
		barIndex += 1;
	}
	return out;
});

const barCount = $derived(rows.length);

let focusedIndex = $state(0);
let barEls = $state<(HTMLButtonElement | undefined)[]>([]);

function barLeft(row: WaterfallRow): number {
	return (row.startOffsetMs / total) * 100;
}

function barWidthPct(row: WaterfallRow): number {
	return (row.durationMs / total) * 100;
}

const STATUS_ICON: Record<WaterfallStatus, string> = {
	pending: 'i-lucide-circle-dashed',
	active: 'i-lucide-loader-2',
	done: 'i-lucide-check',
	error: 'i-lucide-triangle-alert',
	skipped: 'i-lucide-minus',
};

function focusBar(i: number) {
	const next = Math.max(0, Math.min(barCount - 1, i));
	focusedIndex = next;
	barEls[next]?.focus();
}

function onKeydown(e: KeyboardEvent, i: number) {
	switch (e.key) {
		case 'ArrowDown':
		case 'ArrowRight':
			e.preventDefault();
			focusBar(i + 1);
			break;
		case 'ArrowUp':
		case 'ArrowLeft':
			e.preventDefault();
			focusBar(i - 1);
			break;
		case 'Home':
			e.preventDefault();
			focusBar(0);
			break;
		case 'End':
			e.preventDefault();
			focusBar(barCount - 1);
			break;
	}
}
</script>

<div class="waterfall">
	<div class="bars" role="group" aria-label="Timeline">
		{#each items as item (item.key)}
			{#if item.kind === 'band'}
				<div class="band" aria-hidden="true">{item.label}</div>
			{:else}
				{@const row = item.row}
				{@const left = barLeft(row)}
				{@const width = barWidthPct(row)}
				{@const visible = row.status === 'done' || row.status === 'error' || row.status === 'active'}
				<div class="row" class:selected={selectedId === row.id} style="--bar-color: {row.color};">
					<span class="row-label" style="padding-left: calc({row.depth ?? 0} * 0.75rem);">
						<span
							class="{STATUS_ICON[row.status]} status-icon"
							class:spin={row.status === 'active'}
							class:err={row.status === 'error'}
							aria-hidden="true"
						></span>
						<span class="label-text" class:dimmed={!visible}>{row.label}</span>
					</span>

					<div class="track">
						{#if visible}
							<button
								type="button"
								class="bar"
								class:bar-error={row.status === 'error'}
								class:bar-active={row.status === 'active'}
								bind:this={barEls[item.barIndex]}
								tabindex={item.barIndex === focusedIndex ? 0 : -1}
								style="left: {left}%; width: max(2px, {width}%);"
								aria-label="{row.label}: {row.durationMs}ms, {row.status}"
								aria-pressed={selectedId === row.id}
								onclick={() => onselect?.(row.id)}
								onfocus={() => (focusedIndex = item.barIndex)}
								onkeydown={(e) => onKeydown(e, item.barIndex)}
							></button>
							<span class="duration" style="left: calc({left}% + max(2px, {width}%) + 0.25rem);">
								{row.durationMs}ms
							</span>
						{:else}
							<span class="pending-tick" aria-hidden="true"></span>
						{/if}
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<!-- Canonical non-visual equivalent -->
	<table class="visually-hidden">
		<caption>Timeline steps</caption>
		<thead>
			<tr><th>Step</th><th>Start (ms)</th><th>Duration (ms)</th><th>Status</th></tr>
		</thead>
		<tbody>
			{#each rows as row (row.id)}
				<tr>
					<td>{row.label}</td>
					<td>{row.startOffsetMs}</td>
					<td>{row.durationMs}</td>
					<td>{row.status}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<style>
	.waterfall {
		width: 100%;
	}

	.bars {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.band {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--color-muted);
		padding: var(--spacing-2) 0 2px;
	}

	.row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-height: 22px;
		border-radius: var(--radius-sm);
		padding: 0 var(--spacing-1);
	}

	.row.selected {
		background: color-mix(in srgb, var(--bar-color) 12%, transparent);
		box-shadow: inset 2px 0 0 var(--bar-color);
	}

	.row-label {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		width: 130px;
		flex-shrink: 0;
		font-size: 11px;
		color: var(--color-fg);
	}

	.status-icon {
		flex-shrink: 0;
		width: 12px;
		height: 12px;
		color: var(--bar-color);
	}

	.status-icon.err {
		color: var(--color-error-fg);
	}

	.label-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.label-text.dimmed {
		opacity: 0.4;
	}

	.track {
		position: relative;
		flex: 1;
		height: 16px;
		min-width: 0;
	}

	.bar {
		position: absolute;
		top: 2px;
		height: 12px;
		border: none;
		padding: 0;
		border-radius: var(--radius-sm);
		background: var(--bar-color);
		opacity: 0.85;
		cursor: pointer;
		transform-origin: left;
		animation: bar-fill 0.5s ease-out both;
		transition: width 0.2s ease-out;
	}

	.bar:hover {
		opacity: 1;
	}

	.row.selected .bar {
		opacity: 1;
		box-shadow: 0 0 0 1.5px var(--bar-color);
	}

	.bar-active {
		opacity: 0.7;
	}

	.bar-error {
		background: var(--color-error-fg);
	}

	.bar:focus-visible {
		outline: none;
		box-shadow: 0 0 0 2px var(--color-bg), 0 0 0 4px var(--color-primary);
	}

	.pending-tick {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 2px;
		border-left: 2px dashed var(--color-border);
		opacity: 0.4;
	}

	.duration {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		font-size: 10px;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
		pointer-events: none;
	}

	.spin {
		animation: spin 1s linear infinite;
	}

	.visually-hidden {
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

	@keyframes bar-fill {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
			transition: none;
		}
		.spin {
			animation: none;
		}
	}
</style>
