/**
 * Read-only Neon branch status for the Mirror tab.
 *
 * Mirrors the `monitoring/neon.ts` `fetchNeonMetrics` shape: a try/catch that
 * always resolves to a `ProviderResult<T>` envelope, degrading to `unavailable`
 * when the Management API is not configured (same as `monitoring/upstash.ts`).
 */
import {
	computePercentage,
	computeThreshold,
	FREE_TIER_LIMITS,
	type ProviderResult,
	sanitizeError,
} from '$lib/server/monitoring';
import { resolveTargets } from './branches';
import { listBranches, neonConfigured } from './client';
import type { NeonBranchStatus } from './types';

/** Neon free tier allows 10 branches per project. */
const BRANCH_LIMIT = 10;

export async function fetchBranchStatus(): Promise<ProviderResult<NeonBranchStatus>> {
	if (!neonConfigured()) {
		return {
			status: 'unavailable',
			data: null,
			error: 'Management API not configured',
			measuredAt: new Date().toISOString(),
			latencyMs: 0,
		};
	}

	const start = performance.now();

	try {
		const { devBranchId, parentBranchId } = await resolveTargets();
		const branches = await listBranches();

		const dev = branches.find((b) => b.id === devBranchId);
		if (!dev) throw new Error(`Dev branch ${devBranchId} not found`);
		const parent = branches.find((b) => b.id === parentBranchId);

		const storageBytes = dev.logicalSize ?? 0;
		const storageLimit = FREE_TIER_LIMITS.neon.storageBytes;
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;

		return {
			status: 'ok',
			data: {
				devBranchName: dev.name,
				devCreatedAt: dev.createdAt,
				devUpdatedAt: dev.updatedAt,
				// Friendly name only — never fall back to the raw parent id.
				parentBranchName: parent?.name ?? 'parent',
				branchCount: branches.length,
				branchLimit: BRANCH_LIMIT,
				branchCountThreshold: computeThreshold(branches.length, BRANCH_LIMIT),
				storageBytes,
				storageLimit,
				storagePercentage: computePercentage(storageBytes, storageLimit),
				storageThreshold: computeThreshold(storageBytes, storageLimit),
			},
			error: null,
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	} catch (err) {
		const latencyMs = Math.round((performance.now() - start) * 100) / 100;
		return {
			status: 'unavailable',
			data: null,
			error: sanitizeError(err),
			measuredAt: new Date().toISOString(),
			latencyMs,
		};
	}
}
