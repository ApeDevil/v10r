/**
 * A record as plain text — one `label: value` line per attribute, in order — for readers that
 * are not the editor: an assistant's read tool, a search index, an export preview. Values pass
 * through their kind's `text`, so a selection reads as its option label, never its id.
 */
import type { AttributeKindRegistry } from './kinds.ts';
import type { AttributeRecord } from './record.ts';

export function attributeRecordToText(record: AttributeRecord, kinds: AttributeKindRegistry): string {
	return record.attributes
		.map((attribute) => {
			const kind = kinds.get(attribute.kind);
			const label = attribute.label.trim() || '(unlabelled)';
			if (!kind) return `${label}: (value of unknown kind "${attribute.kind}")`;
			const text = kind.text(attribute.value, attribute.config);
			return `${label}: ${text.includes('\n') ? `\n  ${text.split('\n').join('\n  ')}` : text}`;
		})
		.join('\n');
}
