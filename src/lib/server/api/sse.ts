/**
 * SSE (Server-Sent Events) utilities with reconnection support.
 *
 * Standard SSE event format:
 *   event: <type>\nid: <prefix>:<counter>\ndata: <json>\n\n
 *
 * Features:
 * - Named events (event: field) for client-side addEventListener routing
 * - Auto-incrementing event IDs for Last-Event-ID reconnection
 * - Ring buffer for missed event replay on reconnect
 * - Heartbeat via SSE comment (: heartbeat)
 * - retry: hint for browser reconnection interval
 */

const DEFAULT_BUFFER_SIZE = 100;
const DEFAULT_HEARTBEAT_MS = 25_000;
const DEFAULT_RETRY_MS = 3_000;

interface SSEEvent {
	type: string;
	data: unknown;
	id: string;
}

/** Ring buffer storing recent events for Last-Event-ID replay. */
export class SSEBuffer {
	private events: SSEEvent[] = [];
	private counter = 0;
	private readonly maxSize: number;
	readonly prefix: string;

	constructor(prefix: string, maxSize = DEFAULT_BUFFER_SIZE) {
		this.prefix = prefix;
		this.maxSize = maxSize;
	}

	/** Push an event and return its assigned ID. */
	push(type: string, data: unknown): string {
		this.counter++;
		const id = `${this.prefix}:${this.counter}`;
		const event: SSEEvent = { type, data, id };

		this.events.push(event);
		if (this.events.length > this.maxSize) {
			this.events.shift();
		}

		return id;
	}

	/** Get events after the given ID for replay. Returns null if ID is too old. */
	getAfter(lastEventId: string): SSEEvent[] | null {
		const parts = lastEventId.split(':');
		const lastCounter = Number.parseInt(parts[parts.length - 1], 10);
		if (Number.isNaN(lastCounter)) return null;

		const startIdx = this.events.findIndex((e) => {
			const c = Number.parseInt(e.id.split(':').pop()!, 10);
			return c > lastCounter;
		});

		if (startIdx === -1) {
			// Either all events are older or the ID is too far back
			if (this.events.length > 0) {
				const oldestCounter = Number.parseInt(this.events[0].id.split(':').pop()!, 10);
				if (lastCounter < oldestCounter) return null; // gap — can't replay
			}
			return []; // no new events
		}

		return this.events.slice(startIdx);
	}
}

/** Format a single SSE event string. */
export function formatSSEEvent(type: string, data: unknown, id: string): string {
	return `event: ${type}\nid: ${id}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Format the SSE retry hint (sent once at connection start). */
export function formatRetryHint(ms = DEFAULT_RETRY_MS): string {
	return `retry: ${ms}\n\n`;
}

/** Format an SSE heartbeat comment. */
export function formatHeartbeat(): string {
	return `: heartbeat\n\n`;
}

/** Parse the Last-Event-ID header from a request. */
export function getLastEventId(request: Request): string | null {
	return request.headers.get('Last-Event-ID');
}

/** Standard SSE response headers. */
export const SSE_HEADERS = {
	'Content-Type': 'text/event-stream',
	'Cache-Control': 'no-cache, no-transform',
	'X-Accel-Buffering': 'no',
} as const;

export { DEFAULT_HEARTBEAT_MS };
