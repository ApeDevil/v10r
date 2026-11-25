/**
 * The identity of a press on a generative surface, without the schema — the chat session
 * (an eagerly loaded module) reads it, so this file imports nothing at runtime. The schema
 * that reads an untrusted record lives in `surface-action.ts`.
 */
import type { GenerativeSurfaceAction } from './surface-action.ts';

/**
 * The UI message part a press travels as in the thread (`data-surface-action`, an AI SDK data
 * part). It is the human-facing record: the bubble renders it as one localized line, the
 * persisted user row stores it, and the server rebuilds the model-facing prompt from it.
 */
export const SURFACE_ACTION_PART = 'data-surface-action';

/**
 * One press, as the thread records it: the action, the render it was pressed on and the
 * **event id** the browser minted for that press. The event id is the press's identity: a
 * network retry of the same press carries the same id, a second press carries a new one.
 */
export interface SurfaceActionRecord {
	action: GenerativeSurfaceAction;
	/** The render (tool call id) the Button was pressed on. */
	renderId: string;
	/** Minted per press by the browser (`crypto.randomUUID()`); a retry resends it. */
	eventId: string;
}

export type SurfaceActionPart = {
	type: typeof SURFACE_ACTION_PART;
	data: SurfaceActionRecord;
};

/** Plain JSON with object keys sorted, so equal values always serialize the same way. */
function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (typeof value === 'object' && value !== null) {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
			.join(',')}}`;
	}
	return JSON.stringify(value ?? null);
}

/**
 * The **submission key** of a press: the render, the Button, the event and the values it
 * carried — everything but the event id. Two presses with the same key are the same
 * submission (a double click, a duplicate continuation); a press after the user changed a
 * value, on another Button, or on a newer render has a different key and is a new
 * interaction. The browser uses it to drop a repeat before it is sent; the server derives the
 * persisted row's id from it, so a repeat that gets through cannot be stored twice.
 */
export function surfaceActionKey(renderId: string, action: GenerativeSurfaceAction): string {
	return canonicalJson([renderId, action.surfaceId, action.sourceComponentId, action.name, action.context]);
}

/**
 * The record of a part in this tab's own thread, read without the schema (the server reads
 * untrusted parts with `surfaceActionRecordOf`). Null when the part is not a press.
 */
export function ownSurfaceActionRecordOf(part: unknown): SurfaceActionRecord | null {
	if (typeof part !== 'object' || part === null) return null;
	const { type, data } = part as { type?: unknown; data?: Partial<SurfaceActionRecord> };
	if (type !== SURFACE_ACTION_PART || typeof data !== 'object' || data === null) return null;
	const { action, renderId, eventId } = data;
	if (typeof renderId !== 'string' || typeof eventId !== 'string') return null;
	if (typeof action !== 'object' || action === null || typeof action.name !== 'string') return null;
	return { action, renderId, eventId };
}
