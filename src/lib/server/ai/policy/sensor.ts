/**
 * Sensor sidecar — request-scoped observability for tool executions.
 *
 * The sensor captures what the tool observed (latency, source, governor
 * decision, raw args/result) without polluting the model's view. The
 * model sees the raw tool result unchanged; `onStepFinish` in the
 * orchestrator reads the sidecar context at persistence time and joins
 * it with the `tool_call` row.
 *
 * Wrap order: `withGovernor(withSensor(execute))`. Governor outermost —
 * blocked calls never reach the sensor (they have nothing to sense).
 *
 * Phase E will wire this into `createDeskTools`. For now the shape is
 * frozen so downstream code can target it.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

/** A single sensor trace — one per tool execution. */
export interface SensorTrace {
	toolName: string;
	toolCallId: string;
	/** Wall-clock start, milliseconds since epoch. */
	startedAt: number;
	/** Wall-clock duration in ms; set on completion. */
	durationMs?: number;
	/** Provider / backend that served the call, e.g. `neon`, `r2`, `neo4j`. */
	source?: string;
	/** Closest-match hints for partial failures (e.g. "file not found, try: …"). */
	closestMatches?: string[];
	/** Governor decision if one was rendered, else `undefined`. */
	governorDecision?: 'allowed' | 'denied';
	/** Original error if the tool failed. Strings only — no objects — to keep audit logs cheap. */
	error?: string;
}

interface SensorState {
	traces: Map<string, SensorTrace>;
}

const sensorContext = new AsyncLocalStorage<SensorState>();

/** Establish a sensor context for the duration of `fn`. Nested calls reuse the outer context. */
export function runWithSensor<T>(fn: () => T): T {
	const existing = sensorContext.getStore();
	if (existing) return fn();
	return sensorContext.run({ traces: new Map() }, fn);
}

/** Record a sensor trace keyed by tool call id. Overwrites any prior entry. */
export function recordTrace(trace: SensorTrace): void {
	const state = sensorContext.getStore();
	if (!state) return;
	state.traces.set(trace.toolCallId, trace);
}

/** Retrieve a trace by tool call id, or `undefined` if unknown. */
export function getTrace(toolCallId: string): SensorTrace | undefined {
	return sensorContext.getStore()?.traces.get(toolCallId);
}

/** Drain all traces from the current context. Used by `onStepFinish` at persistence time. */
export function drainTraces(): SensorTrace[] {
	const state = sensorContext.getStore();
	if (!state) return [];
	const traces = Array.from(state.traces.values());
	state.traces.clear();
	return traces;
}
