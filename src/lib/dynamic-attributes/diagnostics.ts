/**
 * Soft findings about a valid record — what the editor points out without refusing anything.
 * A finding never blocks a save: refusing to save a number above its max would turn a
 * reminder into lost work. What must block is structural, and that is `codec.ts`'s job.
 */
import type { AttributeKindRegistry, AttributeValueFinding } from './kinds.ts';
import type { AttributeRecord } from './record.ts';

export type AttributeDiagnosticCode =
	| AttributeValueFinding
	| 'empty_label'
	| 'duplicate_label'
	| 'unknown_kind'
	| 'previous_value';

export interface AttributeDiagnostic {
	code: AttributeDiagnosticCode;
	attributeId: string;
}

/** Findings in attribute order, then code order — stable for the same record. */
export function checkAttributeRecord(record: AttributeRecord, kinds: AttributeKindRegistry): AttributeDiagnostic[] {
	const byLabel = new Map<string, number>();
	for (const { label } of record.attributes) {
		const key = normalizedLabel(label);
		if (key) byLabel.set(key, (byLabel.get(key) ?? 0) + 1);
	}
	const out: AttributeDiagnostic[] = [];
	for (const attribute of record.attributes) {
		const codes: AttributeDiagnosticCode[] = [];
		const key = normalizedLabel(attribute.label);
		if (!key) codes.push('empty_label');
		else if ((byLabel.get(key) ?? 0) > 1) codes.push('duplicate_label');
		const kind = kinds.get(attribute.kind);
		if (!kind) codes.push('unknown_kind');
		else codes.push(...(kind.check?.(attribute.value, attribute.config) ?? []));
		if (attribute.previous) codes.push('previous_value');
		for (const code of codes.sort()) out.push({ code, attributeId: attribute.id });
	}
	return out;
}

/** Labels compare as a person reads them: Unicode-normalized, trimmed, case-folded. */
export function normalizedLabel(label: string): string {
	return label.normalize('NFKC').trim().toLocaleLowerCase('und');
}
