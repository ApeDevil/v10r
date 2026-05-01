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
import type { ExplorerState } from './explorer-state.svelte';
import type { ExplorerNode, NodeSource } from './node';
import type { FileListItem } from './types';

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
export async function dispatchDeleteFolder(state: ExplorerState, nodeId: string, ctx: ActionContext): Promise<boolean> {
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

// ── Rename dispatch ───────────────────────────────────────────────

type RenameSpec = {
	url: (id: string) => string;
	method: 'PUT' | 'PATCH';
	body: (label: string) => Record<string, string>;
	/** When true, ignore non-OK responses (legacy lenient endpoints — desk-file, blog-post, blog-asset). */
	silent?: boolean;
};

const RENAME_ROUTES: Partial<Record<NodeSource, RenameSpec>> = {
	'desk-file': {
		url: (id) => `/api/desk/files/${id}`,
		method: 'PUT',
		body: (label) => ({ name: label }),
		silent: true,
	},
	'desk-folder': {
		url: (id) => `/api/desk/folders/${id}`,
		method: 'PUT',
		body: (label) => ({ name: label }),
	},
	'blog-folder': {
		url: (id) => `/api/blog/post-folders/${id}`,
		method: 'PATCH',
		body: (label) => ({ name: label }),
	},
	'asset-folder': {
		url: (id) => `/api/blog/asset-folders/${id}`,
		method: 'PATCH',
		body: (label) => ({ name: label }),
	},
	'blog-post': {
		url: (id) => `/api/blog/posts/${id}`,
		method: 'PATCH',
		body: (label) => ({ slug: label.replace(/\.md$/, '') }),
		silent: true,
	},
	'blog-asset': {
		url: (id) => `/api/blog/assets/${id}`,
		method: 'PATCH',
		body: (label) => ({ fileName: label }),
		silent: true,
	},
};

/**
 * Rename a node. The TreeNode passes the node with the already-mutated `label`,
 * so this dispatcher just sends it. On failure, refreshes from server to revert
 * the optimistic update.
 */
export async function dispatchRename(_state: ExplorerState, node: ExplorerNode, ctx: ActionContext): Promise<void> {
	const spec = RENAME_ROUTES[node.source];
	if (!spec) return;

	try {
		const res = await apiFetch(spec.url(node.id), {
			method: spec.method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(spec.body(node.label)),
		});
		if (!spec.silent && !res.ok) {
			const err = await parseError(res);
			throw new Error(err?.message ?? 'Rename failed');
		}
		await ctx.refresh();
	} catch (e) {
		ctx.setError(e instanceof Error ? e.message : 'Rename failed');
		await ctx.refresh(); // Revert optimistic update
	}
}

// ── Leaf delete dispatch (non-folder) ─────────────────────────────

type LeafDeleteSpec = {
	url: (id: string) => string;
	/** When true, parse error body and throw on !ok (legacy strict endpoint — blog-asset). */
	strict?: boolean;
};

const LEAF_DELETE_ROUTES: Partial<Record<NodeSource, LeafDeleteSpec>> = {
	'desk-file': { url: (id) => `/api/desk/files/${id}` },
	'blog-post': { url: (id) => `/api/blog/posts/${id}` },
	'blog-asset': { url: (id) => `/api/blog/assets/${id}`, strict: true },
};

/**
 * Delete a non-folder leaf (desk-file, blog-post, blog-asset). For folders use
 * `dispatchDeleteFolder` — they require recursive=true and a different state
 * machine. Caller is responsible for clearing any UI selection (e.g. the asset
 * preview) before invoking.
 */
export async function dispatchDeleteLeaf(_state: ExplorerState, node: ExplorerNode, ctx: ActionContext): Promise<void> {
	const spec = LEAF_DELETE_ROUTES[node.source];
	if (!spec) return;

	try {
		const res = await apiFetch(spec.url(node.id), { method: 'DELETE' });
		if (spec.strict && !res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error((data as { message?: string }).message || 'Delete failed');
		}
		await ctx.refresh();
	} catch (e) {
		ctx.setError(e instanceof Error ? e.message : 'Delete failed');
	}
}

// ── Duplicate dispatch (desk-file only) ───────────────────────────

/**
 * Duplicate a desk file. Refreshes, then enters rename mode on the copy so the
 * user can immediately retitle it.
 */
export async function dispatchDuplicate(state: ExplorerState, node: ExplorerNode, ctx: ActionContext): Promise<void> {
	if (node.source !== 'desk-file') return;
	try {
		const res = await apiFetch(`/api/desk/files/${node.id}`, { method: 'POST' });
		if (!res.ok) throw new Error('Duplicate failed');
		const {
			data: { file: newFile },
		} = (await res.json()) as { data: { file: { id: string } } };
		await ctx.refresh();
		state.startRename(newFile.id);
	} catch (e) {
		ctx.setError(e instanceof Error ? e.message : 'Duplicate failed');
	}
}

// ── AI context toggle dispatch ────────────────────────────────────

/**
 * Toggle a node's AI context pin. Optimistic with rollback on failure. Desk
 * files persist server-side; blog posts are client-state only (no API call).
 */
export async function dispatchToggleAiContext(
	state: ExplorerState,
	node: ExplorerNode,
	ctx: ActionContext,
): Promise<void> {
	const newValue = !node.aiContext;
	state.updateAiContext(node.id, newValue);

	if (node.source !== 'desk-file') return;

	try {
		await apiFetch(`/api/desk/files/${node.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ aiContext: newValue }),
		});
	} catch (e) {
		state.updateAiContext(node.id, !newValue); // Rollback
		ctx.setError(e instanceof Error ? e.message : 'Failed to toggle AI context');
	}
}

// ── New folder dispatch ───────────────────────────────────────────

const FOLDER_ENDPOINTS: Record<string, string> = {
	'virtual:data': '/api/desk/folders',
	'virtual:blog': '/api/blog/post-folders',
	'virtual:assets': '/api/blog/asset-folders',
};

function resolveVirtualRoot(node: ExplorerNode): string {
	if (node.source === 'virtual') return node.id;
	return VIRTUAL_ROOT[node.source] ?? 'virtual:data';
}

/**
 * Create a new folder under the appropriate virtual root. Non-virtual folders
 * receive the new folder as a direct child; leaves create a sibling. After
 * creation, expands the parent so the new folder lands visible and enters
 * rename mode on it.
 */
export async function dispatchNewFolder(state: ExplorerState, node: ExplorerNode, ctx: ActionContext): Promise<void> {
	const virtualRoot = resolveVirtualRoot(node);
	const endpoint = FOLDER_ENDPOINTS[virtualRoot];
	if (!endpoint) {
		ctx.setError('Folders are not supported here.');
		return;
	}

	let parentId: string | null = null;
	if (node.source !== 'virtual') {
		parentId = node.isFolder ? node.id : node.parentId && !node.parentId.startsWith('virtual:') ? node.parentId : null;
	}

	try {
		const res = await apiFetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ parentId }),
		});
		if (!res.ok) throw new Error('Failed to create folder');
		const {
			data: { folder },
		} = (await res.json()) as { data: { folder: { id: string } } };
		await ctx.refresh();
		state.startRename(folder.id);
		if (parentId) state.expanded.add(parentId);
		else state.expanded.add(virtualRoot);
	} catch (e) {
		ctx.setError(e instanceof Error ? e.message : 'Failed to create folder');
	}
}

// ── New spreadsheet dispatch ──────────────────────────────────────

/**
 * Create a new spreadsheet under the given anchor (folder or virtual root).
 * The created file is passed back via `onCreated` so the panel can open it in
 * the dock — keeps DOM/dock concerns out of this module.
 */
export async function dispatchNewSpreadsheet(
	_state: ExplorerState,
	node: ExplorerNode,
	ctx: ActionContext,
	onCreated: (file: FileListItem) => void,
): Promise<void> {
	const folderId = node.source === 'virtual' ? null : node.id;
	try {
		const res = await apiFetch('/api/desk/files', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'spreadsheet', name: 'Untitled', folderId }),
		});
		if (!res.ok) throw new Error('Failed to create spreadsheet');
		const {
			data: { file },
		} = (await res.json()) as {
			data: {
				file: { id: string; name: string; folderId: string | null; createdAt: string; updatedAt: string };
			};
		};
		await ctx.refresh();
		onCreated({
			id: file.id,
			type: 'spreadsheet',
			name: file.name,
			folderId: file.folderId ?? null,
			aiContext: false,
			createdAt: file.createdAt,
			updatedAt: file.updatedAt,
		});
	} catch (e) {
		ctx.setError(e instanceof Error ? e.message : 'Failed to create spreadsheet');
	}
}
