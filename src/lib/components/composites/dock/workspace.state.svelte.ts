/**
 * Workspace state management (SSR-safe using context pattern).
 * Follows dock.state.svelte.ts / desk-settings.svelte.ts pattern:
 * factory + Symbol + get/set context.
 *
 * The workspace manager orchestrates switching between saved layouts.
 * It depends on DockState (reads/writes via setRoot/setPanels) but
 * does not own it.
 */
import { getContext, setContext } from 'svelte';
import type { DockState } from './dock.state.svelte';
import type { DockLayoutState, LayoutNode, PanelDefinition } from './dock.types';
import type { Workspace } from './workspace.types';
import { MAX_WORKSPACES } from './workspace.types';

const WORKSPACE_CTX = Symbol('workspace');

export interface WorkspaceOptions {
	/** Called after workspace list changes, for DB persistence. */
	onSync?: (data: { save?: { id: string; layout: DockLayoutState }; activate: string }) => void;
	/** Called to create a workspace on the server. Returns server-assigned ID. */
	onCreate?: (data: { name: string; layout: DockLayoutState; sortOrder?: number }) => Promise<string | null>;
	/** Called to update a workspace on the server. */
	onUpdate?: (id: string, data: { name?: string; layout?: DockLayoutState; sortOrder?: number }) => Promise<void>;
	/** Called to delete a workspace on the server. */
	onDelete?: (id: string) => Promise<void>;
}

export function createWorkspaceState(
	initial: Workspace[],
	initialActiveId: string | null,
	dock: DockState,
	options: WorkspaceOptions = {},
) {
	let workspaces = $state<Workspace[]>(initial);
	let activeId = $state<string | null>(initialActiveId);
	let isSwitching = $state(false);
	let currentVersion = $state(0);
	let savedVersion = $state(0);

	// ── Derived ──────────────────────────────────────────────────

	const active = $derived(workspaces.find((w) => w.id === activeId) ?? null);
	const isModified = $derived(currentVersion !== savedVersion);

	// ── Snapshot helpers ──────────────────────────────────────────

	function captureLayout(): DockLayoutState {
		return {
			version: 1,
			root: $state.snapshot(dock.root) as LayoutNode,
			panels: $state.snapshot(dock.panels) as Record<string, PanelDefinition>,
			activityBarPosition: dock.activityBarPosition,
		};
	}

	function snapshotCurrent(): void {
		const idx = workspaces.findIndex((w) => w.id === activeId);
		if (idx === -1) return;
		workspaces[idx] = {
			...workspaces[idx],
			layout: captureLayout(),
			updatedAt: new Date().toISOString(),
		};
	}

	// ── Switching ─────────────────────────────────────────────────

	function switchTo(id: string): void {
		if (id === activeId) return;
		const target = workspaces.find((w) => w.id === id);
		if (!target) return;

		// 1. Snapshot current layout into the departing workspace
		const saveData = activeId ? { id: activeId, layout: captureLayout() } : undefined;
		snapshotCurrent();

		// 2. Guard persistence $effect during swap
		isSwitching = true;

		// 3. Apply target workspace's layout
		dock.setRoot(target.layout.root);
		dock.setPanels(target.layout.panels);
		if (target.layout.activityBarPosition) {
			dock.setActivityBarPosition(target.layout.activityBarPosition);
		}

		const _previousActiveId = activeId;
		activeId = id;

		// 4. Reset version counters for the new workspace
		savedVersion = 0;
		currentVersion = 0;

		// 5. Lower guard after effects settle
		queueMicrotask(() => {
			isSwitching = false;
		});

		// 6. Fire-and-forget sync to API
		options.onSync?.({ save: saveData, activate: id });
	}

	// ── CRUD ──────────────────────────────────────────────────────

	async function createWorkspace(name: string): Promise<string | null> {
		if (workspaces.length >= MAX_WORKSPACES) return null;

		const layout = captureLayout();
		const sortOrder = workspaces.length;
		const now = new Date().toISOString();

		// Try to create on server first for real ID
		const serverId = await options.onCreate?.({ name, layout, sortOrder });
		const id = serverId ?? `wsp-${Date.now()}`;

		const workspace: Workspace = {
			id,
			name,
			layout,
			sortOrder,
			createdAt: now,
			updatedAt: now,
		};

		// Snapshot current before switching
		snapshotCurrent();
		workspaces = [...workspaces, workspace];

		// Switch to the new workspace
		isSwitching = true;
		activeId = id;
		savedVersion = 0;
		currentVersion = 0;
		queueMicrotask(() => {
			isSwitching = false;
		});

		return id;
	}

	function renameWorkspace(id: string, name: string): void {
		workspaces = workspaces.map((w) => (w.id === id ? { ...w, name } : w));
		options.onUpdate?.(id, { name });
	}

	async function duplicateWorkspace(id: string): Promise<string | null> {
		const source = workspaces.find((w) => w.id === id);
		if (!source || workspaces.length >= MAX_WORKSPACES) return null;

		const layout = id === activeId ? captureLayout() : source.layout;
		const sortOrder = workspaces.length;
		const now = new Date().toISOString();

		const serverId = await options.onCreate?.({
			name: `${source.name} copy`,
			layout,
			sortOrder,
		});
		const newId = serverId ?? `wsp-${Date.now()}`;

		const workspace: Workspace = {
			id: newId,
			name: `${source.name} copy`,
			layout,
			sortOrder,
			createdAt: now,
			updatedAt: now,
		};

		workspaces = [...workspaces, workspace];
		return newId;
	}

	/**
	 * Delete a workspace. Returns the deleted workspace for undo support.
	 * Does NOT fire the API delete — caller handles the timed undo.
	 */
	function deleteWorkspace(id: string): Workspace | null {
		const idx = workspaces.findIndex((w) => w.id === id);
		if (idx === -1) return null;
		if (workspaces.length <= 1) return null; // can't delete last

		const deleted = workspaces[idx];

		// If deleting the active workspace, switch to next/prev
		if (id === activeId) {
			const nextIdx = idx === workspaces.length - 1 ? idx - 1 : idx + 1;
			switchTo(workspaces[nextIdx].id);
		}

		workspaces = workspaces.filter((w) => w.id !== id);
		return deleted;
	}

	/** Restore a previously deleted workspace (undo). */
	function restoreWorkspace(workspace: Workspace): void {
		workspaces = [...workspaces, workspace].sort((a, b) => a.sortOrder - b.sortOrder);
	}

	/** Confirm deletion on the server (called when undo timer expires). */
	function confirmDelete(id: string): void {
		options.onDelete?.(id);
	}

	function reorderWorkspace(id: string, newIndex: number): void {
		const idx = workspaces.findIndex((w) => w.id === id);
		if (idx === -1 || idx === newIndex) return;

		const reordered = [...workspaces];
		const [moved] = reordered.splice(idx, 1);
		reordered.splice(newIndex, 0, moved);

		// Update sortOrder to match new array positions
		workspaces = reordered.map((w, i) => ({ ...w, sortOrder: i }));
	}

	// ── Called by persistence $effect to track modifications ──────

	function onDockChange(): void {
		currentVersion++;
	}

	function markSaved(): void {
		savedVersion = currentVersion;
	}

	return {
		get workspaces() {
			return workspaces;
		},
		get activeId() {
			return activeId;
		},
		get active() {
			return active;
		},
		get isSwitching() {
			return isSwitching;
		},
		get isModified() {
			return isModified;
		},

		switchTo,
		createWorkspace,
		renameWorkspace,
		duplicateWorkspace,
		deleteWorkspace,
		restoreWorkspace,
		confirmDelete,
		reorderWorkspace,
		onDockChange,
		markSaved,
		captureLayout,
		snapshotCurrent,

		// For persistence layer
		setWorkspaces(ws: Workspace[]) {
			workspaces = ws;
		},
		setActiveId(id: string | null) {
			activeId = id;
		},
	};
}

export type WorkspaceState = ReturnType<typeof createWorkspaceState>;

export function setWorkspaceContext(
	initial: Workspace[],
	initialActiveId: string | null,
	dock: DockState,
	options?: WorkspaceOptions,
): WorkspaceState {
	const state = createWorkspaceState(initial, initialActiveId, dock, options);
	setContext(WORKSPACE_CTX, state);
	return state;
}

export function getWorkspaceContext(): WorkspaceState {
	return getContext<WorkspaceState>(WORKSPACE_CTX);
}
