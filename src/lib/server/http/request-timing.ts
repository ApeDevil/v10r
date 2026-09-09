/**
 * Request timing — where a response's milliseconds went, and who to blame.
 *
 * A slow response is only actionable when it decomposes. This is the v10r-owned
 * tracing API every layer records into; `Server-Timing` is one renderer of it and
 * an OpenTelemetry exporter would be another. Domain code depends on THIS shape,
 * never on a vendor's, which is the whole reason the indirection exists.
 *
 * Two properties are load-bearing:
 *
 *   Cheap — a span is one `performance.now()` pair and one array push. `MAX_SPANS`
 *   caps the array so a loop that spans per row degrades to silence rather than to
 *   unbounded memory. Instrumentation that costs what it measures is a lie.
 *
 *   Truthful about what it does not know — `unattributed` is the wall-clock time no
 *   span claimed. It is a FLOOR, not a figure: concurrent spans overlap, so their
 *   durations can sum past the wall clock, and the value clamps at zero rather than
 *   going negative. A zero means "spans covered it", never "nothing was missed".
 *
 * Rendering is separate from recording (`toServerTimingHeader`) because the header
 * is readable by any client: full span detail is disclosure, and the caller decides
 * who has earned it. This module has no idea who is asking, on purpose.
 */

/** One measured segment of a request. */
export interface RequestSpan {
	name: string;
	/** Milliseconds, as measured by `performance.now()`. */
	duration: number;
}

/**
 * Ceiling on recorded spans. Reached only by instrumenting inside a loop — which is
 * the bug, not the budget — so overflow is dropped silently rather than throwing on
 * a live request.
 */
export const MAX_SPANS = 64;

/** Server-Timing names are tokens: no spaces, commas, semicolons or quotes. */
function sanitizeSpanName(name: string): string {
	const token = name.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 40);
	return token.length > 0 ? token : 'span';
}

export interface RequestTiming {
	/** Measure `work`, record it under `name`, and return its result. Records on throw too. */
	span<T>(name: string, work: () => T | Promise<T>): Promise<T>;
	/** Record a segment already measured elsewhere (a driver's own reported duration). */
	record(name: string, duration: number): void;
	/** Wall-clock milliseconds since this timing started. */
	elapsed(): number;
	/** Recorded spans in completion order. */
	readonly spans: readonly RequestSpan[];
}

export function startRequestTiming(): RequestTiming {
	const startedAt = performance.now();
	const spans: RequestSpan[] = [];

	const record = (name: string, duration: number): void => {
		if (spans.length >= MAX_SPANS) return;
		spans.push({ name, duration });
	};

	return {
		spans,
		record,
		elapsed: () => performance.now() - startedAt,
		async span(name, work) {
			const from = performance.now();
			try {
				return await work();
			} finally {
				record(name, performance.now() - from);
			}
		},
	};
}

export interface ServerTimingOptions {
	/**
	 * Emit every span. Reserved for callers who already see internals — admins and
	 * debug-paired devices. Anyone else gets the total alone: per-span timings map the
	 * internal architecture and hand out a timing side channel for free.
	 */
	detail: boolean;
}

/**
 * Render a `Server-Timing` header value, or `null` when there is nothing worth sending.
 *
 * Durations are rounded to 0.1 ms — finer resolution is noise at this scale and a
 * sharper clock is a sharper side channel.
 */
export function toServerTimingHeader(timing: RequestTiming, options: ServerTimingOptions): string | null {
	const total = timing.elapsed();
	if (!Number.isFinite(total)) return null;

	const round = (ms: number) => Math.round(ms * 10) / 10;
	const parts: string[] = [];

	if (options.detail) {
		for (const span of timing.spans) {
			parts.push(`${sanitizeSpanName(span.name)};dur=${round(span.duration)}`);
		}
		const claimed = timing.spans.reduce((sum, span) => sum + span.duration, 0);
		parts.push(`unattributed;dur=${round(Math.max(0, total - claimed))}`);
	}
	parts.push(`total;dur=${round(total)}`);

	return parts.join(', ');
}
