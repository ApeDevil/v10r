/**
 * Knowledge-preservation gate for the record reconciliation (Slice 2, D-04, D-10).
 *
 * Retiring, merging, splitting or renaming a record must not delete knowledge. For every entry of
 * `manifest.json`, every item of the record as it was — refs, capabilities, keywords, invariants,
 * contraindications, alternatives, emulation notes, infrastructure needs, relationships, summary
 * and when-to-use — must exist on its target record(s), or be listed in the entry's `dropped` with
 * a reason. A second check proves there are no aliases: an old id appears nowhere in the tree
 * except the files that record history.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTRY as registry } from '../../src/lib/server/patterns/registry.ts';
import type { NeedEntry, PatternRecord } from '../schema.ts';

const ROOT = resolve(import.meta.dirname, '../..');

interface ManifestEntry {
	previousId: string;
	target: string;
	alsoTarget?: string;
	action: 'rename' | 'rename+reclassify' | 'merge' | 'retire' | 'split';
	reason: string;
	dropped: { field: string; value: string; reason: string }[];
	record: PatternRecord & { requires?: string[] };
}

const manifest = JSON.parse(readFileSync(resolve(ROOT, 'pattern-library/reconciliation/manifest.json'), 'utf8')) as {
	entries: ManifestEntry[];
};
const byId = new Map(registry.patterns.map((pattern) => [pattern.id, pattern]));
const renamed = new Map(manifest.entries.map((entry) => [entry.previousId, entry.target]));

const needId = (need: NeedEntry) => (typeof need === 'string' ? need : need.need);
const REF_FIELDS = ['docs', 'code', 'tests', 'showcases'] as const;
const TEXT_FIELDS = ['capabilities', 'keywords', 'invariants', 'avoid_when', 'emulation_notes'] as const;

/** Every item the old record carried, as `field → value`. */
function items(record: ManifestEntry['record']): { field: string; value: string }[] {
	return [
		...REF_FIELDS.flatMap((field) => record[field].map((ref) => ({ field, value: ref.path }))),
		...TEXT_FIELDS.flatMap((field) => record[field].map((value) => ({ field, value }))),
		...record.alternatives.map((alternative) => ({ field: 'alternatives', value: alternative.approach })),
		...record.needs.map((need) => ({ field: 'needs', value: needId(need) })),
		...record.depends_on.map((value) => ({ field: 'depends_on', value })),
		{ field: 'summary', value: record.summary },
		{ field: 'when_to_use', value: record.when_to_use },
	];
}

function presentOn(target: PatternRecord, field: string, value: string): boolean {
	if ((REF_FIELDS as readonly string[]).includes(field)) {
		return REF_FIELDS.some((refField) => target[refField].some((ref) => ref.path === value));
	}
	if ((TEXT_FIELDS as readonly string[]).includes(field)) {
		return (target[field as (typeof TEXT_FIELDS)[number]] as string[]).includes(value);
	}
	if (field === 'alternatives') return target.alternatives.some((alternative) => alternative.approach === value);
	if (field === 'needs') return target.needs.some((need) => needId(need) === value);
	if (field === 'depends_on') {
		const now = renamed.get(value) ?? value;
		return now === target.id || target.depends_on.includes(now);
	}
	// Summary and when-to-use may survive as the target's own text or on a transferred ref's note.
	return JSON.stringify(target).includes(JSON.stringify(value).slice(1, -1));
}

describe('reconciliation manifest', () => {
	it('names an existing target for every entry, and no previous id survives in the registry', () => {
		for (const entry of manifest.entries) {
			expect(byId.has(entry.target), `${entry.previousId} → ${entry.target}`).toBe(true);
			if (entry.alsoTarget) expect(byId.has(entry.alsoTarget), entry.alsoTarget).toBe(true);
			if (entry.action !== 'split') expect(byId.has(entry.previousId), `${entry.previousId} still exists`).toBe(false);
			expect(entry.reason.length, `${entry.previousId} has no reason`).toBeGreaterThan(20);
		}
	});

	it('records a reason for every item that did not move verbatim', () => {
		for (const entry of manifest.entries) {
			for (const dropped of entry.dropped) expect(dropped.reason.length, JSON.stringify(dropped)).toBeGreaterThan(10);
		}
	});

	for (const entry of manifest.entries) {
		it(`${entry.previousId} (${entry.action} → ${entry.target}) loses no knowledge`, () => {
			const targets = [entry.target, entry.alsoTarget]
				.filter((id): id is string => typeof id === 'string')
				.map((id) => byId.get(id) as PatternRecord);
			const lost = items(entry.record).filter(
				({ field, value }) =>
					!targets.some((target) => presentOn(target, field, value)) &&
					!entry.dropped.some((dropped) => dropped.field === field && dropped.value === value),
			);
			expect(lost, 'items neither on the target nor dropped with a reason').toEqual([]);
		});
	}
});

/**
 * Files allowed to keep an old id: they record history, not live references. Every other tracked
 * file is scanned, generated surfaces included.
 */
const HISTORY = [
	'pattern-library/reconciliation/',
	'docs/blueprint/architecture/pattern-ontology-engineering/',
	'pattern-library/bench/baseline.json',
	'pattern-library/bench/composition-baseline.json',
	'pattern-library/bench/composition-baseline-plans.json',
	'pattern-library/bench/composition-baseline-rescored.json',
];
/** Same spelling, different concept: section anchors of the i18n showcase page, not pattern ids. */
const HOMONYMS: Record<string, string[]> = {
	'src/lib/showcases/catalog/sections.ts': ['i18n-messages', 'i18n-formatting'],
	'src/routes/[[locale=locale]]/(public)/showcases/i18n/+page.svelte': ['i18n-messages', 'i18n-formatting'],
};

describe('no aliases', () => {
	it('no tracked file outside the history files mentions a retired or renamed id', () => {
		const files = execSync('git ls-files', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
			.toString()
			.split('\n')
			.filter((file) => file.length > 0 && !HISTORY.some((prefix) => file.startsWith(prefix)))
			.filter((file) => /\.(ts|js|svelte|json|md|html|css|yaml|yml)$/.test(file));
		const old = manifest.entries.filter((entry) => entry.previousId !== entry.target).map((entry) => entry.previousId);
		const pattern = new RegExp(
			`(?<![A-Za-z0-9_-])(${old.map((id) => id.replace(/[-]/g, '\\-')).join('|')})(?![A-Za-z0-9_])`,
			'g',
		);
		const leftovers: string[] = [];
		for (const file of files) {
			let text: string;
			try {
				text = readFileSync(resolve(ROOT, file), 'utf8');
			} catch {
				continue;
			}
			for (const match of text.matchAll(pattern)) {
				if (HOMONYMS[file]?.includes(match[1])) continue;
				leftovers.push(`${file}: ${match[1]}`);
			}
		}
		expect(leftovers).toEqual([]);
	});
});
