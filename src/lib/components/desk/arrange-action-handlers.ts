/**
 * The Desk's handlers for its client actions (`#lib/desk/arrange-actions.ts`) — the
 * Svelte-side adapter of the client action contract.
 *
 * Each handler does three things in order: check the precondition against the LIVE dock
 * (the model's picture of the workspace is as old as its last turn), act through the same
 * verbs every human gesture uses (`focusPanel`, `addPanel`, `closePanel`), then read the
 * dock back and report what it sees. A handler never answers `completed` on the strength
 * of having called something — only on the state it observed afterwards.
 *
 * The agent gets less than the user here, on purpose: it cannot close a panel with
 * unsaved work (the user's own close asks first; an agent's would destroy a buffer
 * nobody confirmed) and it cannot close the conversation it is speaking through.
 */
import type { ClientActionResult } from '#lib/client-actions/contract.ts';
import type { ClientActionHandler, ClientActionRunner } from '#lib/client-actions/runner.ts';
import {
	DESK_CLOSE_PANEL,
	DESK_FOCUS_PANEL,
	DESK_OPEN_FILE,
	type DeskClosePanelInput,
	type DeskFocusPanelInput,
	type DeskOpenFileInput,
} from '#lib/desk/arrange-actions.ts';
import type { LayoutNode, LeafNode } from '#lib/desk/layout.types.ts';
import { DESK_PANELS } from '#lib/desk/panels.ts';
import { collectLeaves, findLeafWithPanel, getDepth } from './dock.operations';
import { type DockState, MAX_DOCK_DEPTH } from './dock.state.svelte';
import { filePanelId, findFilePanel } from './file-panel';
import { focusPanel } from './panel-actions';

/** The desk file types that have a panel of their own; the panel type is the file type. */
const FILE_PANEL_TYPES = ['spreadsheet', 'markdown', 'record'] as const;

type FilePanelType = (typeof FILE_PANEL_TYPES)[number];

/** What opening needs to know about a file — read from the server, never taken from the model. */
export interface ArrangeFile {
	id: string;
	name: string;
	type: string;
}

export interface ArrangeDesk {
	dock: DockState;
	/** The panel the conversation lives in: never covered by `auto`, never closed. */
	conversationPanelId: string;
	/**
	 * The signed-in user's file by id, or null when they have no such file. The server
	 * answers for the session's user only, so a file id the model was tricked into
	 * naming opens nothing that user could not open by hand.
	 */
	loadFile(fileId: string, signal: AbortSignal): Promise<ArrangeFile | null>;
}

const isFilePanelType = (type: string): type is FilePanelType => (FILE_PANEL_TYPES as readonly string[]).includes(type);

/** The pane furthest right: the second child of every side-by-side split, the top of a stacked one. */
function rightmostLeaf(node: LayoutNode): LeafNode {
	if (node.type === 'leaf') return node;
	return rightmostLeaf(node.direction === 'horizontal' ? node.children[1] : node.children[0]);
}

/** True when `panelId` is the front tab of its leaf and that leaf holds focus. */
function isFront(dock: DockState, panelId: string): boolean {
	return findLeafWithPanel(dock.root, panelId)?.activeTab === panelId && dock.focusedPanelId === panelId;
}

function openFile(desk: ArrangeDesk): ClientActionHandler<DeskOpenFileInput> {
	return async ({ file_id, placement = 'auto' }, { signal }): Promise<ClientActionResult> => {
		const { dock } = desk;
		const file = await desk.loadFile(file_id, signal);
		if (!file) {
			return { status: 'failed', code: 'not_found', message: `No desk file ${file_id} belongs to this user.` };
		}
		if (!isFilePanelType(file.type)) {
			return { status: 'refused', code: 'no_panel_for_type', message: `A ${file.type} file has no desk panel.` };
		}
		// The load took a network round trip: nobody may be waiting for this any more.
		if (signal.aborted) return { status: 'timed_out', code: 'timeout' };

		const open = findFilePanel(dock.root, dock.panels, file.type, file.id);
		const panelId = open ?? filePanelId(file.type, file.id);
		let placed: 'existing' | 'tab' | 'split' = 'existing';
		if (open) {
			focusPanel(dock, open);
		} else {
			const conversationLeaf = findLeafWithPanel(dock.root, desk.conversationPanelId);
			const canSplit = getDepth(dock.root) < MAX_DOCK_DEPTH;
			const target =
				placement === 'right'
					? rightmostLeaf(dock.root)
					: (collectLeaves(dock.root).find((leaf) => leaf.id !== conversationLeaf?.id) ?? conversationLeaf);
			// Joining the conversation's own leaf would hide the conversation behind the file:
			// the file gets a pane to the right instead, while the tree still has room for one.
			const split = !!target && target.id === conversationLeaf?.id && canSplit;
			placed = split ? 'split' : 'tab';
			dock.addPanel(
				{
					id: panelId,
					type: file.type,
					label: file.name,
					icon: DESK_PANELS[file.type]?.icon,
					closable: true,
					meta: { fileId: file.id },
				},
				target ? { leafId: target.id, zone: split ? 'right' : 'center' } : undefined,
			);
		}

		if (!isFront(dock, panelId)) {
			return {
				status: 'failed',
				code: 'not_confirmed',
				message: 'The panel was requested but is not the front panel of the workspace.',
				observed: { panel_id: panelId, open: !!findLeafWithPanel(dock.root, panelId) },
			};
		}
		return {
			status: 'completed',
			observed: { panel_id: panelId, file_id: file.id, panel_type: file.type, placed, front: true },
		};
	};
}

function focus(desk: ArrangeDesk): ClientActionHandler<DeskFocusPanelInput> {
	return ({ panel_id }): ClientActionResult => {
		const { dock } = desk;
		if (!focusPanel(dock, panel_id)) return targetMissing(panel_id);
		if (!isFront(dock, panel_id)) {
			return { status: 'failed', code: 'not_confirmed', message: 'The panel did not come to the front.' };
		}
		return { status: 'completed', observed: { panel_id, front: true } };
	};
}

function close(desk: ArrangeDesk): ClientActionHandler<DeskClosePanelInput> {
	return ({ panel_id }): ClientActionResult => {
		const { dock } = desk;
		const panel = dock.panels[panel_id];
		if (!findLeafWithPanel(dock.root, panel_id)) {
			// A closed panel stays registered so it can be reopened: closing it again is a
			// no-op that already holds, not a missing target.
			return panel
				? { status: 'completed', observed: { panel_id, open: false, already_closed: true } }
				: targetMissing(panel_id);
		}
		if (panel_id === desk.conversationPanelId) {
			return {
				status: 'refused',
				code: 'own_panel',
				message: 'The conversation panel is not closed by the assistant.',
			};
		}
		if (panel?.closable === false) {
			return { status: 'refused', code: 'not_closable', message: 'This panel cannot be closed.' };
		}
		if (panel?.indicator === 'unsaved' || panel?.indicator === 'saving') {
			return {
				status: 'refused',
				code: 'unsaved_work',
				message: 'The panel holds unsaved work. Only the user closes a panel with unsaved work.',
			};
		}
		dock.closePanel(panel_id);
		if (findLeafWithPanel(dock.root, panel_id)) {
			return { status: 'failed', code: 'not_confirmed', message: 'The panel is still open.' };
		}
		return { status: 'completed', observed: { panel_id, open: false } };
	};
}

function targetMissing(panelId: string): ClientActionResult {
	return {
		status: 'unavailable',
		code: 'target_missing',
		message: `No open panel has the id ${panelId.slice(0, 80)}. Read desk_get_open_panels again; the workspace changed.`,
	};
}

/**
 * Mount the Desk's handlers on a runner for as long as the desk they operate is mounted.
 * Returns the cleanup that takes all of them back.
 */
export function mountArrangeHandlers(runner: ClientActionRunner, desk: ArrangeDesk): () => void {
	const unmount = [
		runner.register(DESK_OPEN_FILE, openFile(desk)),
		runner.register(DESK_FOCUS_PANEL, focus(desk)),
		runner.register(DESK_CLOSE_PANEL, close(desk)),
	];
	return () => {
		for (const off of unmount) off();
	};
}
