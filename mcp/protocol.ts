/**
 * JSON-RPC 2.0 plumbing for the newline-delimited MCP stdio transport.
 * One JSON message per line; responses are compact-stringified (never pretty-printed,
 * so no embedded newlines can corrupt the stream).
 */
export type Id = string | number | null;

export interface RpcMessage {
	jsonrpc?: string;
	id?: Id;
	method?: string;
	params?: unknown;
}

export const ERR = {
	PARSE: -32700,
	INVALID_REQ: -32600,
	NO_METHOD: -32601,
	BAD_PARAMS: -32602,
	INTERNAL: -32603,
} as const;

export type ParseOutcome =
	| { kind: 'message'; msg: RpcMessage }
	| { kind: 'batch' }
	| { kind: 'invalid' }
	| { kind: 'parse-error' };

export function parseLine(line: string): ParseOutcome {
	let data: unknown;
	try {
		data = JSON.parse(line);
	} catch {
		return { kind: 'parse-error' };
	}
	if (Array.isArray(data)) {
		return { kind: 'batch' };
	}
	if (typeof data !== 'object' || data === null) {
		return { kind: 'invalid' };
	}
	return { kind: 'message', msg: data as RpcMessage };
}

/** A message is a notification when it carries no `id` key at all. */
export function isNotification(msg: RpcMessage): boolean {
	return !('id' in msg);
}

export function ok(id: Id, result: unknown): string {
	return `${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`;
}

export function err(id: Id, code: number, message: string, data?: unknown): string {
	const error = data === undefined ? { code, message } : { code, message, data };
	return `${JSON.stringify({ jsonrpc: '2.0', id, error })}\n`;
}

/**
 * Incremental NDJSON line splitter. Feed it decoded chunks; it yields complete lines
 * (CR-stripped, empties skipped) and buffers the trailing partial line.
 */
export function createLineBuffer(): { push: (chunk: string) => string[]; flush: () => string[] } {
	let pending = '';
	const clean = (lines: string[]): string[] =>
		lines.map((line) => line.replace(/\r$/, '').trim()).filter((line) => line.length > 0);
	return {
		push(chunk: string): string[] {
			pending += chunk;
			const parts = pending.split('\n');
			pending = parts.pop() ?? '';
			return clean(parts);
		},
		flush(): string[] {
			const rest = pending;
			pending = '';
			return clean([rest]);
		},
	};
}
