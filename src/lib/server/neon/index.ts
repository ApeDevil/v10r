/**
 * Neon Management API domain — public surface.
 *
 * Sole holder of NEON_API_KEY / NEON_PROJECT_ID. Consumed by `$lib/server/dbops`
 * (operate) and the admin Mirror route. Never exposes connection strings.
 */

export { hasChildren, type ResolvedTargets, resolveTargets, TargetsError } from './branches';
export { getBranch, getOperation, listBranches, neonConfigured, restoreBranchFromParent } from './client';
export { fetchBranchStatus } from './monitor';
export type {
	NeonBranch,
	NeonBranchStatus,
	NeonOperation,
	NeonOperationStatus,
	NeonRestoreResult,
} from './types';
export { NEON_OP_TERMINAL_FAIL, NEON_OP_TERMINAL_OK } from './types';
