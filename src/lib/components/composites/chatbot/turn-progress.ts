/**
 * What the live turn is doing, read from the client's view of the assistant message —
 * so the status row can say "Searching the docs…" instead of bouncing three dots for the
 * whole pre-text gap. Pure over the streamed trace snapshot; no component state.
 */
import type { CatalogSource } from '$lib/components/composites/citation/citation-types';
import type { AiSurface } from '$lib/types/db-enums';
import type { TurnTraceSnapshot } from '$lib/types/turn-trace';

/** The three things a turn can be seen doing before its first word. */
export type TurnProgress = 'retrieving' | 'catalog' | 'generating';

/** The parts and metadata a streamed message exposes, as far as progress needs them
 * (`metadata` is untyped on the SDK's message; it is narrowed here). */
export interface StreamedMessage {
	role: string;
	parts: ReadonlyArray<{ type: string; text?: string }>;
	metadata?: unknown;
}

/**
 * The trace as the client sees it on a message: the full snapshot while the turn streams
 * (every key present), or the four-key summary a reloaded thread carries.
 */
export type TraceMetadata = Partial<Omit<TurnTraceSnapshot, 'bodies'>>;

/** `message.metadata.trace` as the client sees it, or null before the first metadata frame. */
export function traceOf(message: StreamedMessage | { metadata?: unknown } | undefined): TraceMetadata | null {
	const trace = (message?.metadata as { trace?: unknown } | undefined)?.trace;
	return trace && typeof trace === 'object' ? (trace as TraceMetadata) : null;
}

/**
 * The streamed snapshot, when that is what the message carries — a reloaded thread's
 * summary has no `messageId`, no blocks and no calls, and cannot open the inspector.
 */
export function traceSnapshotOf(trace: TraceMetadata | null): TurnTraceSnapshot | null {
	if (!trace || typeof trace.messageId !== 'string' || !trace.blocks || !trace.modelCalls || !trace.history)
		return null;
	return { ...trace, bodies: 'persisted' } as TurnTraceSnapshot;
}

/** The message's text parts, joined — the question as asked, the answer as far as it has come. */
export function answerTextOf(message: StreamedMessage | undefined): string {
	if (!message) return '';
	return message.parts
		.filter((p) => p.type === 'text' && typeof p.text === 'string')
		.map((p) => p.text)
		.join('');
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

/**
 * The stage the turn is on, from the trace snapshot: a provider attempt has started →
 * generating; the navigation rule fired and the catalog source has not settled → catalog;
 * any rule has been decided → retrieving. Null before the first metadata frame and for a
 * message that is not the assistant's.
 */
export function turnProgress(message: StreamedMessage | undefined): TurnProgress | null {
	if (message?.role !== 'assistant') return null;
	const trace = traceOf(message);
	if (!trace) return null;
	if ((trace.attempts?.length ?? 0) > 0 || (trace.modelCalls?.length ?? 0) > 0) return 'generating';
	const navigation = trace.activations?.find((a) => a.id === 'navigation')?.active;
	const catalog = trace.grounding?.find((g) => g.id === 'catalog');
	if (navigation && (!catalog || (catalog.ran && catalog.ms === undefined))) return 'catalog';
	if ((trace.activations?.length ?? 0) > 0) return 'retrieving';
	return null;
}

/**
 * True once the turn is over: its last provider attempt ended (a live snapshot lists every
 * attempt), or the trace is a reloaded summary, which only exists for a finished turn.
 */
export function turnFinished(trace: TraceMetadata): boolean {
	if (!trace.attempts) return true;
	const last = trace.attempts[trace.attempts.length - 1];
	return !!last && last.outcome !== 'started';
}

/**
 * The catalog rows the answer cited, as citation chips: every grounding item the trace
 * marked `cited` that is a catalog row. Deduped by (path, anchor) — the same doc can surface
 * as several chunks — so a keyed list never sees a duplicate key.
 */
export function citedCatalogSources(trace: TraceMetadata | null): CatalogSource[] {
	if (!trace?.grounding) return [];
	const seen = new Set<string>();
	const out: CatalogSource[] = [];
	for (const source of trace.grounding) {
		for (const item of source.items) {
			if (item.state !== 'cited' || !item.catalog || !item.path) continue;
			const key = `${item.path}\0${item.catalog.anchor ?? ''}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push({
				surface: item.catalog.surface,
				title: item.title,
				path: item.path,
				anchor: item.catalog.anchor,
				breadcrumb: item.catalog.breadcrumb,
				icon: item.catalog.icon,
				badge: item.catalog.badge,
			});
		}
	}
	return out;
}

/**
 * The unlocalized path that opens a finished turn in its surface's turn inspector
 * (`/showcases/ai/<surface>#orchestration`, ids in the query) — null while the turn is
 * still running, for a user message, or before the thread has a persisted conversation.
 * The owner-guarded routes behind the page decide what the ids may show.
 */
export function inspectTurnPath(
	surface: AiSurface,
	conversationId: string | undefined,
	message: StreamedMessage & { id: string },
): string | null {
	if (!conversationId || message.role !== 'assistant') return null;
	const trace = traceOf(message);
	if (!trace || !turnFinished(trace)) return null;
	const query = new URLSearchParams({ conversation: conversationId, turn: message.id });
	return `/showcases/ai/${surface}?${query}#orchestration`;
}
