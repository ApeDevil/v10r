/**
 * Neon Management API client — the SOLE holder of NEON_API_KEY / NEON_PROJECT_ID.
 *
 * Thin fetch wrapper over https://console.neon.tech/api/v2. Mutating operations
 * (restore) return an `operations[]` array that must be polled to completion via
 * `getOperation`. Errors are thrown with status only (never the response body,
 * which can contain ids/tokens); callers run them through `sanitizeError`.
 */
import { env } from '$env/dynamic/private';
import type { NeonBranch, NeonOperation, NeonRestoreResult } from './types';

const BASE = 'https://console.neon.tech/api/v2';

/** True when the Management API can be used (key + project id present). */
export function neonConfigured(): boolean {
	return !!(env.NEON_API_KEY && env.NEON_PROJECT_ID);
}

function projectId(): string {
	const id = env.NEON_PROJECT_ID;
	if (!id) throw new Error('NEON_PROJECT_ID not configured');
	return id;
}

async function neonFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const key = env.NEON_API_KEY;
	if (!key) throw new Error('NEON_API_KEY not configured');

	const res = await fetch(`${BASE}${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${key}`,
			'Content-Type': 'application/json',
			Accept: 'application/json',
			...init?.headers,
		},
	});

	if (!res.ok) {
		// Status only — never surface the body (may leak project/branch ids).
		throw new Error(`Neon API ${init?.method ?? 'GET'} ${path} → HTTP ${res.status}`);
	}

	return (await res.json()) as T;
}

type RawBranch = {
	id: string;
	name: string;
	parent_id?: string | null;
	created_at: string;
	updated_at: string;
	current_state: string;
	logical_size?: number | null;
};

type RawOperation = {
	id: string;
	action: string;
	status: NeonOperation['status'];
	branch_id?: string | null;
};

function toBranch(raw: RawBranch): NeonBranch {
	return {
		id: raw.id,
		name: raw.name,
		parentId: raw.parent_id ?? null,
		createdAt: raw.created_at,
		updatedAt: raw.updated_at,
		currentState: raw.current_state,
		logicalSize: raw.logical_size ?? null,
	};
}

function toOperation(raw: RawOperation): NeonOperation {
	return { id: raw.id, action: raw.action, status: raw.status, branchId: raw.branch_id ?? null };
}

export async function listBranches(): Promise<NeonBranch[]> {
	const data = await neonFetch<{ branches: RawBranch[] }>(`/projects/${projectId()}/branches`);
	return (data.branches ?? []).map(toBranch);
}

export async function getBranch(branchId: string): Promise<NeonBranch> {
	const data = await neonFetch<{ branch: RawBranch }>(`/projects/${projectId()}/branches/${branchId}`);
	return toBranch(data.branch);
}

/**
 * Reset `branchId` to the current HEAD of `sourceBranchId` (its parent).
 * Copy-on-write, near-instant; the branch's connection string is preserved and
 * the child's data is replaced. Returns the async operations to poll.
 */
export async function restoreBranchFromParent(branchId: string, sourceBranchId: string): Promise<NeonRestoreResult> {
	const data = await neonFetch<{ operations: RawOperation[] }>(
		`/projects/${projectId()}/branches/${branchId}/restore`,
		{ method: 'POST', body: JSON.stringify({ source_branch_id: sourceBranchId }) },
	);
	return { operations: (data.operations ?? []).map(toOperation) };
}

export async function getOperation(operationId: string): Promise<NeonOperation> {
	const data = await neonFetch<{ operation: RawOperation }>(`/projects/${projectId()}/operations/${operationId}`);
	return toOperation(data.operation);
}
