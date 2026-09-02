/**
 * dbops domain types — the operate (mutating) layer over Neon branches.
 */
export type BranchOperationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
export type BranchOperationKind = 'reset_from_parent';
export type BranchOperationTrigger = 'manual' | 'scheduled';

export interface StartOperationInput {
	kind: BranchOperationKind;
	trigger: BranchOperationTrigger;
	actorId: string;
	actorEmail: string;
	/** Dedupe double-clicks/retries. Omit/null for system-triggered operations. */
	idempotencyKey?: string | null;
}

/**
 * Sanitized operation shape returned to the API + monitor. Never carries DSNs — and
 * deliberately omits raw Neon branch ids / operation uuids (kept server-side in
 * the row) so the admin client only ever sees a non-identifying op count.
 */
export interface PublicBranchOperation {
	id: string;
	kind: BranchOperationKind;
	status: BranchOperationStatus;
	trigger: BranchOperationTrigger;
	/** How many Neon operations this one spawned — not the raw op ids. */
	neonOpCount: number;
	error: { message: string; at: string } | null;
	actorEmail: string;
	createdAt: string;
	updatedAt: string;
	finishedAt: string | null;
}

const TERMINAL: BranchOperationStatus[] = ['succeeded', 'failed', 'canceled'];
export function isTerminal(status: BranchOperationStatus): boolean {
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
