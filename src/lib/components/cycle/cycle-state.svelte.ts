/**
 * Cycle state machine — follows pipeline-state.svelte.ts pattern.
 * Manages 6 stages with staggered animation replay.
 */

import { CYCLE_STAGES, type CycleStageId, type CycleStageState, type CycleTrace, type CycleViewMode } from './types';

function createInitialStages(): CycleStageState[] {
	return CYCLE_STAGES.map((s) => ({
		id: s.id,
		label: s.label,
		status: 'pending',
	}));
}

export type CycleState = ReturnType<typeof createCycleState>;

export function createCycleState() {
	let stages = $state<CycleStageState[]>(createInitialStages());
	let selectedStageId = $state<CycleStageId | null>(null);
	let mode = $state<CycleViewMode>('idle');
	let pendingTimers: ReturnType<typeof setTimeout>[] = [];

	function updateStage(id: CycleStageId, patch: Partial<CycleStageState>) {
		stages = stages.map((s) => (s.id === id ? { ...s, ...patch } : s));
	}

	/** Apply a trace instantly (no animation). Used for history replay. */
	function applyTrace(trace: CycleTrace) {
		clearTimers();
		const newStages = createInitialStages();

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
	 * browserStartMs and networkDurationMs are client-measured.
	 */
	function animateTrace(
		trace: CycleTrace,
		browserStartMs?: number,
		networkDurationMs?: number,
	) {
		clearTimers();
		stages = createInitialStages();
		selectedStageId = null;
		mode = 'running';

		// Build the full span list including client-side stages
		const allSpans = buildFullSpans(trace, browserStartMs, networkDurationMs);

		// Calculate total time for animation pacing
		const maxEnd = allSpans.reduce(
			(max, s) => Math.max(max, s.startMs + (s.durationMs ?? 0)),
			0,
		);

		// Animation speed: compress real timings into a visible range
		// Real cycle might take 50-200ms, we want animation to take ~1.5-3s
		const speedFactor = maxEnd > 0 ? Math.max(1, 2000 / maxEnd) : 1;

		for (const span of allSpans) {
			const activateAt = span.startMs * speedFactor;
			const completeAt = (span.startMs + (span.durationMs ?? 10)) * speedFactor;

			// Set to active
			pendingTimers.push(
				setTimeout(() => {
					updateStage(span.stage, {
						status: 'active',
						startOffset: span.startMs,
					});
				}, activateAt),
			);

			// Set to done/error
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

		// Set final mode after all animations complete
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
		stages = createInitialStages();
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

/** Merge server trace spans with client-measured browser/network spans. */
function buildFullSpans(
	trace: CycleTrace,
	browserStartMs?: number,
	networkDurationMs?: number,
) {
	const spans = [...trace.spans];

	// Client-side browser span: instant (form submission to fetch call)
	if (browserStartMs != null) {
		const browserDuration = Math.round(Math.random() * 3 + 1); // 1-4ms simulated
		spans.unshift({
			stage: 'browser' as const,
			status: 'done' as const,
			startMs: 0,
			durationMs: browserDuration,
		});

		// Network span: measured round-trip minus server processing
		if (networkDurationMs != null) {
			const serverTotal = trace.totalDurationMs ?? 0;
			const netMs = Math.max(1, Math.round(networkDurationMs - serverTotal));
			spans.splice(1, 0, {
				stage: 'network' as const,
				status: 'done' as const,
				startMs: browserDuration,
				durationMs: netMs,
			});

			// Shift server spans to account for browser + network offset
			const offset = browserDuration + netMs;
			for (const span of spans) {
				if (
					span.stage !== 'browser' &&
					span.stage !== 'network'
				) {
					span.startMs += offset;
				}
			}
		}
	}

	return spans;
}
