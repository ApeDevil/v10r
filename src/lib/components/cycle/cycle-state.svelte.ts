/**
 * Cycle state machine — reactive stage list with staggered animation replay.
 *
 * Stage list is injectable: form/api use default (6 stages), AI uses 9 stages.
 * Browser/network stages are measured client-side and merged with the server trace.
 */

import {
	AI_CYCLE_STAGES,
	CYCLE_STAGES,
	STAGE_SIDES,
	type CycleSpan,
	type CycleStageId,
	type CycleStageState,
	type CycleTrace,
	type CycleViewMode,
} from './types';

export type StageSet = 'default' | 'ai';

function stagesFor(set: StageSet): { id: CycleStageId; label: string }[] {
	return set === 'ai' ? AI_CYCLE_STAGES : CYCLE_STAGES;
}

function initialStages(set: StageSet): CycleStageState[] {
	return stagesFor(set).map((s) => ({
		id: s.id,
		label: s.label,
		status: 'pending',
		side: STAGE_SIDES[s.id],
	}));
}

export type CycleState = ReturnType<typeof createCycleState>;

export function createCycleState(set: StageSet = 'default') {
	let stages = $state<CycleStageState[]>(initialStages(set));
	let selectedStageId = $state<CycleStageId | null>(null);
	let mode = $state<CycleViewMode>('idle');
	let pendingTimers: ReturnType<typeof setTimeout>[] = [];

	function updateStage(id: CycleStageId, patch: Partial<CycleStageState>) {
		stages = stages.map((s) => (s.id === id ? { ...s, ...patch } : s));
	}

	/** Apply a trace instantly (no animation). Used for history replay. */
	function applyTrace(trace: CycleTrace) {
		clearTimers();
		const newStages = initialStages(set);

		for (const span of trace.spans) {
			const idx = newStages.findIndex((s) => s.id === span.stage);
			if (idx !== -1) {
				newStages[idx] = {
					...newStages[idx],
					status: span.status === 'active' ? 'done' : span.status,
					durationMs: span.durationMs,
					startOffset: span.startMs,
					error: span.error,
					detail: span.detail,
				};
			}
		}

		stages = newStages;
		mode = trace.spans.some((s) => s.status === 'error') ? 'error' : 'complete';
	}

	/**
	 * Animate a trace with staggered timing.
	 * `browserDurationMs` and `networkDurationMs` come from client measurement
	 * (performance.now() before submit and after response).
	 */
	function animateTrace(
		trace: CycleTrace,
		browserDurationMs?: number,
		networkDurationMs?: number,
	) {
		clearTimers();
		stages = initialStages(set);
		selectedStageId = null;
		mode = 'running';

		const allSpans = buildFullSpans(trace, browserDurationMs, networkDurationMs);

		const maxEnd = allSpans.reduce(
			(max, s) => Math.max(max, s.startMs + (s.durationMs ?? 0)),
			0,
		);

		// Compress real timings into a visible range (~1.5–3s animation).
		const speedFactor = maxEnd > 0 ? Math.max(1, 2000 / maxEnd) : 1;

		for (const span of allSpans) {
			const activateAt = span.startMs * speedFactor;
			const completeAt = (span.startMs + (span.durationMs ?? 10)) * speedFactor;

			pendingTimers.push(
				setTimeout(() => {
					updateStage(span.stage, {
						status: 'active',
						startOffset: span.startMs,
					});
				}, activateAt),
			);

			pendingTimers.push(
				setTimeout(() => {
					updateStage(span.stage, {
						status: span.status === 'active' ? 'done' : span.status,
						durationMs: span.durationMs,
						error: span.error,
						detail: span.detail,
					});
				}, completeAt),
			);
		}

		const totalAnimationMs =
			allSpans.reduce(
				(max, s) => Math.max(max, (s.startMs + (s.durationMs ?? 10)) * speedFactor),
				0,
			) + 100;

		pendingTimers.push(
			setTimeout(() => {
				mode = stages.some((s) => s.status === 'error') ? 'error' : 'complete';
			}, totalAnimationMs),
		);
	}

	function reset() {
		clearTimers();
		stages = initialStages(set);
		selectedStageId = null;
		mode = 'idle';
	}

	function selectStage(id: CycleStageId | null) {
		selectedStageId = selectedStageId === id ? null : id;
	}

	function clearTimers() {
		for (const t of pendingTimers) clearTimeout(t);
		pendingTimers = [];
	}

	return {
		get stages() {
			return stages;
		},
		get selectedStageId() {
			return selectedStageId;
		},
		get selectedStage() {
			if (!selectedStageId) return null;
			return stages.find((s) => s.id === selectedStageId) ?? null;
		},
		get mode() {
			return mode;
		},
		get isActive() {
			return stages.some((s) => s.status === 'active');
		},
		get totalDurationMs() {
			const doneStages = stages.filter((s) => s.durationMs != null);
			if (doneStages.length === 0) return 0;
			return doneStages.reduce(
				(max, s) => Math.max(max, (s.startOffset ?? 0) + (s.durationMs ?? 0)),
				0,
			);
		},
		applyTrace,
		animateTrace,
		reset,
		selectStage,
	};
}

/**
 * Merge server trace spans with client-measured browser/network spans.
 * Never mutates the input trace — returns a fresh span array.
 */
function buildFullSpans(
	trace: CycleTrace,
	browserDurationMs?: number,
	networkDurationMs?: number,
): CycleSpan[] {
	const serverSpans = trace.spans.map((s) => ({ ...s }));

	// No client timing available — return server spans as-is.
	if (browserDurationMs == null) return serverSpans;

	const browserMs = Math.max(0.5, Math.round(browserDurationMs * 100) / 100);
	const prefixed: CycleSpan[] = [
		{
			stage: 'browser',
			status: 'done',
			startMs: 0,
			durationMs: browserMs,
		},
	];

	// Network span: measured round-trip minus server processing.
	if (networkDurationMs != null) {
		const serverTotal = trace.totalDurationMs ?? 0;
		const netMs = Math.max(1, Math.round(networkDurationMs - serverTotal - browserMs));
		prefixed.push({
			stage: 'network',
			status: 'done',
			startMs: browserMs,
			durationMs: netMs,
		});

		const offset = browserMs + netMs;
		for (const span of serverSpans) {
			span.startMs += offset;
		}
	} else {
		for (const span of serverSpans) {
			span.startMs += browserMs;
		}
	}

	return [...prefixed, ...serverSpans];
}
