/**
 * tool-leak-guard — a `streamText` transform that suppresses *textual* tool-call
 * markup from ever reaching the user.
 *
 * Why this exists: Groq's `llama-3.3-70b-versatile` (our only configured tool
 * provider when just `GROQ_API_KEY` is set) probabilistically emits a tool call
 * as plain assistant TEXT instead of a structured `tool_calls` field — e.g. the
 * whole turn streams back as:
 *
 *   <function=search_catalog>{"query": "Button component"}</function>
 *   <function(search_catalog)>{"query": "..."}
 *   <|python_tag|>search_catalog.call(...)
 *
 * The AI SDK never sees a tool call, so `execute()` never runs and the raw markup
 * is what the user reads as the "answer". This guard is a pure-robustness net: it
 * detects that markup in the text stream and drops it, so the failure degrades to
 * an empty/short turn (the model can be re-prompted) instead of leaking syntax.
 * It does NOT make the model call tools correctly — that's a provider-reliability
 * concern (see `providers.ts` / the model-routing decision).
 *
 * Streaming-safe: text arrives as many `text-delta` chunks. We buffer deltas only
 * while the accumulated text is still a viable *prefix* of a leak marker. As soon
 * as it disambiguates we either (a) suppress the rest of this step's text, or (b)
 * flush the buffer and pass everything straight through. Normal answers incur at
 * most a few characters of buffering before the first visible token.
 *
 * Per-step state is reset on `start-step` / `finish-step`, so a leak in step N
 * does not gag legitimate text in step N+1.
 */

/**
 * Markers that, at the very start of an assistant turn, indicate the model is
 * trying to express a tool call as text. Matched case-insensitively against the
 * leading (trimmed) text of a step. Keep these anchored to real Llama / Groq /
 * Hermes failure shapes — we must never gobble a legitimate answer that merely
 * mentions "<function".
 */
const LEAK_MARKERS = [
	'<function=', // <function=name>{...}
	'<function(', // <function(name)>{...}
	'<function>', // <function>{"name": ...}
	'<tool_call>', // Hermes / Qwen style
	'<|python_tag|>', // Llama 3.1/3.3 builtin-tool tag
	'<|tool_call|>',
	'functools[', // older Llama tool dialect
];

/** Longest marker length — bounds how much we must buffer before deciding. */
const MAX_MARKER_LEN = Math.max(...LEAK_MARKERS.map((m) => m.length));

/**
 * Post-hoc sibling of the stream guard: given the FULL final assistant text,
 * decide whether it is (entirely) a textual tool-call leak and, if so, blank it.
 *
 * The stream guard keeps the leak out of the user's eyes, but `onFinish` receives
 * the model's raw `text` and persists it / verifies citations against it. Without
 * this, the leaked `<function=…>` markup would be saved as the assistant message
 * and reappear on reload. We only blank when the text *starts* with a marker (the
 * observed failure shape is the whole turn being the call) so we never truncate a
 * legitimate answer that happens to mention `<function` mid-sentence.
 *
 * Returns the cleaned text (empty string when the whole turn was a leak).
 */
export function stripTextualToolCall(text: string): string {
	const trimmed = text.replace(/^\s+/, '');
	const lower = trimmed.toLowerCase();
	for (const marker of LEAK_MARKERS) {
		if (lower.startsWith(marker)) return '';
	}
	return text;
}

/** Could `lead` still grow into one of the markers (or already be one)? */
function couldBeLeak(lead: string): { decided: boolean; isLeak: boolean } {
	const lower = lead.toLowerCase();
	for (const marker of LEAK_MARKERS) {
		if (lower.startsWith(marker)) return { decided: true, isLeak: true };
		// `lead` is a strict prefix of a marker → still ambiguous, keep buffering.
		if (marker.startsWith(lower)) return { decided: false, isLeak: false };
	}
	return { decided: true, isLeak: false };
}

/**
 * Build the transform. Generic over the tool set so it composes with the typed
 * `streamText` call. Pass an optional `onLeak` to record that a suppression
 * happened (for logging / observability).
 */
export function createToolLeakGuard(onLeak?: (lead: string) => void) {
	return () => {
		// Per-step state.
		let lead = ''; // accumulated leading text while still ambiguous
		let buffered: unknown[] = []; // text parts held back during the ambiguous window
		let mode: 'sniffing' | 'passthrough' | 'suppressing' = 'sniffing';

		const resetStep = () => {
			lead = '';
			buffered = [];
			mode = 'sniffing';
		};

		return new TransformStream<{ type: string; text?: string }, { type: string; text?: string }>({
			transform(part, controller) {
				// Step boundaries reset the sniffer so a leak in one step can't gag the next.
				if (part.type === 'start-step' || part.type === 'start') {
					resetStep();
					controller.enqueue(part);
					return;
				}

				// Only text parts can carry the textual-call leak. Everything else
				// (tool-call, tool-result, reasoning, finish, …) passes through.
				const isText = part.type === 'text-delta' || part.type === 'text-start' || part.type === 'text-end';
				if (!isText) {
					if (part.type === 'finish-step') resetStep();
					controller.enqueue(part);
					return;
				}

				if (mode === 'passthrough') {
					controller.enqueue(part);
					return;
				}
				if (mode === 'suppressing') {
					// Drop all text for the rest of this step.
					return;
				}

				// mode === 'sniffing' — hold the part and grow the lead.
				buffered.push(part);
				if (part.type === 'text-delta' && typeof part.text === 'string') {
					lead += part.text;
				}

				const trimmed = lead.replace(/^\s+/, '');
				if (trimmed.length === 0) {
					// Pure whitespace so far — keep sniffing without committing.
					return;
				}

				const { decided, isLeak } = couldBeLeak(trimmed);
				if (!decided && trimmed.length < MAX_MARKER_LEN) {
					// Still a viable marker prefix and short enough — keep buffering.
					return;
				}

				if (isLeak) {
					// Confirmed textual tool-call. Discard the buffer and gag the rest.
					onLeak?.(trimmed.slice(0, MAX_MARKER_LEN));
					buffered = [];
					mode = 'suppressing';
					return;
				}

				// Confirmed normal text — release everything we held and pass through.
				mode = 'passthrough';
				for (const held of buffered) controller.enqueue(held as { type: string; text?: string });
				buffered = [];
			},
			flush(controller) {
				// If we ended mid-sniff with a non-leak buffer, release it.
				if (mode === 'sniffing') {
					for (const held of buffered) controller.enqueue(held as { type: string; text?: string });
				}
			},
			// biome-ignore lint/suspicious/noExplicitAny: the SDK's TextStreamPart union is not exported; we operate structurally on the {type,text} shape.
		}) as any;
	};
}
