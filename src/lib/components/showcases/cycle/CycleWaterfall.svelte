<!--
  Cycle-showcase timing bars — now a thin adapter over the generic viz `Waterfall`.
  Maps CycleStageState → WaterfallRow (color from STAGE_COLORS); the generic primitive
  owns the absolute %-geometry, a11y, and reduced-motion handling.
-->
<script lang="ts">
import type { WaterfallRow, WaterfallStatus } from '$lib/components/viz';
import { Waterfall } from '$lib/components/viz';
import type { CycleStageId, CycleStageState, CycleStageStatus } from '$lib/showcases/cycle/types';
import { STAGE_COLORS } from '$lib/showcases/cycle/types';

interface Props {
	stages: CycleStageState[];
	totalDurationMs: number;
	selectedStageId?: CycleStageId | null;
	onselect: (id: CycleStageId) => void;
}

let { stages, totalDurationMs, selectedStageId = null, onselect }: Props = $props();

/** `blocked` has no generic equivalent — render it like a not-yet-run (dashed tick). */
function mapStatus(status: CycleStageStatus): WaterfallStatus {
	return status === 'blocked' ? 'pending' : status;
}

const rows = $derived<WaterfallRow[]>(
	stages.map((stage) => ({
		id: stage.id,
		label: stage.label,
		startOffsetMs: stage.startOffset ?? 0,
		durationMs: stage.durationMs ?? 0,
		status: mapStatus(stage.status),
		color: STAGE_COLORS[stage.id],
	})),
);
</script>

<div class="cycle-waterfall">
	<Waterfall
		{rows}
		totalMs={totalDurationMs}
		selectedId={selectedStageId}
		onselect={(id) => onselect(id as CycleStageId)}
	/>
	{#if totalDurationMs > 0}
		<div class="total">Total: {Math.round(totalDurationMs * 100) / 100}ms</div>
	{/if}
</div>

<style>
	.cycle-waterfall {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.total {
		align-self: flex-end;
		font-size: 11px;
		font-weight: 500;
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
