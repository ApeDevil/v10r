/**
 * BranchOperationMonitor — client-side poller for a dbops branch operation.
 *
 * Polls `GET /api/admin/db/ops/{id}` ~1.5s while an operation is in flight, stopping on
 * a terminal state and calling `onDone` (the Mirror page wires this to
 * `invalidate('admin:dbops')` so the branch panel + operation list refresh). Visibility
 * aware: pauses while the tab is hidden. No SSE.
 */
import type { BranchOperationStatus } from '$lib/server/dbops';

const TERMINAL: BranchOperationStatus[] = ['succeeded', 'failed', 'canceled'];
const POLL_MS = 1500;

export interface BranchOperationSnapshot {
	id: string;
	status: BranchOperationStatus;
	error: { message: string; at: string } | null;
}

function isTerminal(status: BranchOperationStatus): boolean {
	return TERMINAL.includes(status);
}

export class BranchOperationMonitor {
	operation = $state<BranchOperationSnapshot | null>(null);
	polling = $state(false);
	#timer: ReturnType<typeof setTimeout> | null = null;
	#onDone: (() => void) | null = null;

	get status(): BranchOperationStatus | null {
		return this.operation?.status ?? null;
	}

	get error(): string | null {
		return this.operation?.error?.message ?? null;
	}

	get isPolling(): boolean {
		return this.polling;
	}

	/** Begin tracking a freshly-started operation by id (assumed running). */
	start(runId: string, onDone?: () => void): void {
		this.#begin({ id: runId, status: 'running', error: null }, onDone);
	}

	/** Resume tracking from a known snapshot (e.g. an in-flight operation from load). */
	seed(operation: BranchOperationSnapshot, onDone?: () => void): void {
		this.#begin(operation, onDone);
	}

	stop(): void {
		this.polling = false;
		this.#clear();
	}

	#begin(operation: BranchOperationSnapshot, onDone?: () => void): void {
		this.#clear();
		this.operation = operation;
		this.#onDone = onDone ?? null;
		if (isTerminal(operation.status)) {
			this.#finish();
			return;
		}
		this.polling = true;
		this.#schedule(operation.id);
	}

	#schedule(id: string): void {
		this.#timer = setTimeout(() => this.#poll(id), POLL_MS);
	}

	async #poll(id: string): Promise<void> {
		if (typeof document !== 'undefined' && document.hidden) {
			// Tab hidden — back off and retry; the operation advances server-side regardless.
			this.#schedule(id);
			return;
		}
		try {
			const res = await fetch(`/api/admin/db/ops/${id}`);
			if (res.ok) {
				const body = (await res.json()) as { data: BranchOperationSnapshot };
				this.operation = { id: body.data.id, status: body.data.status, error: body.data.error };
			}
		} catch {
			// Transient — retry next tick.
		}
		if (this.operation && !isTerminal(this.operation.status)) {
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
