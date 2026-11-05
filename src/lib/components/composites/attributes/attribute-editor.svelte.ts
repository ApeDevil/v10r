/**
 * The editor's state: one record, its undo history, and the last refusal — a thin reactive shell
 * over the pure operations of `#lib/dynamic-attributes`. Nothing here decides what a record may
 * be; every change is an operation that returns a new record or a refusal.
 *
 * The record is `$state.raw`, replaced on every change, never deep-proxied: operations keep
 * unchanged attributes' identity, so a row whose attribute did not change receives the same
 * object and Svelte skips it. Typing into one value of a 200-attribute record re-renders one row.
 *
 * Persistence is not the editor's concern. `onChange` reports each accepted change (an autosave,
 * a form field, a test); `replace` takes a record from outside (a load, a merge, a recovered
 * draft) without entering the undo history.
 */
import {
	type AttributeEngine,
	type AttributeOperation,
	type AttributeRecord,
	type AttributeRefusalCode,
	addAttribute,
	changeAttributeKind,
	checkAttributeRecord,
	configureAttribute,
	discardPreviousValue,
	type JsonObject,
	type JsonValue,
	moveAttribute,
	type NewAttribute,
	relabelAttribute,
	removeAttribute,
	restoreAttribute,
	restorePreviousValue,
	setAttributeValue,
} from '#lib/dynamic-attributes/index.ts';

/** Snapshots kept for undo. Each shares unchanged attributes with its neighbours. */
const HISTORY_LIMIT = 100;
/** Consecutive edits of the same field within this window are one undo step (typing a word). */
const COALESCE_MS = 800;

export interface AttributeEditorOptions {
	engine: AttributeEngine;
	initial: AttributeRecord;
	onChange?: (record: AttributeRecord) => void;
	/** Clock for undo coalescing; injectable for tests. */
	now?: () => number;
}

export function createAttributeEditor(options: AttributeEditorOptions) {
	const { engine } = options;
	const now = options.now ?? (() => Date.now());
	let record = $state.raw(options.initial);
	let refusal = $state<AttributeRefusalCode | null>(null);
	let past = $state.raw<AttributeRecord[]>([]);
	let future = $state.raw<AttributeRecord[]>([]);
	let lastEdit: { key: string; at: number } | null = null;
	const diagnostics = $derived(checkAttributeRecord(record, engine.kinds));

	/** Apply an operation. `coalesce` names the field being typed into, so a word is one undo step. */
	function apply(result: AttributeOperation, coalesce?: string): string | null {
		if (!result.ok) {
			refusal = result.refusal;
			return null;
		}
		refusal = null;
		if (result.record === record) return result.attributeId;
		const at = now();
		const merging = coalesce !== undefined && lastEdit?.key === coalesce && at - lastEdit.at < COALESCE_MS;
		if (!merging) past = [...past, record].slice(-HISTORY_LIMIT);
		lastEdit = coalesce === undefined ? null : { key: coalesce, at };
		future = [];
		record = result.record;
		options.onChange?.(record);
		return result.attributeId;
	}

	function travel(from: AttributeRecord[], to: AttributeRecord[]): [AttributeRecord[], AttributeRecord[]] | null {
		const target = from.at(-1);
		if (!target) return null;
		const next: [AttributeRecord[], AttributeRecord[]] = [from.slice(0, -1), [...to, record]];
		record = target;
		lastEdit = null;
		refusal = null;
		options.onChange?.(record);
		return next;
	}

	return {
		get record() {
			return record;
		},
		get diagnostics() {
			return diagnostics;
		},
		/** Why the last operation was refused, until the next one succeeds. */
		get refusal() {
			return refusal;
		},
		get canUndo() {
			return past.length > 0;
		},
		get canRedo() {
			return future.length > 0;
		},
		get atLimit() {
			return record.attributes.length >= engine.limits.attributes;
		},
		add: (input: NewAttribute = {}) => apply(addAttribute(record, input, engine)),
		relabel: (id: string, label: string) => apply(relabelAttribute(record, id, label, engine), `${id}:label`),
		setValue: (id: string, value: JsonValue) => apply(setAttributeValue(record, id, value, engine), `${id}:value`),
		configure: (id: string, config: JsonObject) => apply(configureAttribute(record, id, config, engine)),
		changeKind: (id: string, kind: string) => apply(changeAttributeKind(record, id, kind, engine)),
		restorePrevious: (id: string) => apply(restorePreviousValue(record, id, engine)),
		discardPrevious: (id: string) => apply(discardPreviousValue(record, id, engine)),
		move: (id: string, toIndex: number) => apply(moveAttribute(record, id, toIndex, engine)),
		remove: (id: string) => apply(removeAttribute(record, id, engine)),
		restore: (id: string) => apply(restoreAttribute(record, id, engine)),
		undo() {
			const moved = travel(past, future);
			if (moved) [past, future] = moved;
		},
		redo() {
			const moved = travel(future, past);
			if (moved) [future, past] = moved;
		},
		/** Take a record from outside — a load, a merge, a recovered draft. Clears history. */
		replace(next: AttributeRecord) {
			record = next;
			past = [];
			future = [];
			lastEdit = null;
			refusal = null;
		},
		clearRefusal() {
			refusal = null;
		},
	};
}

export type AttributeEditorState = ReturnType<typeof createAttributeEditor>;
