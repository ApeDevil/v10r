/**
 * dbops domain types — the operate (mutating) layer over Neon branches.
 */
export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type RunKind = 'reset_from_parent';
export type RunTrigger = 'manual' | 'scheduled';

export interface StartOperationInput {
	kind: RunKind;
	trigger: RunTrigger;
	actorId: string;
	actorEmail: string;
	/** Dedupe double-clicks/retries. Omit/null for system-triggered runs. */
	idempotencyKey?: string | null;
}

/**
 * Sanitized run shape returned to the API + monitor. Never carries DSNs — and
 * deliberately omits raw Neon branch ids / operation uuids (kept server-side in
 * the row) so the admin client only ever sees a non-identifying op count.
 */
export interface RunDTO {
	id: string;
	kind: RunKind;
	status: RunStatus;
	trigger: RunTrigger;
	/** How many Neon operations the run spawned — not the raw op ids. */
	neonOpCount: number;
	error: { message: string; at: string } | null;
	actorEmail: string;
	createdAt: string;
	updatedAt: string;
	finishedAt: string | null;
}

const TERMINAL: RunStatus[] = ['succeeded', 'failed', 'canceled'];
export function isTerminal(status: RunStatus): boolean {
	return TERMINAL.includes(status);
}

export class NotConfiguredError extends Error {
	constructor(message = 'Neon Management API not configured') {
		super(message);
		this.name = 'NotConfiguredError';
	}
}

export class ConflictError extends Error {
	constructor(message = 'A refresh is already in flight.') {
		super(message);
		this.name = 'ConflictError';
	}
}

export class RefusedError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RefusedError';
	}
}
