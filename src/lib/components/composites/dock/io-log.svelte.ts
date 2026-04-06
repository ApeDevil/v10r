/**
 * I/O Log — ephemeral client state for AI context monitoring.
 * Module-level $state — same pattern as desk-context.svelte.ts.
 * Any component that imports getIOLogEntries() gets reactive updates.
 */

export type IOLogSource = 'tool-call' | 'tool-result' | 'context-read' | 'progress' | 'effect';

export interface IOLogEntry {
	id: string;
	timestamp: number;
	source: IOLogSource;
	toolName?: string;
	label: string;
	detail?: string;
	level?: 'info' | 'success' | 'error';
}

const MAX_ENTRIES = 200;

let entries = $state<IOLogEntry[]>([]);

export function appendIOLog(entry: Omit<IOLogEntry, 'id' | 'timestamp'>): void {
	const newEntry: IOLogEntry = {
		id: crypto.randomUUID(),
		timestamp: Date.now(),
		...entry,
	};
	if (entries.length >= MAX_ENTRIES) {
		entries = [...entries.slice(1), newEntry];
	} else {
		entries = [...entries, newEntry];
	}
}

export function clearIOLog(): void {
	entries = [];
}

export function getIOLogEntries(): IOLogEntry[] {
	return entries;
}

export function getIOLogCount(): number {
	return entries.length;
}
