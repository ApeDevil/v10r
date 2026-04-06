/**
 * I/O Log store for Desk + AI monitoring.
 *
 * Passive observer — records all AI tool calls and results.
 * Follows the same module-level $state pattern as desk-context.svelte.ts.
 */

// ── Types ────────────────────────────────────────────────────────────

export type IOEntryKind = 'tool-call' | 'tool-result' | 'context-sent' | 'error';

export interface IOLogEntry {
	id: string;
	timestamp: number;
	turnId: string;
	kind: IOEntryKind;
	toolName?: string;
	toolCallId?: string;
	args?: Record<string, unknown>;
	result?: string;
	error?: string;
}

export interface IOLogTurn {
	turnId: string;
	entries: IOLogEntry[];
	startedAt: number;
}

// ── Module-level state ───────────────────────────────────────────────

let logVersion = $state(0);
let unreadCount = $state(0);
const entries: IOLogEntry[] = [];

const MAX_ENTRIES = 500;

// ── Public API ───────────────────────────────────────────────────────

/** Append an entry to the I/O log */
export function appendIOLog(entry: Omit<IOLogEntry, 'id' | 'timestamp'>): void {
	entries.push({
		...entry,
		id: crypto.randomUUID(),
		timestamp: Date.now(),
	});
	if (entries.length > MAX_ENTRIES) {
		entries.splice(0, entries.length - MAX_ENTRIES);
	}
	queueMicrotask(() => { logVersion++; unreadCount++; });
}

/** Get all entries (reactive) */
export function getIOLogEntries(): IOLogEntry[] {
	void logVersion;
	return [...entries];
}

/** Group entries by turnId (reactive) */
export function getIOLogTurns(): IOLogTurn[] {
	void logVersion;
	const turnMap = new Map<string, IOLogEntry[]>();
	for (const entry of entries) {
		let group = turnMap.get(entry.turnId);
		if (!group) {
			group = [];
			turnMap.set(entry.turnId, group);
		}
		group.push(entry);
	}
	return Array.from(turnMap.entries()).map(([turnId, turnEntries]) => ({
		turnId,
		entries: turnEntries,
		startedAt: turnEntries[0].timestamp,
	}));
}

/** Get unread count (reactive) */
export function getUnreadCount(): number {
	return unreadCount;
}

/** Mark all entries as read */
export function markAllRead(): void {
	queueMicrotask(() => { unreadCount = 0; });
}

/** Clear the entire log */
export function clearIOLog(): void {
	entries.length = 0;
	queueMicrotask(() => { logVersion++; unreadCount = 0; });
}
