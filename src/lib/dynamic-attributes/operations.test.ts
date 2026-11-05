import { describe, expect, it } from 'vitest';
import { parseAttributeRecord, serializeAttributeRecord } from './codec.ts';
import { checkAttributeRecord } from './diagnostics.ts';
import { coreAttributeKinds } from './kinds.ts';
import { DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
import {
	type AttributeOperation,
	addAttribute,
	changeAttributeKind,
	configureAttribute,
	createAttributeEngine,
	discardPreviousValue,
	moveAttribute,
	relabelAttribute,
	removeAttribute,
	restoreAttribute,
	restorePreviousValue,
	setAttributeValue,
} from './operations.ts';
import { type AttributeRecord, emptyAttributeRecord } from './record.ts';

function engineWith(limits = DEFAULT_ATTRIBUTE_LIMITS) {
	let n = 0;
	return createAttributeEngine(coreAttributeKinds, {
		limits,
		createId: () => `att_${(n++).toString(16).padStart(10, '0')}`,
	});
}

function ok(result: AttributeOperation): AttributeRecord {
	if (!result.ok) throw new Error(`refused: ${result.refusal}`);
	return result.record;
}

/** A record with one attribute per given [label, kind, value]. */
function build(engine: ReturnType<typeof engineWith>, rows: [string, string, unknown][]): AttributeRecord {
	let record = emptyAttributeRecord();
	for (const [label, kind, value] of rows) {
		const added = addAttribute(record, { label, kind }, engine);
		record = ok(added);
		if (added.ok && value !== undefined)
			record = ok(setAttributeValue(record, added.attributeId, value as never, engine));
	}
	return record;
}

const roundTrip = (record: AttributeRecord) =>
	parseAttributeRecord(JSON.parse(serializeAttributeRecord(record)), { kinds: coreAttributeKinds });

describe('attribute operations', () => {
	it('adds a blank text attribute by default and never mutates its input', () => {
		const engine = engineWith();
		const empty = emptyAttributeRecord();
		const result = addAttribute(empty, {}, engine);
		expect(result).toMatchObject({ ok: true, attributeId: 'att_0000000000' });
		expect(ok(result).attributes).toEqual([{ id: 'att_0000000000', label: '', kind: 'text', value: '', config: {} }]);
		expect(empty.attributes).toEqual([]);
	});

	it('accepts arbitrary Unicode labels, keeps duplicates, and flags them softly', () => {
		const engine = engineWith();
		const record = build(engine, [
			['Spezies 🧬', 'text', 'Mensch'],
			['年齢', 'number', 32],
			['spezies 🧬 ', 'text', 'Androide'],
			['<img src=x onerror=alert(1)>', 'text', '"; DROP TABLE x; --'],
		]);
		expect(record.attributes.map((a) => a.label)).toEqual([
			'Spezies 🧬',
			'年齢',
			'spezies 🧬 ',
			'<img src=x onerror=alert(1)>',
		]);
		const codes = checkAttributeRecord(record, coreAttributeKinds).map((d) => d.code);
		expect(codes.filter((c) => c === 'duplicate_label')).toHaveLength(2);
		expect(roundTrip(record)).toEqual({ ok: true, record });
	});

	it('keeps id, value and order when a label changes', () => {
		const engine = engineWith();
		const record = build(engine, [
			['Species', 'text', 'Human'],
			['Age', 'number', 32],
		]);
		const renamed = ok(relabelAttribute(record, 'att_0000000000', 'Kind of being', engine));
		expect(renamed.attributes[0]).toEqual({ ...record.attributes[0], label: 'Kind of being' });
		expect(renamed.attributes[1]).toBe(record.attributes[1]); // untouched attributes keep identity
	});

	it('refuses values of the wrong type without changing the record', () => {
		const engine = engineWith();
		const record = build(engine, [['Age', 'number', 32]]);
		const id = record.attributes[0].id;
		for (const bad of ['32', Number.NaN, Number.POSITIVE_INFINITY, true, [1], { n: 1 }]) {
			expect(setAttributeValue(record, id, bad as never, engine)).toEqual({ ok: false, refusal: 'invalid_value' });
		}
		expect(setAttributeValue(record, 'att_ffffffffff', 1, engine)).toEqual({ ok: false, refusal: 'unknown_attribute' });
	});

	it('reorders, removes and restores to the original place', () => {
		const engine = engineWith();
		const record = build(engine, [
			['A', 'text', 'a'],
			['B', 'text', 'b'],
			['C', 'text', 'c'],
		]);
		const moved = ok(moveAttribute(record, 'att_0000000002', 0, engine));
		expect(moved.attributes.map((a) => a.label)).toEqual(['C', 'A', 'B']);
		expect(moveAttribute(record, 'att_0000000000', 3, engine)).toEqual({ ok: false, refusal: 'invalid_index' });

		const removed = ok(removeAttribute(moved, 'att_0000000000', engine));
		expect(removed.attributes.map((a) => a.label)).toEqual(['C', 'B']);
		expect(removed.removed).toEqual([{ attribute: record.attributes[0], index: 1 }]);
		const restored = ok(restoreAttribute(removed, 'att_0000000000', engine));
		expect(restored.attributes.map((a) => a.label)).toEqual(['C', 'A', 'B']);
		expect(restored.removed).toEqual([]);
		expect(roundTrip(removed)).toEqual({ ok: true, record: removed });
	});

	it('forgets only the oldest removal past the bound', () => {
		const engine = engineWith({ ...DEFAULT_ATTRIBUTE_LIMITS, removed: 2 });
		let record = build(engine, [
			['A', 'text', 'a'],
			['B', 'text', 'b'],
			['C', 'text', 'c'],
		]);
		for (const id of ['att_0000000000', 'att_0000000001', 'att_0000000002'])
			record = ok(removeAttribute(record, id, engine));
		expect(record.removed.map((r) => r.attribute.label)).toEqual(['B', 'C']);
	});

	describe('changing a kind', () => {
		it('converts exactly when the value reads the same, and keeps nothing extra', () => {
			const engine = engineWith();
			const record = build(engine, [['Age', 'text', '32']]);
			const changed = ok(changeAttributeKind(record, 'att_0000000000', 'number', engine));
			expect(changed.attributes[0]).toMatchObject({ kind: 'number', value: 32 });
			expect(changed.attributes[0].previous).toBeUndefined();
			const back = ok(changeAttributeKind(changed, 'att_0000000000', 'text', engine));
			expect(back.attributes[0]).toMatchObject({ kind: 'text', value: '32' });
		});

		it('keeps the original value through lossy changes until restored or discarded', () => {
			const engine = engineWith();
			const record = build(engine, [['Age', 'text', 'thirty-two']]);
			const asNumber = ok(changeAttributeKind(record, 'att_0000000000', 'number', engine));
			expect(asNumber.attributes[0]).toMatchObject({
				kind: 'number',
				value: null,
				previous: { kind: 'text', value: 'thirty-two', config: {} },
			});
			// A second lossy change still keeps what the user typed, not the intermediate null.
			const asDate = ok(changeAttributeKind(asNumber, 'att_0000000000', 'date', engine));
			expect(asDate.attributes[0].previous).toEqual({ kind: 'text', value: 'thirty-two', config: {} });
			expect(roundTrip(asDate)).toEqual({ ok: true, record: asDate });
			expect(checkAttributeRecord(asDate, coreAttributeKinds).map((d) => d.code)).toContain('previous_value');

			const restored = ok(restorePreviousValue(asDate, 'att_0000000000', engine));
			expect(restored.attributes[0]).toEqual(record.attributes[0]);
			// Changing back to the kept kind is a restore too.
			expect(ok(changeAttributeKind(asNumber, 'att_0000000000', 'text', engine)).attributes[0]).toEqual(
				record.attributes[0],
			);

			const accepted = ok(discardPreviousValue(asNumber, 'att_0000000000', engine));
			expect(accepted.attributes[0]).toEqual({
				id: 'att_0000000000',
				label: 'Age',
				kind: 'number',
				value: null,
				config: {},
			});
		});

		it('treats a reformatted value as lossy (032 is not 32)', () => {
			const engine = engineWith();
			const record = build(engine, [['Code', 'text', '032']]);
			const changed = ok(changeAttributeKind(record, 'att_0000000000', 'number', engine));
			expect(changed.attributes[0]).toMatchObject({ value: 32, previous: { value: '032' } });
		});

		it('turns lines into selection options and list items', () => {
			const engine = engineWith();
			const record = build(engine, [['Crew', 'multiline', 'Navigator\nPilot']]);
			const asList = ok(changeAttributeKind(record, 'att_0000000000', 'list', engine));
			expect(asList.attributes[0]).toMatchObject({ kind: 'list', value: ['Navigator', 'Pilot'] });
			expect(asList.attributes[0].previous).toBeUndefined();

			const role = build(engine, [['Role', 'text', 'Navigator']]);
			const asSelect = ok(changeAttributeKind(role, role.attributes[0].id, 'select', engine));
			expect(asSelect.attributes[0]).toMatchObject({
				kind: 'select',
				value: 'option-1',
				config: { options: [{ id: 'option-1', label: 'Navigator' }] },
			});
			expect(asSelect.attributes[0].previous).toBeUndefined();
		});
	});

	it('keeps a selection when its option is relabelled, and flags a value whose option is gone', () => {
		const engine = engineWith();
		let record = build(engine, [['Role', 'select', undefined]]);
		const id = record.attributes[0].id;
		record = ok(configureAttribute(record, id, { options: [{ id: 'nav', label: 'Navigator' }] }, engine));
		record = ok(setAttributeValue(record, id, 'nav', engine));
		record = ok(configureAttribute(record, id, { options: [{ id: 'nav', label: 'Steuerfrau' }] }, engine));
		expect(record.attributes[0].value).toBe('nav');
		record = ok(configureAttribute(record, id, { options: [] }, engine));
		expect(checkAttributeRecord(record, coreAttributeKinds)).toEqual([{ code: 'unknown_option', attributeId: id }]);
		expect(configureAttribute(record, id, { options: [{ id: 'X Y', label: 'bad id' }] }, engine)).toEqual({
			ok: false,
			refusal: 'invalid_config',
		});
	});

	it('enforces the attribute, label, value and size bounds', () => {
		const limits = { ...DEFAULT_ATTRIBUTE_LIMITS, attributes: 2, labelLength: 5, recordBytes: 400 };
		const engine = engineWith(limits);
		let record = ok(addAttribute(emptyAttributeRecord(), {}, engine));
		record = ok(addAttribute(record, {}, engine));
		expect(addAttribute(record, {}, engine)).toEqual({ ok: false, refusal: 'too_many_attributes' });
		expect(relabelAttribute(record, 'att_0000000000', 'toolong', engine)).toEqual({
			ok: false,
			refusal: 'invalid_label',
		});
		expect(relabelAttribute(record, 'att_0000000000', 'a\nb', engine)).toEqual({ ok: false, refusal: 'invalid_label' });
		expect(setAttributeValue(record, 'att_0000000000', 'x'.repeat(300), engine)).toEqual({
			ok: false,
			refusal: 'too_large',
		});
		expect(setAttributeValue(record, 'att_0000000000', 'a\u0000b', engine)).toEqual({
			ok: false,
			refusal: 'invalid_value',
		});
		expect(addAttribute(record, { kind: 'script' }, engine)).toEqual({ ok: false, refusal: 'unknown_kind' });
	});
});
