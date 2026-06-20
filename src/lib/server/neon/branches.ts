/**
 * Branch target resolution + restore preconditions.
 *
 * The dev branch is identified explicitly via NEON_DEV_BRANCH_ID. Its parent
 * (the source for reset-from-parent) comes from NEON_PARENT_BRANCH_ID, or is
 * derived from the dev branch's own `parent_id` when that env is unset.
 */
import { env } from '$env/dynamic/private';
import { getBranch, listBranches } from './client';

/** Thrown when the dev/parent branch targets cannot be resolved from config. */
export class TargetsError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TargetsError';
	}
}

export interface ResolvedTargets {
	devBranchId: string;
	parentBranchId: string;
}

export async function resolveTargets(): Promise<ResolvedTargets> {
	const devBranchId = env.NEON_DEV_BRANCH_ID;
	if (!devBranchId) throw new TargetsError('NEON_DEV_BRANCH_ID not configured');

	let parentBranchId = env.NEON_PARENT_BRANCH_ID ?? '';
	if (!parentBranchId) {
		const dev = await getBranch(devBranchId);
		if (!dev.parentId) {
			throw new TargetsError('Dev branch has no parent; set NEON_PARENT_BRANCH_ID');
		}
		parentBranchId = dev.parentId;
	}

	return { devBranchId, parentBranchId };
}

/**
 * Reset-from-parent is blocked by Neon if the branch has its own children.
 * Surface this as a precondition before calling the API.
 */
export async function hasChildren(branchId: string): Promise<boolean> {
	const branches = await listBranches();
	return branches.some((b) => b.parentId === branchId);
}
