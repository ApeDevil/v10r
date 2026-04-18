/**
 * AI cycle execution — mirrors executeCycle but instruments the RAG + LLM pipeline.
 *
 * Stages: server → embed → retrieve → rank → context → generate → response.
 * Attempts real retrieve() + streamText(); falls back to a simulated pipeline
 * when infrastructure isn't configured (no provider, no ingested data).
 * Every run is persisted to cycle_run for history replay, same as executeCycle.
 */

import { streamText } from 'ai';
import { getActiveProvider, getActiveProviderInfo } from '$lib/server/ai';
import { db } from '$lib/server/db';
import { cycleRun } from '$lib/server/db/schema';
import { checkRowLimit } from '$lib/server/db/showcase/guards';
import { formatContextForPrompt, retrieve } from '$lib/server/rawrag';
import type { PipelineChunksEvent, PipelinePromptEvent, PipelineStepEvent } from '$lib/types/pipeline';
import { blockRemaining, createTrace, endSpan, failSpan, finalizeTrace, startSpan } from './trace';
import type { CycleSpan, CycleStageId, CycleTrace, SimulateAiError } from './types';

export interface AiCycleInput {
	query: string;
	simulateError?: SimulateAiError;
}

export interface AiCycleResult {
	success: boolean;
	trace: CycleTrace;
	answer?: string;
	error?: string;
}

const DEFAULT_QUERY_FALLBACK = 'What is Velociraptor?';

export async function executeAiCycle(input: AiCycleInput, userId: string): Promise<AiCycleResult> {
	const query = input.query?.trim() || DEFAULT_QUERY_FALLBACK;
	const { trace, traceStart } = createTrace('ai');
	trace.inputPayload = { query };

	// --- Server: auth + parse ---
	const serverSpan = startSpan(trace, 'server', traceStart);
	await delay(2);
	endSpan(serverSpan, traceStart, { action: 'auth + parse', userId });

	// Emit adapter: routes retrieve() pipeline events into our trace spans.
	// tier-1/2/3 are collapsed into a single `retrieve` span.
	const spansByStage = new Map<CycleStageId, CycleSpan>();
	const tierStartTimes: number[] = [];
	let tierErrors = 0;
	let retrieveStartedAt: number | null = null;
	const stageMap: Record<string, CycleStageId | null> = {
		embed: 'embed',
		rank: 'rank',
		context: 'context',
		'tier-1': 'retrieve',
		'tier-2': 'retrieve',
		'tier-3': 'retrieve',
	};

	const emit = (event: PipelineStepEvent | PipelineChunksEvent | PipelinePromptEvent) => {
		if (event.type !== 'pipeline:step') return;
		const stage = stageMap[event.step];
		if (!stage) return;

		if (event.status === 'active') {
			if (stage === 'retrieve') {
				tierStartTimes.push(performance.now());
				if (!spansByStage.has('retrieve')) {
					retrieveStartedAt = performance.now();
					spansByStage.set('retrieve', startSpan(trace, 'retrieve', traceStart));
				}
			} else if (!spansByStage.has(stage)) {
				spansByStage.set(stage, startSpan(trace, stage, traceStart));
			}
		} else if (event.status === 'done') {
			const sp = spansByStage.get(stage);
			if (!sp) return;
			if (stage === 'retrieve') {
				// Wait until all tier events have reported before finalizing.
				sp.detail = {
					...sp.detail,
					...(event.detail ?? {}),
					tiersCompleted: ((sp.detail as Record<string, number>)?.tiersCompleted ?? 0) + 1,
				};
				if (retrieveStartedAt != null) {
					sp.durationMs = round(performance.now() - retrieveStartedAt);
					sp.status = 'done';
				}
			} else {
				endSpan(sp, traceStart, event.detail as Record<string, unknown> | undefined);
			}
		} else if (event.status === 'error') {
			const sp = spansByStage.get(stage);
			if (!sp) return;
			if (stage === 'retrieve') {
				tierErrors++;
			} else {
				failSpan(sp, traceStart, event.error ?? 'pipeline error');
			}
		}
	};

	// --- Retrieval pipeline (embed + retrieve + rank + context) ---
	let retrievalOk = false;
	let retrievalResult: Awaited<ReturnType<typeof retrieve>> | null = null;
	if (input.simulateError === 'embed' || input.simulateError === 'retrieve') {
		// Inject a failure at the requested stage
		await simulatePipelineUntil(trace, traceStart, input.simulateError);
		const stage: CycleStageId = input.simulateError;
		return finalizeFailure(trace, traceStart, userId, query, stage, `${stage} failed (simulated)`);
	}

	try {
		retrievalResult = await retrieve(query, { userId, tiers: [1], maxChunks: 3 }, emit);
		retrievalOk = true;
	} catch (err) {
		// Real pipeline unavailable — fall back to a simulated trace so the showcase always works.
		await simulatePipelineGaps(trace, traceStart, spansByStage);
		const reason = err instanceof Error ? err.message : 'retrieval unavailable';
		const embedSpan = spansByStage.get('embed');
		if (embedSpan && embedSpan.status === 'active') {
			embedSpan.detail = { ...embedSpan.detail, note: `simulated — ${reason}` };
			endSpan(embedSpan, traceStart, embedSpan.detail);
		}
	}

	// Ensure all retrieval-stage spans closed (if retrieve() returned before emitting final events)
	for (const id of ['embed', 'retrieve', 'rank', 'context'] as const) {
		const sp = spansByStage.get(id);
		if (!sp) {
			const synthetic = startSpan(trace, id, traceStart);
			await delay(simulatedDuration(id));
			endSpan(synthetic, traceStart, { note: 'simulated' });
			spansByStage.set(id, synthetic);
		} else if (sp.status === 'active') {
			endSpan(sp, traceStart, sp.detail as Record<string, unknown> | undefined);
		}
	}

	// --- Generate (LLM stream) ---
	const genSpan = startSpan(trace, 'generate', traceStart);
	if (input.simulateError === 'generate') {
		await delay(120);
		failSpan(genSpan, traceStart, 'LLM timeout (simulated)');
		blockRemaining(trace, ['response']);
		return finalizeFailure(trace, traceStart, userId, query, 'generate', 'LLM timeout (simulated)');
	}

	const provider = getActiveProvider(userId);
	const providerInfo = getActiveProviderInfo(userId);
	let answer = '';
	let generateDetail: Record<string, unknown> = { simulated: true, reason: 'no provider configured' };

	const model = provider?.getInstance() ?? null;
	if (model && retrievalOk) {
		try {
			const contextBlock = retrievalResult ? formatContextForPrompt(retrievalResult) : '';
			const system = contextBlock
				? `Answer the question using the context below. Be concise (2-3 sentences).\n\n<context>\n${contextBlock}\n</context>`
				: 'Answer the question concisely in 2-3 sentences.';
			const result = streamText({
				model,
				system,
				prompt: query,
				maxOutputTokens: 180,
				maxRetries: 0,
				abortSignal: AbortSignal.timeout(15_000),
			});
			// Drain without streaming back — the showcase animates from the final trace.
			result.consumeStream();
			answer = await result.text;
			const totalUsage = await result.totalUsage;
			generateDetail = {
				model: providerInfo?.id,
				inputTokens: totalUsage?.inputTokens,
				outputTokens: totalUsage?.outputTokens,
				contextChunks: retrievalResult?.chunks.length ?? 0,
			};
		} catch (err) {
			// LLM call failed — still complete the showcase with a simulated generate span.
			await delay(600);
			answer = `(simulated — ${err instanceof Error ? err.message : 'LLM unavailable'})`;
			generateDetail = { simulated: true, reason: err instanceof Error ? err.message : 'LLM error' };
		}
	} else {
		await delay(randomBetween(700, 1200));
		answer = `(simulated answer to "${query}" — configure an AI provider for real output)`;
	}

	endSpan(genSpan, traceStart, generateDetail);

	// --- Response ---
	const respSpan = startSpan(trace, 'response', traceStart);
	await delay(2);
	const output = { answer, tokens: (generateDetail as { outputTokens?: number }).outputTokens ?? answer.length / 4 };
	trace.outputPayload = output as Record<string, unknown>;
	endSpan(respSpan, traceStart, { serialized: true, bytes: JSON.stringify(output).length });

	finalizeTrace(trace);

	// Persist
	try {
		const limitError = await checkRowLimit(cycleRun);
		if (!limitError) {
			await db.insert(cycleRun).values({
				trigger: 'ai',
				inputPayload: { query },
				outputPayload: output,
				spans: trace.spans as unknown as CycleSpan[],
				totalDurationMs: Math.round(trace.totalDurationMs ?? 0),
				status: 'success',
			});
		}
	} catch {
		// Persistence failure is non-blocking for AI cycles.
	}

	// Mark tier errors (if any) as a warning in retrieve span, but don't fail the whole cycle.
	if (tierErrors > 0) {
		const rsp = spansByStage.get('retrieve');
		if (rsp) rsp.detail = { ...rsp.detail, tierErrors };
	}

	return { success: true, trace, answer };
}

async function simulatePipelineGaps(trace: CycleTrace, traceStart: number, existing: Map<CycleStageId, CycleSpan>) {
	// Create spans for any retrieval stages that didn't get emitted.
	const ids: CycleStageId[] = ['embed', 'retrieve', 'rank', 'context'];
	for (const id of ids) {
		if (!existing.has(id)) {
			const sp = startSpan(trace, id, traceStart);
			await delay(simulatedDuration(id));
			endSpan(sp, traceStart, { note: 'simulated' });
			existing.set(id, sp);
		}
	}
}

async function simulatePipelineUntil(trace: CycleTrace, traceStart: number, failAt: 'embed' | 'retrieve') {
	const order: CycleStageId[] = ['embed', 'retrieve'];
	for (const id of order) {
		const sp = startSpan(trace, id, traceStart);
		if (id === failAt) {
			await delay(simulatedDuration(id) / 2);
			failSpan(sp, traceStart, `${id} failed (simulated)`);
			blockRemaining(trace, ['rank', 'context', 'generate', 'response']);
			return;
		}
		await delay(simulatedDuration(id));
		endSpan(sp, traceStart, { note: 'simulated' });
	}
}

async function finalizeFailure(
	trace: CycleTrace,
	_traceStart: number,
	_userId: string,
	query: string,
	errorStage: string,
	error: string,
): Promise<AiCycleResult> {
	finalizeTrace(trace);
	try {
		await db.insert(cycleRun).values({
			trigger: 'ai',
			inputPayload: { query },
			outputPayload: null,
			spans: trace.spans as unknown as CycleSpan[],
			totalDurationMs: Math.round(trace.totalDurationMs ?? 0),
			status: 'error',
			errorStage,
			errorMessage: error,
		});
	} catch {
		// Persistence failure is non-blocking.
	}
	return { success: false, trace, error };
}

function simulatedDuration(stage: CycleStageId): number {
	switch (stage) {
		case 'embed':
			return randomBetween(60, 140);
		case 'retrieve':
			return randomBetween(40, 90);
		case 'rank':
			return randomBetween(5, 15);
		case 'context':
			return randomBetween(2, 8);
		case 'generate':
			return randomBetween(700, 1400);
		default:
			return 5;
	}
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomBetween(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function round(n: number): number {
	return Math.round(n * 100) / 100;
}
