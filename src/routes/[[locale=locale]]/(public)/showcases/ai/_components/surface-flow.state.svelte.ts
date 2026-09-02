/**
 * Trace player — cursor over a recorded timeline, nothing else. All rendering state
 * is `reduceTurn(replay, cursor, decision)`: rebuild-from-seed on every change, so
 * seeking (including changing the decision) can never leave residue.
 *
 * Pace: 900ms/frame, stretched to 1400ms under `prefers-reduced-motion` (jumps need
 * more dwell than sweeps). No autoplay — the resting diagram is already complete.
 */

import { type HaltDecision, reduceTurn, replayTimeline, type SurfaceReplay } from '$lib/showcases/ai/replay';
import type { TurnTrace } from '$lib/types/turn-trace';

const STEP_MS = 900;
const STEP_MS_REDUCED = 1400;

export class TracePlayer {
	readonly replay: SurfaceReplay;
	cursor = $state(0);
	playing = $state(false);
	decision = $state<HaltDecision | undefined>(undefined);
	#timer: ReturnType<typeof setTimeout> | null = null;

	constructor(replay: SurfaceReplay) {
		this.replay = replay;
	}

	get timeline(): readonly unknown[] {
		return replayTimeline(this.replay, this.decision);
	}

	get length(): number {
		return this.timeline.length;
	}

	get trace(): TurnTrace {
		return reduceTurn(this.replay, this.cursor, this.decision);
	}

	/** Cursor of the halt frame boundary (end of the shared prefix), or -1. */
	get haltCursor(): number {
		return this.replay.halt ? this.replay.frames.length : -1;
	}

	get halted(): boolean {
		return this.trace.outcome?.kind === 'awaiting_decision';
	}

	get atEnd(): boolean {
		return this.cursor >= this.length && !this.halted;
	}

	#stepMs(): number {
		if (typeof window === 'undefined') return STEP_MS;
		return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? STEP_MS_REDUCED : STEP_MS;
	}

	#schedule(): void {
		this.#clear();
		this.#timer = setTimeout(() => this.#tick(), this.#stepMs());
	}

	#clear(): void {
		if (this.#timer !== null) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}

	#tick(): void {
		if (!this.playing) return;
		if (this.cursor < this.length) this.cursor += 1;
		// The halt is a hard stop: the next frame is the visitor's decision.
		if (this.halted || this.cursor >= this.length) {
			this.pause();
			return;
		}
		this.#schedule();
	}

	play(): void {
		if (this.atEnd) this.cursor = 0;
		this.playing = true;
		this.#schedule();
	}

	pause(): void {
		this.playing = false;
		this.#clear();
	}

	stepForward(): void {
		this.pause();
		if (this.halted) return;
		this.cursor = Math.min(this.cursor + 1, this.length);
	}

	stepBack(): void {
		this.pause();
		this.cursor = Math.max(this.cursor - 1, 0);
	}

	restart(): void {
		this.pause();
		this.decision = undefined;
		this.cursor = 0;
	}

	seek(n: number): void {
		this.pause();
		this.cursor = Math.max(0, Math.min(n, this.length));
	}

	/** The visitor's call at the PlanCard halt — playback resumes down the chosen branch. */
	decide(decision: HaltDecision): void {
		this.decision = decision;
		this.playing = true;
		this.#schedule();
	}

	/** Re-arm the halt so the other branch can be explored. Never a dead end. */
	rearm(): void {
		this.pause();
		this.decision = undefined;
		this.cursor = this.haltCursor === -1 ? this.cursor : this.haltCursor;
	}

	destroy(): void {
		this.#clear();
	}
}
