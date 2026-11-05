import { describe, expect, it } from 'vitest';
import { coreAttributeKinds } from './kinds.ts';
import { mergeAttributeRecords } from './merge.ts';
import {
	type AttributeOperation,
	addAttribute,
	createAttributeEngine,
	moveAttribute,
	relabelAttribute,
	removeAttribute,
	setAttributeValue,
} from './operations.ts';
import { type AttributeRecord, emptyAttributeRecord } from './record.ts';

let n = 0;
const engine = createAttributeEngine(coreAttributeKinds, {
	createId: () => `att_${(n++).toString(16).padStart(10, '0')}`,
});
const ok = (r: AttributeOperation) => {
	if (!r.ok) throw new Error(r.refusal);
	return r.record;
};
const labels = (r: AttributeRecord) => r.attributes.map((a) => `${a.label}=${String(a.value)}`);

function base(): AttributeRecord {
	n = 0;
	let r = emptyAttributeRecord();
	for (const label of ['A', 'B', 'C']) r = ok(addAttribute(r, { label }, engine));
	return r;
}
const [A, B, C] = ['att_0000000000', 'att_0000000001', 'att_0000000002'];

describe('three-way merge', () => {
	it('merges edits of different attributes, and of label vs value of one attribute, without conflict', () => {
		const start = base();
		const local = ok(setAttributeValue(ok(relabelAttribute(start, A, 'Alpha', engine)), B, 'mine', engine));
		const remote = ok(setAttributeValue(ok(setAttributeValue(start, A, 'theirs', engine)), C, 'c', engine));
		const { record, conflicts } = mergeAttributeRecords(start, local, remote);
		expect(conflicts).toEqual([]);
		expect(labels(record)).toEqual(['Alpha=theirs', 'B=mine', 'C=c']);
	});

	it('reports a clash, keeps the local edit, and never drops data', () => {
		const start = base();
		const local = ok(setAttributeValue(start, A, 'mine', engine));
		const remote = ok(setAttributeValue(start, A, 'theirs', engine));
		expect(mergeAttributeRecords(start, local, remote)).toMatchObject({
			conflicts: [{ attributeId: A, part: 'value' }],
		});
		expect(labels(mergeAttributeRecords(start, local, remote).record)[0]).toBe('A=mine');
	});

	it('keeps an attribute one side removed and the other edited', () => {
		const start = base();
		const local = ok(removeAttribute(start, B, engine));
		const remote = ok(setAttributeValue(start, B, 'edited', engine));
		const merged = mergeAttributeRecords(start, local, remote);
		expect(merged.conflicts).toEqual([{ attributeId: B, part: 'removal' }]);
		expect(labels(merged.record)).toEqual(['A=', 'B=edited', 'C=']);
		expect(merged.record.removed).toEqual([]);
	});

	it('applies a removal against an untouched attribute and keeps it restorable', () => {
		const start = base();
		const local = ok(removeAttribute(start, B, engine));
		const merged = mergeAttributeRecords(start, local, start);
		expect(merged.conflicts).toEqual([]);
		expect(labels(merged.record)).toEqual(['A=', 'C=']);
		expect(merged.record.removed.map((r) => r.attribute.id)).toEqual([B]);
	});

	it('keeps additions from both sides and the reorder of the side that reordered', () => {
		const start = base();
		const local = ok(moveAttribute(start, C, 0, engine)); // C A B
		const remote = ok(addAttribute(start, { label: 'D', at: 2 }, engine)); // A B D C
		const merged = mergeAttributeRecords(start, local, remote);
		expect(merged.conflicts).toEqual([]);
		expect(merged.record.attributes.map((a) => a.label)).toEqual(['C', 'A', 'B', 'D']);
	});

	it('is the identity when nothing changed on one side', () => {
		const start = base();
		const local = ok(setAttributeValue(start, C, 'x', engine));
		expect(mergeAttributeRecords(start, local, start).record).toEqual(local);
		expect(mergeAttributeRecords(start, start, local).record).toEqual(local);
	});
});
