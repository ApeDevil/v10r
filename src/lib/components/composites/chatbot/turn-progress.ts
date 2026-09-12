/**
 * What the live turn is doing, read from the client's view of the assistant message —
 * so the status row can say "Searching the docs…" instead of bouncing three dots for the
 * whole pre-text gap. Pure over the streamed shapes; no component state.
 */
import type { RetrievalStepId } from '$lib/types/retrieval-trace';

/** The three things a turn can be seen doing before its first word. */
export type TurnProgress = 'retrieving' | 'catalog' | 'generating';

/** The `message.metadata.pipeline` array as the client sees it — the orchestrator's step events. */
export type PipelineEvents = ReadonlyArray<{ type: string; step?: string; instanceKey?: string; status?: string }>;

/** The parts and metadata a streamed message exposes, as far as progress needs them
 * (`metadata` is untyped on the SDK's message; it is narrowed here). */
export interface StreamedMessage {
	role: string;
	parts: ReadonlyArray<{ type: string; text?: string }>;
	metadata?: unknown;
}

/**
 * True while the user is still waiting for the first word: the last message is theirs, or
 * the assistant's frame is open but holds no text yet. (An assistant message exists from
 * the `start` frame on, ~0.5 s in; the answer's first token is seconds later.)
 */
export function awaitingAnswer(messages: ReadonlyArray<StreamedMessage>): boolean {
	const last = messages[messages.length - 1];
	if (!last) return false;
	if (last.role === 'user') return true;
	return last.role === 'assistant' && !last.parts.some((p) => p.type === 'text' && !!p.text);
}

const PROGRESS_OF_STEP: Partial<Record<RetrievalStepId, TurnProgress>> = {
	generate: 'generating',
	catalog: 'catalog',
};

/**
 * The step the turn is on: the most recently started step whose latest event is still
 * `active` (events append; a step's `done`/`error` follows its `active`). Null before the
 * first metadata frame, once every step has settled, and for a message that is not the
 * assistant's.
 */
export function turnProgress(message: StreamedMessage | undefined): TurnProgress | null {
	if (message?.role !== 'assistant') return null;
	const pipeline = (message.metadata as { pipeline?: unknown } | undefined)?.pipeline;
	if (!Array.isArray(pipeline)) return null;
	const latest = new Map<string, { step: string; status: string }>();
	for (const event of pipeline as PipelineEvents) {
		if (event.type !== 'pipeline:step' || !event.step || !event.status) continue;
		const key = event.instanceKey ?? event.step;
		// Re-insert so map order is "most recently touched last".
		latest.delete(key);
		latest.set(key, { step: event.step, status: event.status });
	}
	const active = [...latest.values()].reverse().find((s) => s.status === 'active');
	if (!active) return null;
	return PROGRESS_OF_STEP[active.step as RetrievalStepId] ?? 'retrieving';
}
