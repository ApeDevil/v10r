/**
 * Tool-result compaction — works around AI SDK #9631.
 *
 * AI SDK v6's `prepareStep` mutation to `messages` is silently dropped on
 * subsequent iterations ("by design" per maintainer). Trying to compact
 * oversized tool results inside `prepareStep` looks like it's working but
 * the SDK re-reads the original `response.messages` accumulator each step.
 *
 * Correct pattern: compact tool results at **execute time** by wrapping
 * each tool's `execute` return value. Oversized results are stored in a
 * request-scoped `refs` map and replaced in the model's view with a
 * `{ ref, summary, truncated, originalBytes }` projection. The model
 * can pull the full value back via the `resolve_ref` tool when needed.
 *
 * Storage lives in an `AsyncLocalStorage` context established by the
 * orchestrator around each request, so concurrent requests never
 * collide on refs.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ModelMessage } from 'ai';

export interface CompactionBudget {
	/** Maximum serialized length (chars) a tool result may reach before compaction kicks in. */
	maxChars: number;
	/** Length (chars) of the summary preview embedded in the projected form. */
	summaryChars: number;
}

export const DEFAULT_BUDGET: CompactionBudget = {
	maxChars: 2000,
	summaryChars: 400,
};

/** Per-request compaction state. */
interface CompactionState {
	budget: CompactionBudget;
	refs: Map<string, unknown>;
	/** Monotonic ref counter so refs are readable (`tr_0`, `tr_1`, …). */
	counter: number;
}

const compactionContext = new AsyncLocalStorage<CompactionState>();

/** Establish a compaction context for the duration of `fn`. Nested calls reuse the outer context. */
export function runWithCompaction<T>(budget: CompactionBudget, fn: () => T): T {
	const existing = compactionContext.getStore();
	if (existing) return fn();
	const state: CompactionState = { budget, refs: new Map(), counter: 0 };
	return compactionContext.run(state, fn);
}

/** Retrieve the full value behind a ref, or `undefined` if the ref is unknown. */
export function resolveRef(ref: string): unknown {
	const state = compactionContext.getStore();
	if (!state) return undefined;
	return state.refs.get(ref);
}

/** Shape emitted in place of an oversized tool result. */
export interface CompactedResult {
	ref: string;
	summary: string;
	truncated: true;
	originalBytes: number;
	/**
	 * Hint for the model: use the `resolve_ref` tool with this ref to pull the full value
	 * if you need more detail than the summary provides.
	 */
	hint: string;
}

/** Serialize a value to a stable length estimate. */
function serializedLength(value: unknown): number {
	try {
		return JSON.stringify(value)?.length ?? 0;
	} catch {
		return 0;
	}
}

/** Generate a human-readable preview of a value, capped at `maxChars`. */
export function projectSummary(value: unknown, maxChars: number): string {
	let text: string;
	try {
		text = typeof value === 'string' ? value : JSON.stringify(value);
	} catch {
		text = '[unserializable]';
	}
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}…`;
}

/**
 * Compact a single tool-result value. Returns the projected form if the value
 * exceeds the budget, otherwise returns the value unchanged. Does nothing if
 * no compaction context is active.
 */
export function compactToolResult(toolName: string, value: unknown): unknown {
	const state = compactionContext.getStore();
	if (!state) return value;
	const length = serializedLength(value);
	if (length <= state.budget.maxChars) return value;

	const ref = `tr_${toolName}_${state.counter++}`;
	state.refs.set(ref, value);
	const projected: CompactedResult = {
		ref,
		summary: projectSummary(value, state.budget.summaryChars),
		truncated: true,
		originalBytes: length,
		hint: `Full result stored as ref "${ref}". Call resolve_ref with this ref if you need more detail.`,
	};
	return projected;
}

/**
 * Walk a message array and compact any oversized tool-result content parts.
 * Used for **loaded history** (resumed conversations) where large tool
 * results already sit in the message array before `streamText` runs.
 *
 * Pure function — does not touch compaction context. Returns a new array;
 * the input is not mutated. When a compaction context is active, refs are
 * stored there so the model can resolve them.
 */
export function compactToolResults(messages: ModelMessage[]): ModelMessage[] {
	return messages.map((msg) => {
		if (msg.role !== 'tool') return msg;
		// AI SDK v6 tool message content is an array of tool-result parts.
		const content = (msg as unknown as { content: unknown }).content;
		if (!Array.isArray(content)) return msg;
		const nextContent = content.map((part: unknown) => {
			if (!part || typeof part !== 'object') return part;
			const p = part as Record<string, unknown>;
			if (p.type !== 'tool-result') return part;
			const output = p.output;
			const compacted = compactToolResult((p.toolName as string) ?? 'unknown', output);
			if (compacted === output) return part;
			return { ...p, output: compacted };
		});
		return { ...msg, content: nextContent } as ModelMessage;
	});
}
