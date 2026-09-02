/**
 * Fixture-authoring helpers — pure factories so the recorded turns stay terse and
 * every frame stays well-typed. Fixtures are authored fiction: `demo_` ids,
 * `@example.com`, no UUIDs, no real desk content (enforced by the leak test).
 */

import { PHASE_OF, type RetrievalStepId, type RetrievalStepStatus } from '$lib/types/retrieval-trace';
import type { RecordedStepEvent } from '../replay';

/** Build one recorded pipeline step event; phase/instanceKey derived unless overridden. */
export function ev(
	step: RetrievalStepId,
	status: RetrievalStepStatus,
	opts: { start?: number; dur?: number; instanceKey?: string; error?: string } = {},
): RecordedStepEvent {
	return {
		type: 'pipeline:step',
		step,
		phase: PHASE_OF[step],
		instanceKey: opts.instanceKey ?? step,
		status,
		...(opts.start !== undefined && { startOffsetMs: opts.start }),
		...(opts.dur !== undefined && { durationMs: opts.dur }),
		...(opts.error !== undefined && { error: opts.error }),
	};
}
