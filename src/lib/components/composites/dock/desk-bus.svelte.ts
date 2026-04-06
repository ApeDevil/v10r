/**
 * Typed pub/sub for cross-panel communication in the Desk.
 * Follows the same factory + context pattern as dock.state.svelte.ts.
 */

import { getContext, setContext } from 'svelte';

// ── Event types ──────────────────────��───────────────────────────────

export interface DeskEvents {
	'editor:content': { content: string; type: string; metadata: Record<string, unknown> };
	'editor:document': { documentId: string; type: string } | null;
	'editor:save': { documentId: string; revisionId: string };
	'files:select': {
		type: 'post' | 'asset';
		id: string;
		data: Record<string, unknown>;
	} | null;
	'files:insert-image': {
		assetId: string;
		fileName: string;
		altText: string;
		downloadUrl: string;
		/** Unique nonce to deduplicate replayed events across panel remounts. */
		_nonce: string;
	};

	// ── AI tool dispatch events ──���───────────────────────────────────

	/** AI requests a tool call — dispatched by ChatPanel onToolCall */
	'ai:toolCall': {
		toolCallId: string;
		toolName: string;
		args: Record<string, unknown>;
		turnId: string;
		_nonce: string;
	};

	/** Tool execution result — dispatched after handler executes */
	'ai:toolResult': {
		toolCallId: string;
		toolName: string;
		result: string;
		turnId: string;
		_nonce: string;
	};

	/** AI requests a spreadsheet cell write */
	'spreadsheet:setCell': {
		panelId: string;
		cell: string;
		value: string | number;
		turnId: string;
		_nonce: string;
	};

	/** AI requests an editor write */
	'editor:aiWrite': {
		panelId: string;
		content: string;
		mode: 'append' | 'replace' | 'prepend';
		turnId: string;
		_nonce: string;
	};
}

export interface SubscribeOptions {
	/** Replay the last published payload immediately on subscribe. */
	replayLast?: boolean;
}

// ── Dedup helper ────────────────────────────────────────────────────

/** Wrap a handler to skip duplicate _nonce values. Caps internal set at 200 entries. */
export function deduped<T extends { _nonce: string }>(
	handler: (payload: T) => void,
): (payload: T) => void {
	const seen = new Set<string>();
	return (payload: T) => {
		if (seen.has(payload._nonce)) return;
		seen.add(payload._nonce);
		if (seen.size > 200) {
			const first = seen.values().next().value;
			if (first) seen.delete(first);
		}
		handler(payload);
	};
}

// ── Bus implementation ───────────────────────────────────────────────

const DESK_BUS_CTX = Symbol('desk-bus');

export function createDeskBus() {
	const listeners = new Map<keyof DeskEvents, Set<(payload: any) => void>>();
	const lastPayload = new Map<keyof DeskEvents, unknown>();

	function publish<K extends keyof DeskEvents>(channel: K, payload: DeskEvents[K]): void {
		lastPayload.set(channel, payload);
		const subs = listeners.get(channel);
		if (subs) {
			for (const handler of subs) handler(payload);
		}
	}

	function subscribe<K extends keyof DeskEvents>(
		channel: K,
		handler: (payload: DeskEvents[K]) => void,
		options?: SubscribeOptions,
	): () => void {
		let subs = listeners.get(channel);
		if (!subs) {
			subs = new Set();
			listeners.set(channel, subs);
		}
		subs.add(handler as (payload: any) => void);

		// Replay last value if requested and available — deferred via microtask
		// to avoid $state writes during $effect initialization
		if (options?.replayLast && lastPayload.has(channel)) {
			const payload = lastPayload.get(channel) as DeskEvents[K];
			queueMicrotask(() => handler(payload));
		}

		return () => {
			subs!.delete(handler as (payload: any) => void);
			if (subs!.size === 0) listeners.delete(channel);
		};
	}

	return { publish, subscribe };
}

export type DeskBus = ReturnType<typeof createDeskBus>;

export function setDeskBusContext(): DeskBus {
	const bus = createDeskBus();
	setContext(DESK_BUS_CTX, bus);
	return bus;
}

export function getDeskBus(): DeskBus {
	return getContext<DeskBus>(DESK_BUS_CTX);
}
