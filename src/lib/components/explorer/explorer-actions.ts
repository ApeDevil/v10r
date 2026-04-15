/**
 * EXPLORER ACTIONS — pure async primitives for folder/file mutations.
 *
 * Drag-drop, "Move to…" dialog, and context-menu delete all call the same
 * functions here. Rollback + error-banner messaging is centralized so TreeNode
 * stays a pure view and error handling doesn't drift between callsites.
 *
 * `VIRTUAL_ROOT` + `isSameVirtualTree` are the single source of truth for
 * cross-root forbid: both drag-drop (TreeNode.isValidDropTarget) and
 * MoveToDialog candidate filtering import from here.
 */
import { apiFetch } from '$lib/api';
import type { ExplorerNode, NodeSource } from './node';
import type { ExplorerState } from './explorer-state.svelte';

interface ApiErrorBody {
	error?: { code?: string; message?: string; fields?: Record<string, string> };
}

async function parseError(res: Response): Promise<ApiErrorBody['error']> {
	try {
		const body = (await res.json()) as ApiErrorBody;
		return body.error;
	} catch {
		return undefined;
	}
}

export interface ActionContext {
	/** Clear optimistic UI + trigger a full re-fetch from the server. */
	refresh: () => Promise<void>;
	/** Set the inline error banner text. */
	setError: (msg: string) => void;
	/** Announce to the aria-live region. */
	announce: (msg: string) => void;
}

// ── Cross-root rules ──────────────────────────────────────────────

/**
 * Which virtual root each node source belongs to. Null for the `virtual`
 * source itself — virtual nodes ARE their own roots. Drives both drag-drop
 * target validation and MoveToDialog candidate filtering.
 */
export const VIRTUAL_ROOT: Record<NodeSource, string | null> = {
	'desk-folder': 'virtual:data',
	'desk-file': 'virtual:data',
	'blog-folder': 'virtual:blog',
	'blog-post': 'virtual:blog',
	'asset-folder': 'virtual:assets',
	'blog-asset': 'virtual:assets',
	virtual: null,
};

/**
 * True when two nodes belong to the same virtual root (desk/blog/assets).
 * A virtual node itself is considered to live in its own subtree.
 */
export function isSameVirtualTree(a: ExplorerNode, b: ExplorerNode): boolean {
	const rootA = a.source === 'virtual' ? a.id : VIRTUAL_ROOT[a.source];
	const rootB = b.source === 'virtual' ? b.id : VIRTUAL_ROOT[b.source];
	return rootA !== null && rootA === rootB;
}

// ── Move dispatch ─────────────────────────────────────────────────

type MoveSpec = {
	url: (id: string) => string;
	/** Key in the PATCH body — folders use `parentId`, leaves use `folderId`. */
	payloadKey: 'parentId' | 'folderId';
	method: 'PATCH' | 'PUT';
};

const MOVE_ROUTES: Partial<Record<NodeSource, MoveSpec>> = {
	'desk-folder': {
		url: (id) => `/api/desk/folders/${id}`,
		payloadKey: 'parentId',
		method: 'PUT',
	},
	'desk-file': {
		url: (id) => `/api/desk/files/${id}`,
		payloadKey: 'folderId',
		method: 'PUT',
	},
	'blog-folder': {
		url: (id) => `/api/blog/post-folders/${id}`,
		payloadKey: 'parentId',
		method: 'PATCH',
	},
	'blog-post': {
		url: (id) => `/api/blog/posts/${id}`,
		payloadKey: 'folderId',
		method: 'PATCH',
	},
	'asset-folder': {
		url: (id) => `/api/blog/asset-folders/${id}`,
		payloadKey: 'parentId',
		method: 'PATCH',
	},
	'blog-asset': {
		url: (id) => `/api/blog/assets/${id}`,
		payloadKey: 'folderId',
		method: 'PATCH',
	},
};

/**
 * Move any node to a new parent. Looks up the routing table by `node.source`
 * so one call site serves all six nestable source types.
 *
 * Applies optimistically via `state.moveNode`, dispatches the request, and
 * rolls back with a user-friendly error on failure. Idempotent at the
 * server level.
 */
export async function dispatchMove(
	state: ExplorerState,
	nodeId: string,
	newParentId: string | null,
	ctx: ActionContext,
): Promise<boolean> {
	const node = state.getNode(nodeId);
	if (!node) return false;
	const spec = MOVE_ROUTES[node.source];
	if (!spec) return false;

	const target = newParentId ? state.getNode(newParentId) : null;

	const rollback = state.moveNode(nodeId, newParentId);
	ctx.announce(`Moving ${node.label}.`);

	// Virtual roots map to `null` server-side (leaf.folderId = null / folder.parentId = null).
	const rootId = VIRTUAL_ROOT[node.source];
	const serverParentId = newParentId === rootId ? null : newParentId;
	const payload = { [spec.payloadKey]: serverParentId };

	try {
		const res = await apiFetch(spec.url(nodeId), {
			method: spec.method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});

		if (!res.ok) {
			rollback();
			const err = await parseError(res);
			const code = err?.code;
			const targetLabel = target?.label ?? 'root';

			if (code === 'folder_cycle') {
				ctx.setError('Cannot move a folder into itself or a descendant.');
				ctx.announce(`Cannot move ${node.label} into itself or one of its sub-folders.`);
			} else if (code === 'folder_name_conflict') {
				ctx.setError(`A folder named "${node.label}" already exists in ${targetLabel}.`);
				ctx.announce(`A folder named ${node.label} already exists in ${targetLabel}.`);
			} else if (res.status === 404) {
				ctx.setError('Item not found — refreshing…');
				await ctx.refresh();
			} else {
				ctx.setError(err?.message ?? 'Move failed.');
			}
			return false;
		}

		ctx.announce(`Moved ${node.label} into ${target?.label ?? 'root'}.`);
		return true;
	} catch (e) {
		rollback();
		ctx.setError(e instanceof Error ? e.message : 'Move failed.');
		return false;
	}
}

// ── Folder delete dispatch ────────────────────────────────────────

const FOLDER_DELETE_URLS: Partial<Record<NodeSource, (id: string) => string>> = {
	'desk-folder': (id) => `/api/desk/folders/${id}?recursive=true`,
	'blog-folder': (id) => `/api/blog/post-folders/${id}?recursive=true`,
	'asset-folder': (id) => `/api/blog/asset-folders/${id}?recursive=true`,
};

/**
 * Delete any folder type (desk / blog-post / blog-asset).
 *
 * Always sends `?recursive=true` after the inline confirmation strip in TreeNode —
 * the user already saw the item count and confirmed. Folder-type is inferred
 * from `node.source` so the same handler works for all three.
 */
export async function dispatchDeleteFolder(
	state: ExplorerState,
	nodeId: string,
	ctx: ActionContext,
): Promise<boolean> {
	const node = state.getNode(nodeId);
	if (!node) return false;

	const url = FOLDER_DELETE_URLS[node.source]?.(nodeId);
	if (!url) return false;

	try {
		const res = await apiFetch(url, { method: 'DELETE' });
		if (!res.ok) {
			const err = await parseError(res);
			if (res.status === 404) {
				ctx.setError('Folder not found — refreshing…');
			} else {
				ctx.setError(err?.message ?? 'Delete failed.');
			}
			await ctx.refresh();
			return false;
		}
		await ctx.refresh();
		ctx.announce(`Deleted ${node.label}.`);
		return true;
	} catch (e) {
		ctx.setError(e instanceof Error ? e.message : 'Delete failed.');
		await ctx.refresh();
		return false;
	}
}
