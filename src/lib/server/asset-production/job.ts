/**
 * The job lifecycle: one run of one request, as a status machine with a fixed set of moves.
 *
 *   queued ──▶ running ──▶ succeeded | failed | refused | cancelled
 *      └──────────────────▶ cancelled
 *
 * Terminal states have no exit: a finished job is a record, and a re-run is a new job (which
 * the store's derivation key makes cheap). Kept pure — the in-process runner moves through it
 * in one call; a queued, persisted job would store the same record and claim it with the
 * lease of the `durable-step-execution` pattern.
 */

import type { AssetAgent } from '#lib/asset-production/index.ts';

export type AssetJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'refused' | 'cancelled';

const MOVES: Record<AssetJobStatus, readonly AssetJobStatus[]> = {
	queued: ['running', 'cancelled'],
	running: ['succeeded', 'failed', 'refused', 'cancelled'],
	succeeded: [],
	failed: [],
	refused: [],
	cancelled: [],
};

export const isTerminalAssetJobStatus = (status: AssetJobStatus) => MOVES[status].length === 0;

export interface AssetJob {
	id: string;
	/** Store namespace. Assets are user-scoped: one owner never reads or collides with another's. */
	owner: string;
	agent: AssetAgent;
	status: AssetJobStatus;
	/** ISO timestamps, one per status the job has entered. */
	history: { status: AssetJobStatus; at: string }[];
}

export function createAssetJob(id: string, owner: string, agent: AssetAgent, at: Date): AssetJob {
	return { id, owner, agent, status: 'queued', history: [{ status: 'queued', at: at.toISOString() }] };
}

/** The job after a move, or `undefined` when the move is not allowed from where it is. */
export function moveAssetJob(job: AssetJob, to: AssetJobStatus, at: Date): AssetJob | undefined {
	if (!MOVES[job.status].includes(to)) return undefined;
	return { ...job, status: to, history: [...job.history, { status: to, at: at.toISOString() }] };
}
