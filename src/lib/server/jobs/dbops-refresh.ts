/**
 * Scheduled dev-branch refresh (reset dev from parent).
 *
 * Gated by DBOPS_AUTO_REFRESH_ENABLED so it never surprise-wipes a dev branch
 * that's being actively worked on. Reuses the same `startOperation` core as the
 * manual path, then drives `advanceOperation` to a terminal state itself (no browser
 * polls it). Returns 1 on a successful reset, else 0 (the job's resultCount).
 */
import { env } from '$env/dynamic/private';
import {
	advanceOperation,
	ConflictError,
	isTerminal,
	type PublicBranchOperation,
	startOperation,
} from '$lib/server/dbops';
import { neonConfigured } from '$lib/server/neon';

const DRIVE_TIMEOUT_MS = 90_000;
const DRIVE_INTERVAL_MS = 1500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function dbopsRefresh(): Promise<number> {
	if (env.DBOPS_AUTO_REFRESH_ENABLED !== 'true') return 0;
	if (!neonConfigured()) return 0;

	let started: { operation: PublicBranchOperation; replayed: boolean };
	try {
		started = await startOperation({
			kind: 'reset_from_parent',
			trigger: 'scheduled',
			actorId: 'system',
			actorEmail: 'system@dbops',
		});
	} catch (err) {
		if (err instanceof ConflictError) return 0; // a manual operation is already in flight — skip
		throw err;
	}

	let operation = started.operation;
	const deadline = Date.now() + DRIVE_TIMEOUT_MS;
	while (!isTerminal(operation.status) && Date.now() < deadline) {
		await sleep(DRIVE_INTERVAL_MS);
		const next = await advanceOperation(operation.id);
		if (next) operation = next;
	}

	return operation.status === 'succeeded' ? 1 : 0;
}
