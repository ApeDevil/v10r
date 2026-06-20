/**
 * Neon Management API DTOs.
 *
 * These are the only shapes that leave the `neon/` domain. They never carry
 * connection strings / DSNs — only branch + operation metadata.
 */
import type { ThresholdLevel } from '$lib/server/monitoring';

export interface NeonBranch {
	id: string;
	name: string;
	parentId: string | null;
	createdAt: string;
	updatedAt: string;
	currentState: string;
	/** Logical data size of the branch in bytes (may be absent on some plans). */
	logicalSize: number | null;
}

export type NeonOperationStatus =
	| 'scheduling'
	| 'running'
	| 'finished'
	| 'failed'
	| 'cancelling'
	| 'cancelled'
	| 'skipped';

export interface NeonOperation {
	id: string;
	action: string;
	status: NeonOperationStatus;
	branchId: string | null;
}

export interface NeonRestoreResult {
	operations: NeonOperation[];
}

/**
 * Read-only branch status surfaced on the Mirror tab. Only friendly names reach
 * the client — raw `br-…` branch ids stay server-side (the UI never renders them).
 */
export interface NeonBranchStatus {
	devBranchName: string;
	/** Branch creation time. */
	devCreatedAt: string;
	/** Last write/reset to the branch — our "last refreshed" proxy. */
	devUpdatedAt: string;
	parentBranchName: string;
	branchCount: number;
	branchLimit: number;
	branchCountThreshold: ThresholdLevel;
	storageBytes: number;
	storageLimit: number;
	storagePercentage: number;
	storageThreshold: ThresholdLevel;
}

/** Terminal Neon operation states. */
export const NEON_OP_TERMINAL_OK: NeonOperationStatus = 'finished';
export const NEON_OP_TERMINAL_FAIL: NeonOperationStatus[] = ['failed', 'cancelled'];
