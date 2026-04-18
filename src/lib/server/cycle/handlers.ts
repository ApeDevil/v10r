/**
 * Cycle execution — pure domain logic, no SvelteKit imports.
 * Instruments each stage of a request lifecycle with real timing.
 *
 * Every cycle (success OR failure) is persisted to `cycle_run`, with the
 * full span array stored in `spans` — so the History dropdown can replay
 * the entire pipeline, not just a summary.
 */

import { db } from '$lib/server/db';
import { cycleRun } from '$lib/server/db/schema';
import { checkRowLimit } from '$lib/server/db/showcase/guards';
import { blockRemaining, createTrace, endSpan, failSpan, finalizeTrace, startSpan } from './trace';
import type { CycleSpan, CycleTrace, SimulateError } from './types';

export interface CycleInput {
	label: string;
	description?: string;
	simulateError?: SimulateError;
}

export interface CycleResult {
	success: boolean;
	trace: CycleTrace;
	data?: { id: number; label: string; timestamp: number };
	error?: string;
}

export async function executeCycle(
	input: CycleInput,
	trigger: 'form' | 'api' | 'ai',
): Promise<CycleResult> {
	const { trace, traceStart } = createTrace(trigger);
	trace.inputPayload = input as unknown as Record<string, unknown>;

	// --- Stage: Server (validation, request parsing) ---
	const serverSpan = startSpan(trace, 'server', traceStart);
	if (input.simulateError === 'validation') {
		failSpan(serverSpan, traceStart, 'Validation failed: label must be non-empty');
		blockRemaining(trace, ['domain', 'database', 'response']);
		return finalize(trace, input, trigger, null, 'Validation failed', 'server');
	}
	endSpan(serverSpan, traceStart, { action: 'validated', fields: ['label', 'description'] });

	// --- Stage: Domain (business logic) ---
	const domainSpan = startSpan(trace, 'domain', traceStart);
	if (input.simulateError === 'domain') {
		await delay(randomBetween(15, 40));
		failSpan(domainSpan, traceStart, 'Domain error: business rule violation');
		blockRemaining(trace, ['database', 'response']);
		return finalize(trace, input, trigger, null, 'Business rule violation', 'domain');
	}
	await delay(randomBetween(5, 20));
	const processed = {
		label: input.label.toUpperCase(),
		timestamp: Date.now(),
		description: input.description || null,
	};
	endSpan(domainSpan, traceStart, {
		transform: 'toUpperCase',
		outputKeys: Object.keys(processed),
	});

	// --- Stage: Database (Drizzle insert) ---
	const dbSpan = startSpan(trace, 'database', traceStart);
	if (input.simulateError === 'db') {
		await delay(randomBetween(20, 60));
		failSpan(dbSpan, traceStart, 'Database error: connection timeout');
		blockRemaining(trace, ['response']);
		return finalize(trace, input, trigger, null, 'Database connection timeout', 'database');
	}
	const limitError = await checkRowLimit(cycleRun);
	if (limitError) {
		failSpan(dbSpan, traceStart, limitError);
		blockRemaining(trace, ['response']);
		return finalize(trace, input, trigger, null, limitError, 'database');
	}

	// --- Stage: Response (serialization) ---
	const responseSpan = startSpan(trace, 'response', traceStart);
	const result = { id: 0, label: processed.label, timestamp: processed.timestamp };
	trace.outputPayload = result as unknown as Record<string, unknown>;
	endSpan(responseSpan, traceStart, { serialized: true, payloadKeys: Object.keys(result) });

	finalizeTrace(trace);

	// End the DB span (it stays "active" above so we can include response within total timing);
	// finalize the insert now that the complete trace is known.
	endSpan(dbSpan, traceStart, { operation: 'INSERT', table: 'showcase.cycle_run' });

	const [row] = await db
		.insert(cycleRun)
		.values({
			trigger,
			inputPayload: input,
			outputPayload: result,
			spans: trace.spans,
			totalDurationMs: Math.round(trace.totalDurationMs ?? 0),
			status: 'success',
		})
		.returning({ id: cycleRun.id });

	result.id = row.id;
	trace.outputPayload = result as unknown as Record<string, unknown>;

	// Reflect the assigned id in the db span detail
	const dbSpanRef = trace.spans.find((s) => s.stage === 'database');
	if (dbSpanRef) {
		dbSpanRef.detail = { ...dbSpanRef.detail, rowId: row.id };
	}

	return { success: true, trace, data: result };
}

/** Persist an errored trace so history can replay it. */
async function finalize(
	trace: CycleTrace,
	input: CycleInput,
	trigger: 'form' | 'api' | 'ai',
	output: Record<string, unknown> | null,
	error: string,
	errorStage: string,
): Promise<CycleResult> {
	finalizeTrace(trace);
	try {
		await db.insert(cycleRun).values({
			trigger,
			inputPayload: input,
			outputPayload: output,
			spans: trace.spans as unknown as CycleSpan[],
			totalDurationMs: Math.round(trace.totalDurationMs ?? 0),
			status: 'error',
			errorStage,
			errorMessage: error,
		});
	} catch {
		// If persistence itself fails, we still return the trace to the client.
	}
	return { success: false, trace, error };
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
