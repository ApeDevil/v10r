/**
 * Secondary reaper: fail dbops runs whose lease lapsed (crashed/abandoned
 * executor). Lazy lease-expiry in `advanceRun` is the primary mechanism; this
 * sweep catches runs nobody polls. Returns the count reaped.
 */
import { reapExpiredRuns } from '$lib/server/dbops';

export async function dbopsReaper(): Promise<number> {
	return reapExpiredRuns();
}
