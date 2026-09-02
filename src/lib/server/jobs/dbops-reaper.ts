/**
 * Secondary reaper: fail dbops operations whose lease lapsed (crashed/abandoned
 * executor). Lazy lease-expiry in `advanceOperation` is the primary mechanism; this
 * sweep catches operations nobody polls. Returns the count reaped.
 */
import { reapExpiredOperations } from '$lib/server/dbops';

export async function dbopsReaper(): Promise<number> {
	return reapExpiredOperations();
}
