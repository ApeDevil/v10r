/**
 * RunMonitor — client-side poller for a dbops run.
 *
 * Polls `GET /api/admin/db/ops/{id}` ~1.5s while a run is in flight, stopping on
 * a terminal state and calling `onDone` (the Mirror page wires this to
 * `invalidate('admin:dbops')` so the branch panel + run list refresh). Visibility
 * aware: pauses while the tab is hidden. No SSE.
 */
import type { RunStatus } from '$lib/server/dbops';

const TERMINAL: RunStatus[] = ['succeeded', 'failed', 'canceled'];
const POLL_MS = 1500;

export interface RunView {
	id: string;
	status: RunStatus;
	error: { message: string; at: string } | null;
}

function isTerminal(status: RunStatus): boolean {
	return TERMINAL.includes(status);
}

export class RunMonitor {
	run = $state<RunView | null>(null);
	polling = $state(false);
	#timer: ReturnType<typeof setTimeout> | null = null;
	#onDone: (() => void) | null = null;

	get status(): RunStatus | null {
		return this.run?.status ?? null;
	}

	get error(): string | null {
		return this.run?.error?.message ?? null;
	}

	get isPolling(): boolean {
		return this.polling;
	}

	/** Begin tracking a freshly-started run by id (assumed running). */
	start(runId: string, onDone?: () => void): void {
		this.#begin({ id: runId, status: 'running', error: null }, onDone);
	}

	/** Resume tracking from a known run snapshot (e.g. an in-flight run from load). */
	seed(run: RunView, onDone?: () => void): void {
		this.#begin(run, onDone);
	}

	stop(): void {
		this.polling = false;
		this.#clear();
	}

	#begin(run: RunView, onDone?: () => void): void {
		this.#clear();
		this.run = run;
		this.#onDone = onDone ?? null;
		if (isTerminal(run.status)) {
			this.#finish();
			return;
		}
		this.polling = true;
		this.#schedule(run.id);
	}

	#schedule(id: string): void {
		this.#timer = setTimeout(() => this.#poll(id), POLL_MS);
	}

	async #poll(id: string): Promise<void> {
		if (typeof document !== 'undefined' && document.hidden) {
			// Tab hidden — back off and retry; the run advances server-side regardless.
			this.#schedule(id);
			return;
		}
		try {
			const res = await fetch(`/api/admin/db/ops/${id}`);
			if (res.ok) {
				const body = (await res.json()) as { data: RunView };
				this.run = { id: body.data.id, status: body.data.status, error: body.data.error };
			}
		} catch {
			// Transient — retry next tick.
		}
		if (this.run && !isTerminal(this.run.status)) {
			this.#schedule(id);
		} else {
			this.#finish();
		}
	}

	#finish(): void {
		this.polling = false;
		this.#clear();
		const done = this.#onDone;
		this.#onDone = null;
		done?.();
	}

	#clear(): void {
		if (this.#timer) {
			clearTimeout(this.#timer);
			this.#timer = null;
		}
	}
}
