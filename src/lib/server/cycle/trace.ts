/**
 * Explicit trace instrumentation — passed as argument, not ambient.
 * The showcase teaches request lifecycle by making data flow visible in code.
 */

import type { CycleSpan, CycleStageId, CycleTrace } from './types';

/** Create a new trace for a cycle execution. */
export function createTrace(trigger: 'form' | 'api' | 'ai'): {
	trace: CycleTrace;
	traceStart: number;
} {
	return {
		trace: {
			id: crypto.randomUUID(),
			trigger,
			spans: [],
		},
		traceStart: performance.now(),
	};
}

/** Begin measuring a stage. Returns a span reference to pass to endSpan/failSpan. */
export function startSpan(trace: CycleTrace, stage: CycleStageId, traceStart: number): CycleSpan {
	const span: CycleSpan = {
		stage,
		status: 'active',
		startMs: round(performance.now() - traceStart),
	};
	trace.spans.push(span);
	return span;
}

/** Mark a span as successfully completed. */
export function endSpan(
	span: CycleSpan,
	traceStart: number,
	detail?: Record<string, unknown>,
): void {
	span.durationMs = round(performance.now() - traceStart - span.startMs);
	span.status = 'done';
	if (detail) span.detail = detail;
}

/** Mark a span as failed. */
export function failSpan(span: CycleSpan, traceStart: number, error: string): void {
	span.durationMs = round(performance.now() - traceStart - span.startMs);
	span.status = 'error';
	span.error = error;
}

/** Mark remaining stages as skipped after an error. */
export function skipRemaining(trace: CycleTrace, stages: CycleStageId[]): void {
	const existingStages = new Set(trace.spans.map((s) => s.stage));
	for (const stage of stages) {
		if (!existingStages.has(stage)) {
			trace.spans.push({ stage, status: 'skipped', startMs: 0 });
		}
	}
}

/** Compute totalDurationMs from completed spans. */
export function finalizeTrace(trace: CycleTrace): void {
	const doneSpans = trace.spans.filter((s) => s.durationMs != null);
	if (doneSpans.length > 0) {
		const lastSpan = doneSpans.reduce((a, b) =>
			a.startMs + (a.durationMs ?? 0) > b.startMs + (b.durationMs ?? 0) ? a : b,
		);
		trace.totalDurationMs = round(lastSpan.startMs + (lastSpan.durationMs ?? 0));
	}
}

/** In-memory store for cross-request trace lookup (AI path). */
const traceStore = new Map<string, { trace: CycleTrace; expiresAt: number }>();
const TTL_MS = 10 * 60 * 1000;

export function storeTrace(trace: CycleTrace): void {
	traceStore.set(trace.id, { trace, expiresAt: Date.now() + TTL_MS });
}

export function getStoredTrace(id: string): CycleTrace | null {
	const entry = traceStore.get(id);
	if (!entry) return null;
	if (entry.expiresAt < Date.now()) {
		traceStore.delete(id);
		return null;
	}
	return entry.trace;
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}
