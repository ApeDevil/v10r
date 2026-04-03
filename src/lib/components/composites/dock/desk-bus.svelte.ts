/**
 * Typed pub/sub for cross-panel communication in the Desk.
 * Follows the same factory + context pattern as dock.state.svelte.ts.
 */

import { getContext, setContext } from 'svelte';

// ── Event types ──────────────────────────────────────────────────────

export interface DeskEvents {
	'editor:content': { content: string; type: string; metadata: Record<string, unknown> };
	'editor:document': { documentId: string; type: string } | null;
	'editor:save': { documentId: string; revisionId: string };
	'files:select': {
		type: 'post' | 'asset' | 'spreadsheet';
		id: string;
		data: Record<string, unknown>;
	} | null;
	'spreadsheet:open': { fileId: string; name: string };
	'files:insert-image': {
		assetId: string;
		fileName: string;
		altText: string;
		downloadUrl: string;
		/** Unique nonce to deduplicate replayed events across panel remounts. */
		_nonce: string;
	};
}

export interface SubscribeOptions {
	/** Replay the last published payload immediately on subscribe. */
	replayLast?: boolean;
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

		// Replay last value if requested and available
		if (options?.replayLast && lastPayload.has(channel)) {
			handler(lastPayload.get(channel) as DeskEvents[K]);
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
