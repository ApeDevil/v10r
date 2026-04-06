/**
 * Entity/write registry for the Desk — the WRITE counterpart to desk-context.svelte.ts (READ).
 *
 * Panels register mutation operations that the AI can invoke via tool calls.
 * Follows the same module-level $state + Map + queueMicrotask pattern
 * as panel-menus.svelte.ts and desk-context.svelte.ts.
 */

import { clearUndoForPanel } from './desk-undo.svelte';

// ── Types ��───────────────────────────────────────────────────────────

/** A single mutation operation a panel exposes to the AI */
export interface EntityOperation {
	/** Tool name this operation maps to (e.g. 'spreadsheet_setCell') */
	toolName: string;
	/** Human-readable description for the AI system prompt */
	description: string;
	/** Execute the mutation. Returns a result string for addToolResult.
	 *  MUST be synchronous — AI SDK v4 constraint (never await in onToolCall). */
	execute: (args: Record<string, unknown>) => string;
	/** Capture state before mutation — called before execute() for undo support */
	snapshot?: () => unknown;
	/** Restore from a snapshot — called on undo */
	restore?: (snapshot: unknown) => void;
}

/** What a panel registers as its writable surface */
export interface PanelEntity {
	panelId: string;
	panelType: string;
	label: string;
	operations: EntityOperation[];
}

/** Serialized for the request payload — tells the server which tools to expose */
export interface SerializedEntity {
	panelType: string;
	label: string;
	toolNames: string[];
}

// ── Module-level state ─���─────────────────────────────────────────────

/** Reactive registry version — bumped on every register/unregister to signal changes */
let registryVersion = $state(0);

/** Non-reactive storage for panel entities */
const registry = new Map<string, PanelEntity>();

// ── Public API ───────────────────────────────────────────────────────

/**
 * Register an entity for a panel. Call inside a $effect so it re-runs
 * when operations change. Returns a cleanup function.
 */
export function registerPanelEntity(entity: PanelEntity): () => void {
	registry.set(entity.panelId, entity);
	queueMicrotask(() => { registryVersion++; });
	return () => {
		registry.delete(entity.panelId);
		clearUndoForPanel(entity.panelId);
		queueMicrotask(() => { registryVersion++; });
	};
}

/** Update an existing entity without full re-registration */
export function updatePanelEntity(
	panelId: string,
	partial: Partial<Omit<PanelEntity, 'panelId'>>,
): void {
	const existing = registry.get(panelId);
	if (!existing) return;
	registry.set(panelId, { ...existing, ...partial });
	queueMicrotask(() => { registryVersion++; });
}

/**
 * Find the handler for a tool call by toolName.
 * Searches across all registered entities. Returns null if not found.
 */
export function resolveToolHandler(
	toolName: string,
): { entity: PanelEntity; operation: EntityOperation } | null {
	void registryVersion; // establish reactive dependency
	for (const entity of registry.values()) {
		const op = entity.operations.find((o) => o.toolName === toolName);
		if (op) return { entity, operation: op };
	}
	return null;
}

/** All tool names across all registered entities — for building the AI request */
export function getAvailableToolNames(): string[] {
	void registryVersion;
	const names: string[] = [];
	for (const entity of registry.values()) {
		for (const op of entity.operations) {
			names.push(op.toolName);
		}
	}
	return names;
}

/** Serialize entities for the request payload */
export function serializeEntitiesForRequest(): SerializedEntity[] {
	void registryVersion;
	return Array.from(registry.values()).map((e) => ({
		panelType: e.panelType,
		label: e.label,
		toolNames: e.operations.map((o) => o.toolName),
	}));
}

/** Check if any entities are registered */
export function hasEntities(): boolean {
	void registryVersion;
	return registry.size > 0;
}
