/**
 * Three-way merge of two edits of one record, by attribute id. This is what stable ids buy:
 * two people who edited *different* attributes — or different parts of one (its label vs its
 * value) — never conflict, because the merge compares each against the version both started from.
 *
 * Where both changed the same part differently, the local edit wins in the merged record and
 * the clash is reported, so the editor can show it before anything is saved. Nothing is
 * dropped by a merge: an attribute one side removed and the other edited is kept (the edit is
 * the newer intent), and a removal the merge does keep stays restorable in `removed`.
 */
import { type JsonValue, jsonEqual } from './json.ts';
import { DEFAULT_ATTRIBUTE_LIMITS } from './limits.ts';
import type { Attribute, AttributeRecord, RemovedAttribute } from './record.ts';

export type MergeConflictPart = 'label' | 'value' | 'removal';

export interface AttributeMergeConflict {
	attributeId: string;
	part: MergeConflictPart;
}

export interface AttributeMerge {
	record: AttributeRecord;
	conflicts: AttributeMergeConflict[];
}

/** The parts of an attribute a merge treats separately. Kind, config and value move together. */
function typedPart(attribute: Attribute): JsonValue {
	return {
		kind: attribute.kind,
		value: attribute.value,
		config: attribute.config,
		previous: (attribute.previous ?? null) as unknown as JsonValue,
	};
}

function pick<T>(base: T, local: T, remote: T, equal: (a: T, b: T) => boolean): { value: T; conflict: boolean } {
	if (equal(local, base)) return { value: remote, conflict: false };
	if (equal(remote, base) || equal(local, remote)) return { value: local, conflict: false };
	return { value: local, conflict: true };
}

export function mergeAttributeRecords(
	base: AttributeRecord,
	local: AttributeRecord,
	remote: AttributeRecord,
	removedLimit = DEFAULT_ATTRIBUTE_LIMITS.removed,
): AttributeMerge {
	const index = (record: AttributeRecord) => new Map(record.attributes.map((a) => [a.id, a]));
	const [b, l, r] = [index(base), index(local), index(remote)];
	const conflicts: AttributeMergeConflict[] = [];
	const merged = new Map<string, Attribute>();

	for (const id of new Set([...l.keys(), ...r.keys(), ...b.keys()])) {
		const [was, mine, theirs] = [b.get(id), l.get(id), r.get(id)];
		if (!was) {
			const added = mine ?? theirs;
			if (added) merged.set(id, added);
			continue;
		}
		if (!mine && !theirs) continue;
		if (!mine || !theirs) {
			const kept = (mine ?? theirs) as Attribute;
			if (attributeEqual(kept, was)) continue; // removed on one side, untouched on the other
			conflicts.push({ attributeId: id, part: 'removal' });
			merged.set(id, kept);
			continue;
		}
		const label = pick(was.label, mine.label, theirs.label, (x, y) => x === y);
		const typed = pick(typedPart(was), typedPart(mine), typedPart(theirs), jsonEqual);
		if (label.conflict) conflicts.push({ attributeId: id, part: 'label' });
		if (typed.conflict) conflicts.push({ attributeId: id, part: 'value' });
		const source = jsonEqual(typed.value, typedPart(theirs)) ? theirs : mine;
		const next: Attribute = { id, label: label.value, kind: source.kind, value: source.value, config: source.config };
		if (source.previous) next.previous = source.previous;
		merged.set(id, attributeEqual(next, mine) ? mine : attributeEqual(next, theirs) ? theirs : next);
	}

	const attributes = mergeOrder(base, local, remote, merged);
	const removed = mergeRemoved(local.removed, remote.removed, merged).slice(-removedLimit);
	return { record: { format: local.format, attributes, removed }, conflicts };
}

function attributeEqual(a: Attribute, b: Attribute): boolean {
	return a.label === b.label && jsonEqual(typedPart(a), typedPart(b));
}

/** Ids of `record` that are also in `others`, in `record`'s order. */
function relative(record: AttributeRecord, others: AttributeRecord): string[] {
	const keep = new Set(others.attributes.map((a) => a.id));
	return record.attributes.map((a) => a.id).filter((id) => keep.has(id));
}

/**
 * The side that reordered decides the order (local, if both did); attributes it lacks are
 * placed after their nearest predecessor in the side that has them.
 */
function mergeOrder(
	base: AttributeRecord,
	local: AttributeRecord,
	remote: AttributeRecord,
	merged: Map<string, Attribute>,
): Attribute[] {
	const localReordered = relative(local, base).join() !== relative(base, local).join();
	const [primary, secondary] = localReordered ? [local, remote] : [remote, local];
	const order = primary.attributes.map((a) => a.id).filter((id) => merged.has(id));
	const placed = new Set(order);
	const secondaryIds = secondary.attributes.map((a) => a.id);
	for (const [i, id] of secondaryIds.entries()) {
		if (placed.has(id) || !merged.has(id)) continue;
		let at = 0;
		for (let j = i - 1; j >= 0; j--) {
			const k = order.indexOf(secondaryIds[j]);
			if (k >= 0) {
				at = k + 1;
				break;
			}
		}
		order.splice(at, 0, id);
		placed.add(id);
	}
	// Kept by a removal conflict but absent from both orders' surviving lists: append.
	for (const id of merged.keys()) if (!placed.has(id)) order.push(id);
	return order.map((id) => merged.get(id) as Attribute);
}

function mergeRemoved(
	local: RemovedAttribute[],
	remote: RemovedAttribute[],
	live: Map<string, Attribute>,
): RemovedAttribute[] {
	const out: RemovedAttribute[] = [];
	const seen = new Set<string>();
	for (const entry of [...remote, ...local]) {
		const id = entry.attribute.id;
		if (seen.has(id) || live.has(id)) continue;
		seen.add(id);
		out.push(entry);
	}
	return out;
}
