/**
 * Cycle execution — pure domain logic, no SvelteKit imports.
 * Instruments each stage of a request lifecycle with real timing.
 */

import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { cycleRun } from '$lib/server/db/schema';
import { checkRowLimit } from '$lib/server/db/showcase/guards';
import {
	createTrace,
	endSpan,
	failSpan,
	finalizeTrace,
	skipRemaining,
	startSpan,
	storeTrace,
} from './trace';
import type { CycleTrace, SimulateError } from './types';

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
		skipRemaining(trace, ['domain', 'database', 'response']);
		finalizeTrace(trace);
		storeTrace(trace);
		return { success: false, trace, error: 'Validation failed' };
	}
	endSpan(serverSpan, traceStart, { action: 'validated', fields: ['label', 'description'] });

	// --- Stage: Domain (business logic) ---
	const domainSpan = startSpan(trace, 'domain', traceStart);
	if (input.simulateError === 'domain') {
		// Simulate some processing time before the error
		await delay(randomBetween(15, 40));
		failSpan(domainSpan, traceStart, 'Domain error: business rule violation');
		skipRemaining(trace, ['database', 'response']);
		finalizeTrace(trace);
		storeTrace(trace);
		return { success: false, trace, error: 'Business rule violation' };
	}
	// Real work: transform input
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
		skipRemaining(trace, ['response']);
		finalizeTrace(trace);
		storeTrace(trace);
		return { success: false, trace, error: 'Database connection timeout' };
	}
	const limitError = await checkRowLimit(cycleRun);
	if (limitError) {
		failSpan(dbSpan, traceStart, limitError);
		skipRemaining(trace, ['response']);
		finalizeTrace(trace);
		storeTrace(trace);
		return { success: false, trace, error: limitError };
	}
	const [row] = await db
		.insert(cycleRun)
		.values({
			trigger,
			inputPayload: input,
			outputPayload: processed,
			totalDurationMs: 0,
			status: 'success',
		})
		.returning();
	endSpan(dbSpan, traceStart, {
		operation: 'INSERT',
		table: 'showcase.cycle_run',
		rowId: row.id,
	});

	// --- Stage: Response (serialization) ---
	const responseSpan = startSpan(trace, 'response', traceStart);
	const result = { id: row.id, label: processed.label, timestamp: processed.timestamp };
	trace.outputPayload = result as unknown as Record<string, unknown>;
	endSpan(responseSpan, traceStart, {
		serialized: true,
		payloadKeys: Object.keys(result),
	});

	// Finalize and persist
	finalizeTrace(trace);

	// Update the row with final duration
	await db
		.update(cycleRun)
		.set({ totalDurationMs: Math.round(trace.totalDurationMs ?? 0) })
		.where(eq(cycleRun.id, row.id));

	storeTrace(trace);

	return { success: true, trace, data: result };
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}
