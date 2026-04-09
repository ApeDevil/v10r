/**
 * Workspace persistence via localStorage.
 * Follows desk-settings.persistence.ts pattern.
 */
import { browser } from '$app/environment';
import type { Workspace } from './workspace.types';

const DEFAULT_KEY = 'desk-workspaces';
const CURRENT_VERSION = 1;

export interface WorkspacesPersistedState {
	version: number;
	activeId: string | null;
	workspaces: Workspace[];
}

export function saveWorkspaceStore(workspaces: Workspace[], activeId: string | null, storageKey = DEFAULT_KEY): void {
	if (!browser) return;
	try {
		const state: WorkspacesPersistedState = { version: CURRENT_VERSION, activeId, workspaces };
		localStorage.setItem(storageKey, JSON.stringify(state));
	} catch {
		// Silently fail (e.g., storage full)
	}
}

export function loadWorkspaceStore(storageKey = DEFAULT_KEY): WorkspacesPersistedState | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(storageKey);
		if (!raw) return null;

		const state = JSON.parse(raw) as WorkspacesPersistedState;
		if (!state || state.version !== CURRENT_VERSION) return null;
		if (!Array.isArray(state.workspaces)) return null;

		return state;
	} catch {
		return null;
	}
}

export function clearWorkspaceStore(storageKey = DEFAULT_KEY): void {
	if (!browser) return;
	localStorage.removeItem(storageKey);
}

/**
 * Build workspace list from server-provided data (DB rows).
 */
export function buildWorkspacesFromServer(
	serverWorkspaces: Array<{
		id: string;
		name: string;
		layout: unknown;
		sortOrder: number;
		createdAt: string;
		updatedAt: string;
	}>,
): Workspace[] {
	return serverWorkspaces.map((w) => ({
		id: w.id,
		name: w.name,
		layout: w.layout as Workspace['layout'],
		sortOrder: w.sortOrder,
		createdAt: w.createdAt,
		updatedAt: w.updatedAt,
	}));
}
