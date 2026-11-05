import { describe, expect, it, vi } from 'vitest';
import { coreAttributeKinds, createAttributeEngine, emptyAttributeRecord } from '#lib/dynamic-attributes/index.ts';
import { createAttributeEditor } from './attribute-editor.svelte.ts';

function setup() {
	let n = 0;
	let clock = 0;
	const engine = createAttributeEngine(coreAttributeKinds, {
		createId: () => `att_${(n++).toString(16).padStart(10, '0')}`,
	});
	const onChange = vi.fn();
	const editor = createAttributeEditor({ engine, initial: emptyAttributeRecord(), onChange, now: () => clock });
	return { editor, onChange, tick: (ms: number) => (clock += ms) };
}

describe('attribute editor state', () => {
	it('adds, edits and reports every accepted change, keeping untouched rows by identity', () => {
		const { editor, onChange } = setup();
		const a = editor.add({ label: 'Species' }) as string;
		const b = editor.add({ label: 'Age', kind: 'number' }) as string;
		const before = editor.record.attributes[1];
		editor.setValue(a, 'Human');
		expect(editor.record.attributes[1]).toBe(before);
		editor.setValue(b, 32);
		expect(onChange).toHaveBeenCalledTimes(4);
		expect(onChange).toHaveBeenLastCalledWith(editor.record);
	});

	it('treats a typed word as one undo step, and a pause or another field as a new one', () => {
		const { editor, tick } = setup();
		const id = editor.add() as string;
		for (const text of ['N', 'Na', 'Nav']) {
			editor.setValue(id, text);
			tick(100);
		}
		tick(2000);
		editor.setValue(id, 'Navigator');
		editor.undo();
		expect(editor.record.attributes[0].value).toBe('Nav');
		editor.undo();
		expect(editor.record.attributes[0].value).toBe('');
		editor.redo();
		editor.redo();
		expect(editor.record.attributes[0].value).toBe('Navigator');
		expect(editor.canRedo).toBe(false);
	});

	it('undoes a removal and a kind change completely', () => {
		const { editor } = setup();
		const id = editor.add({ label: 'Age' }) as string;
		editor.setValue(id, 'thirty-two');
		const typed = editor.record;
		editor.changeKind(id, 'number');
		expect(editor.record.attributes[0].previous).toBeDefined();
		editor.remove(id);
		expect(editor.record.attributes).toEqual([]);
		editor.undo();
		editor.undo();
		expect(editor.record).toBe(typed);
	});

	it('shows a refusal and keeps the record when an operation is refused', () => {
		const { editor } = setup();
		const id = editor.add({ kind: 'number' }) as string;
		const record = editor.record;
		expect(editor.setValue(id, 'not a number')).toBeNull();
		expect(editor.refusal).toBe('invalid_value');
		expect(editor.record).toBe(record);
		editor.setValue(id, 5);
		expect(editor.refusal).toBeNull();
	});

	it('keeps several editors on one page independent', () => {
		const first = setup().editor;
		const second = setup().editor;
		first.add({ label: 'only in first' });
		expect(second.record.attributes).toEqual([]);
		second.replace(first.record);
		expect(second.record).toBe(first.record);
		expect(second.canUndo).toBe(false);
	});
});
