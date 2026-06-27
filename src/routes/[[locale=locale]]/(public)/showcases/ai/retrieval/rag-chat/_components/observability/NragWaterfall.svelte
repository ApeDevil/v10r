<!--
  Timing view (post-hoc) — maps the unified trace's steps onto the generic viz Waterfall.
  Bands group by phase; bars position by server-stamped startOffsetMs so parallel retrieve
  lanes visibly overlap. Drill steps indent under generate (depth=1).
-->
<script lang="ts">
import type { WaterfallRow } from '$lib/components/viz';
import { Waterfall } from '$lib/components/viz';
import type { NragPhase } from '$lib/types/pipeline';
import type { NragTraceState } from '../trace/nrag-trace.svelte';
import { PHASE_COLORS } from '../trace/step-colors';

interface Props {
	trace: NragTraceState;
}

let { trace }: Props = $props();

const PHASE_ORDER: NragPhase[] = ['embed', 'retrieve', 'fuse', 'assemble', 'generate', 'verify'];
const PHASE_LABEL: Record<NragPhase, string> = {
	embed: 'Embed',
	retrieve: 'Retrieve',
	fuse: 'Fuse',
	assemble: 'Assemble',
	generate: 'Generate',
	verify: 'Verify',
};

const rows = $derived.by<WaterfallRow[]>(() => {
	const sorted = [...trace.steps].sort((a, b) => {
		const pa = PHASE_ORDER.indexOf(a.phase);
		const pb = PHASE_ORDER.indexOf(b.phase);
		if (pa !== pb) return pa - pb;
		return (a.startOffsetMs ?? Number.POSITIVE_INFINITY) - (b.startOffsetMs ?? Number.POSITIVE_INFINITY);
	});
	return sorted.map((s) => ({
		id: s.instanceKey,
		label: s.label,
		startOffsetMs: s.startOffsetMs ?? 0,
		durationMs: s.durationMs ?? 0,
		status: s.status,
		color: PHASE_COLORS[s.phase],
		laneId: s.lane,
		groupId: s.phase,
		groupLabel: PHASE_LABEL[s.phase],
		depth: s.id === 'rawrag:drill' ? 1 : 0,
	}));
});
</script>

<Waterfall
	{rows}
	totalMs={trace.totalDurationMs}
	selectedId={trace.selectedStepId}
	onselect={(id) => trace.selectStep(id)}
/>
