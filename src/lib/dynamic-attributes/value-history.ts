/**
 * Versioned values: what one attribute held across a record's stored versions. Values need no
 * versioning machinery of their own — every save of a record is already a stored version (the
 * showcase's revision log, the desk's `file_revision`) — so a value's history is a read over
 * those versions, keyed by what stays stable: the definition for a bound attribute, the
 * attribute id for a local one. A relabel or a unit change does not break the line.
 */
import type { JsonValue } from './json.ts';
import { jsonEqual } from './json.ts';
import type { AttributeKindRegistry } from './kinds.ts';
import type { Attribute, AttributeRecord } from './record.ts';

/** One stored version of a record. */
export interface StoredRecordVersion {
	version: number;
	/** ISO 8601 instant the version was stored. */
	savedAt: string;
	record: AttributeRecord;
}

export interface ValueHistoryEntry {
	version: number;
	savedAt: string;
	label: string;
	value: JsonValue;
	text: string;
	/** The dictionary revision the attribute was bound at, when it was bound. */
	revision?: number;
	/** The attribute was absent from this version (removed, or not added yet). */
	absent?: true;
}

/** Which attribute to follow: a definition id (`def_…`) or an attribute id (`att_…`). */
function matches(attribute: Attribute, key: string): boolean {
	return attribute.binding?.definition === key || attribute.id === key;
}

/**
 * The versions at which the attribute's value (or presence) changed, oldest first. Versions in
 * between that held the same value are left out — a history of changes, not of saves.
 */
export function valueHistory(
	versions: readonly StoredRecordVersion[],
	key: string,
	kinds: AttributeKindRegistry,
): ValueHistoryEntry[] {
	const out: ValueHistoryEntry[] = [];
	const ordered = [...versions].sort((a, b) => a.version - b.version);
	for (const stored of ordered) {
		const attribute = stored.record.attributes.find((a) => matches(a, key));
		const last = out.at(-1);
		if (!attribute) {
			if (last && !last.absent)
				out.push({
					version: stored.version,
					savedAt: stored.savedAt,
					label: last.label,
					value: null,
					text: '',
					absent: true,
				});
			continue;
		}
		const kind = kinds.get(attribute.kind);
		const text = kind ? kind.text(attribute.value, attribute.config) : JSON.stringify(attribute.value);
		if (last && !last.absent && jsonEqual(last.value, attribute.value) && last.text === text) continue;
		const entry: ValueHistoryEntry = {
			version: stored.version,
			savedAt: stored.savedAt,
			label: attribute.label,
			value: attribute.value,
			text,
		};
		if (attribute.binding) entry.revision = attribute.binding.revision;
		out.push(entry);
	}
	return out;
}
