<!--
  Horizontal timing bars — CSS absolute-positioned, Clockwork-inspired.
  Each bar shows duration proportional to total cycle time.
-->
<script lang="ts">
	import type { CycleStageId, CycleStageState } from './types';
	import { STAGE_COLORS } from './types';

	interface Props {
		stages: CycleStageState[];
		totalDurationMs: number;
		onselect: (id: CycleStageId) => void;
	}

	let { stages, totalDurationMs, onselect }: Props = $props();

	const ROW_H = 24;
	const BAR_H = 16;
	const LABEL_W = 80;

	function barLeft(stage: CycleStageState): string {
		if (!totalDurationMs || stage.startOffset == null) return '0%';
		return `${(stage.startOffset / totalDurationMs) * 100}%`;
	}

	function barWidth(stage: CycleStageState): string {
		if (!totalDurationMs || !stage.durationMs) return '0%';
		return `${Math.max(1, (stage.durationMs / totalDurationMs) * 100)}%`;
	}

	function isVisible(stage: CycleStageState): boolean {
		return stage.status === 'done' || stage.status === 'error';
	}
</script>

<div class="waterfall" style="height: {stages.length * ROW_H + 8}px;">
	{#each stages as stage, i}
		{@const color = STAGE_COLORS[stage.id]}
		{@const clickable = isVisible(stage)}
		<div class="row" style="top: {i * ROW_H}px;">
			<!-- Label -->
			<span class="label" class:label-dimmed={!isVisible(stage)}>
				{stage.label}
			</span>

			<!-- Bar container -->
			<div class="bar-track">
				{#if stage.status === 'skipped'}
					<!-- Ghost bar for skipped stages -->
					<div class="bar-ghost"></div>
				{:else if isVisible(stage)}
					<!-- Actual timing bar -->
					<button
						type="button"
						class="bar"
						class:bar-error={stage.status === 'error'}
						style="
							left: {barLeft(stage)};
							width: {barWidth(stage)};
							background: {stage.status === 'error' ? 'var(--color-error-fg)' : color};
							animation-delay: {(stage.startOffset ?? 0) * 2}ms;
						"
						onclick={() => onselect(stage.id)}
						aria-label="{stage.label}: {stage.durationMs}ms"
					></button>
					<!-- Duration label -->
					<span
						class="duration"
						style="left: calc({barLeft(stage)} + {barWidth(stage)} + 4px);"
					>
						{stage.durationMs}ms
					</span>
				{/if}
			</div>
		</div>
	{/each}

	<!-- Total duration -->
	{#if totalDurationMs > 0}
		<div class="total" style="top: {stages.length * ROW_H}px;">
			Total: {Math.round(totalDurationMs * 100) / 100}ms
		</div>
	{/if}
</div>

<style>
	.waterfall {
		position: relative;
		width: 100%;
		min-height: 48px;
	}

	.row {
		position: absolute;
		left: 0;
		right: 0;
		height: 24px;
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.label {
		width: 80px;
		flex-shrink: 0;
		text-align: right;
		font-size: 11px;
		color: var(--color-fg);
	}

	.label-dimmed {
		opacity: 0.35;
	}

	.bar-track {
		position: relative;
		flex: 1;
		height: 16px;
	}

	.bar {
		position: absolute;
		top: 0;
		height: 100%;
		border-radius: var(--radius-sm);
		opacity: 0.75;
		cursor: pointer;
		border: none;
		padding: 0;
		animation: bar-fill 0.6s ease-out both;
	}

	.bar:hover {
		opacity: 1;
	}

	.bar-error {
		opacity: 0.85;
	}

	.bar-ghost {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		border-left: 2px dashed var(--color-border);
		opacity: 0.15;
		border-radius: var(--radius-sm);
	}

	.duration {
		position: absolute;
		top: 2px;
		font-size: 10px;
		color: var(--color-muted);
		white-space: nowrap;
		pointer-events: none;
	}

	.total {
		position: absolute;
		right: 0;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-muted);
	}

	@keyframes bar-fill {
		from {
			transform: scaleX(0);
			transform-origin: left;
		}
		to {
			transform: scaleX(1);
			transform-origin: left;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.bar {
			animation: none;
		}
	}
</style>
