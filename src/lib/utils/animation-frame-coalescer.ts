/**
 * Coalesce a burst of updates into at most one application per animation frame.
 *
 * Pointer moves, scroll events and streamed text chunks can each arrive many
 * times between two paints; only the last one before the paint is ever seen.
 * Applying every one of them is work the user cannot observe. This keeps the
 * latest value and applies it once, on the next frame.
 *
 * `flush` exists for the moment a burst ends (pointer released, stream done):
 * the final value must land exactly and immediately, not one frame late.
 */

export interface AnimationFrameCoalescer<T> {
	/** Queue a value; only the latest one queued before the next frame is applied. */
	push(value: T): void;
	/** Apply a value now, dropping anything queued. */
	flush(value: T): void;
	/** Apply the queued value now, if one is waiting. */
	settle(): void;
	/** Drop the queued value without applying it. */
	cancel(): void;
}

type Schedule = (callback: () => void) => number;
type Unschedule = (handle: number) => void;

export function createAnimationFrameCoalescer<T>(
	apply: (value: T) => void,
	schedule: Schedule = (callback) => requestAnimationFrame(callback),
	unschedule: Unschedule = (handle) => cancelAnimationFrame(handle),
): AnimationFrameCoalescer<T> {
	let handle: number | null = null;
	let queued: { value: T } | null = null;

	function cancel(): void {
		if (handle !== null) unschedule(handle);
		handle = null;
		queued = null;
	}

	function settle(): void {
		const pending = queued;
		cancel();
		if (pending) apply(pending.value);
	}

	return {
		push(value) {
			queued = { value };
			if (handle === null) handle = schedule(settle);
		},
		flush(value) {
			cancel();
			apply(value);
		},
		settle,
		cancel,
	};
}
