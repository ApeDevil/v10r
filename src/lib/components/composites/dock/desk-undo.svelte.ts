/**
 * Undo stack for AI mutations in the Desk.
 *
 * Snapshot-based: captures state before each AI tool execution,
 * restores on undo. Supports batch undo per AI turn via turnId.
 * Follows the same module-level $state pattern as desk-context.svelte.ts.
 */

// ── Types ────────────────────────────────────────────────────────────

export interface UndoSnapshot {
	id: string;
	turnId: string | null;
	panelId: string;
	toolName: string;
	/** Opaque state the panel provided before mutation */
	snapshot: unknown;
	/** Restore function — called on undo */
	restore: (snapshot: unknown) => void;
	timestamp: number;
}

// ── Module-level state ───────────────────────────────────────────────

let stackVersion = $state(0);
const stack: UndoSnapshot[] = [];

const MAX_STACK = 20;

// ── Public API ───────────────────────────────────────────────────────

/** Push an undo entry onto the stack */
export function pushUndo(entry: Omit<UndoSnapshot, 'id' | 'timestamp'>): void {
	stack.push({
		...entry,
		id: crypto.randomUUID(),
		timestamp: Date.now(),
	});
	if (stack.length > MAX_STACK) stack.shift();
	queueMicrotask(() => { stackVersion++; });
}

/** Undo the last action. Returns true if something was undone. */
export function undo(): boolean {
	const entry = stack.pop();
	if (!entry) return false;
	entry.restore(entry.snapshot);
	queueMicrotask(() => { stackVersion++; });
	return true;
}

/** Undo all actions from a specific AI turn (batch undo). */
export function undoTurn(turnId: string): boolean {
	let undone = false;
	// Pop from the end, undoing entries with matching turnId
	while (stack.length > 0 && stack[stack.length - 1].turnId === turnId) {
		const entry = stack.pop()!;
		entry.restore(entry.snapshot);
		undone = true;
	}
	if (undone) queueMicrotask(() => { stackVersion++; });
	return undone;
}

/** Get current stack size (reactive) */
export function getUndoStackSize(): number {
	void stackVersion;
	return stack.length;
}

/** Peek at the top of the stack without popping (reactive) */
export function peekUndo(): UndoSnapshot | null {
	void stackVersion;
	return stack.length > 0 ? stack[stack.length - 1] : null;
}

/** Remove all undo entries for a specific panel (call when panel unregisters) */
export function clearUndoForPanel(panelId: string): void {
	const before = stack.length;
	for (let i = stack.length - 1; i >= 0; i--) {
		if (stack[i].panelId === panelId) stack.splice(i, 1);
	}
	if (stack.length !== before) queueMicrotask(() => { stackVersion++; });
}

/** Clear the entire undo stack */
export function clearUndoStack(): void {
	stack.length = 0;
	queueMicrotask(() => { stackVersion++; });
}
