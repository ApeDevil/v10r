/**
 * Knowledge-preservation gate for the record reconciliation (Slice 2, D-04, D-10; strengthened in
 * Slice 3).
 *
 * Retiring, merging, splitting or renaming a record must not delete knowledge. For every entry of
 * `manifest.json`, every item of the record as it was must survive on its target record(s) with
 * its semantics intact, not just its words:
 *
 * - refs keep their path, kind, anchor and annotation; evidence (tests, showcases) stays evidence;
 * - capabilities, keywords, contraindications and emulation notes keep their text;
 * - invariants hold on the target, its own or inherited through `specializes`;
 * - alternatives keep their approach AND the condition under which they win;
 * - needs keep their level, condition, pin and the justification of a pin or a weak level;
 * - a proven record's verification provenance survives on a proven target;
 * - relationships keep their semantics: the target adopts, references or assumes the old target,
 *   or `relationships.json` records the edge's fate with a reason.
 *
 * Old ids inside text are normalized to their new ids before comparing: a rename is not a loss.
 * An item that did not survive is accepted only as a JUSTIFIED INTENTIONAL CORRECTION recorded in
 * the entry — `dropped` (moved elsewhere or removed, with a reason) or `reclassified` (moved to
 * another field, whose claim the gate verifies). Anything else is accidental loss and fails.
 * "Preserving knowledge does not require preserving an incorrect assertion" — but the correction
 * must be written down.
 *
 * A second block proves the relationship migration manifest and the registry agree, and a third
 * that there are no aliases: an old id appears nowhere in the tree except the history files.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTRY as registry } from '../../src/lib/server/patterns/registry.ts';
import { patternGraph } from '../pattern-graph.ts';
import {
	adoptionTargets,
	type NeedDeclaration,
	type NeedEntry,
	needDeclaration,
	type PatternRecord,
	type RegRef,
} from '../schema.ts';

const ROOT = resolve(import.meta.dirname, '../..');

/** A record as the manifest snapshots it: the format-4 shape, with `depends_on`. */
type SnapshotRecord = Omit<PatternRecord, 'builds_on' | 'composes' | 'specializes' | 'references'> & {
	depends_on: string[];
	requires?: string[];
};

interface Correction {
	field: string;
	value: string;
	reason: string;
}

interface ManifestEntry {
	previousId: string;
	target: string;
	alsoTarget?: string;
	action: 'rename' | 'rename+reclassify' | 'merge' | 'retire' | 'split';
	reason: string;
	recordState: 'slice-1' | 'corrected-before-reconciliation';
	historical?: { commit: string; differences: { field: string; slice1: unknown; reason: string }[] };
	dropped: Correction[];
	reclassified?: (Correction & { to: string; class: string })[];
	record: SnapshotRecord;
}

interface RelationshipEntry {
	from: string;
	to: string;
	before: 'depends_on' | 'none';
	after: { type: string; level?: string; when?: string; home?: string };
	why: string;
}

const readJson = <T>(path: string) => JSON.parse(readFileSync(resolve(ROOT, path), 'utf8')) as T;
const manifest = readJson<{ entries: ManifestEntry[] }>('pattern-library/reconciliation/manifest.json');
const relationships = readJson<{ baseCommit: string; entries: RelationshipEntry[] }>(
	'pattern-library/reconciliation/relationships.json',
);
/** The Architecture Engineering decision catalogue: where placement alternatives live. */
const DECISIONS = readFileSync(resolve(ROOT, 'pattern-library/architecture-engineering/decisions.json'), 'utf8');
const byId = new Map(registry.patterns.map((pattern) => [pattern.id, pattern]));
const graph = patternGraph(registry);
const renamed = new Map(manifest.entries.map((entry) => [entry.previousId, entry.target]));

/** Old ids → new ids inside text, so a sentence that only names a renamed record still matches. */
const OLD_ID = new RegExp(
	`(?<![A-Za-z0-9_-])(${[...renamed.keys()]
		.filter((id) => renamed.get(id) !== id)
		.sort((a, b) => b.length - a.length)
		.map((id) => id.replace(/-/g, '\\-'))
		.join('|')})(?![A-Za-z0-9_-])`,
	'g',
);
const normalize = (text: string | undefined) => (text ?? '').replace(OLD_ID, (id) => renamed.get(id) ?? id);
const now = (id: string) => renamed.get(id) ?? id;

const REF_FIELDS = ['docs', 'code', 'tests', 'showcases'] as const;
/** Evidence refs stay evidence: a test moved into `docs` no longer pins anything. */
const EVIDENCE_FIELDS: readonly string[] = ['tests', 'showcases'];
const TEXT_FIELDS = ['capabilities', 'keywords', 'avoid_when', 'emulation_notes'] as const;
const MATURITY_RANK = ['planned', 'implemented', 'proven'];

/** One preserved item: its identity (what a correction names) and the check that proves it. */
interface Item {
	field: string;
	value: string;
	/** Why the item is not preserved on these targets, or null when it is. */
	lost(targets: PatternRecord[]): string | null;
}

function refItem(field: (typeof REF_FIELDS)[number], ref: RegRef): Item {
	return {
		field,
		value: ref.path,
		lost(targets) {
			const fields = EVIDENCE_FIELDS.includes(field) ? EVIDENCE_FIELDS : REF_FIELDS;
			const candidates = targets.flatMap((target) =>
				fields
					.flatMap((name) => target[name as (typeof REF_FIELDS)[number]])
					.filter((entry) => entry.path === ref.path),
			);
			if (candidates.length === 0)
				return `ref missing${EVIDENCE_FIELDS.includes(field) ? ' from the evidence fields' : ''}`;
			const exact = candidates.filter(
				(entry) => (ref.anchor ?? '') === (entry.anchor ?? '') && (ref.kind === undefined || ref.kind === entry.kind),
			);
			if (exact.length === 0) return `anchor or kind changed (${ref.anchor ?? '-'} / ${ref.kind ?? '-'})`;
			// Merged annotations are joined into one sentence, so case is not significant.
			const note = normalize(ref.note).toLowerCase();
			if (note.length > 0 && !exact.some((entry) => normalize(entry.note).toLowerCase().includes(note))) {
				return 'annotation lost';
			}
			return null;
		},
	};
}

function textItem(field: (typeof TEXT_FIELDS)[number], value: string): Item {
	return {
		field,
		value,
		lost: (targets) =>
			targets.some((target) => target[field].some((text) => normalize(text) === normalize(value)))
				? null
				: 'text missing',
	};
}

function invariantItem(value: string): Item {
	return {
		field: 'invariants',
		value,
		lost: (targets) =>
			targets.some(
				(target) =>
					target.invariants.some((text) => normalize(text) === normalize(value)) ||
					graph
						.inheritedInvariants(target.id)
						.some((entry) => entry.invariants.some((text) => normalize(text) === normalize(value))),
			)
				? null
				: 'invariant does not hold on the target, own or inherited',
	};
}

function alternativeItem(alternative: { approach: string; prefer_when: string }): Item {
	return {
		field: 'alternatives',
		value: alternative.approach,
		lost(targets) {
			const same = targets.flatMap((target) =>
				target.alternatives.filter((entry) => normalize(entry.approach) === normalize(alternative.approach)),
			);
			if (same.length === 0) return 'alternative missing';
			return same.some((entry) => normalize(entry.prefer_when) === normalize(alternative.prefer_when))
				? null
				: 'prefer_when changed';
		},
	};
}

/** Whether a declaration on the target carries the old one's semantics. */
function sameNeed(old: NeedDeclaration, current: NeedDeclaration): string | null {
	if (current.level !== old.level) return `level ${old.level} → ${current.level}`;
	if (normalize(old.when) !== normalize(current.when)) return 'condition changed';
	if ((old.pinned ?? '') !== (current.pinned ?? '')) return `pin ${old.pinned ?? 'none'} → ${current.pinned ?? 'none'}`;
	// A pin and a weak level are claims that need their justification.
	const justified = old.pinned !== undefined || old.level === 'optional' || old.level === 'implementation';
	if (justified && old.why && !normalize(current.why).includes(normalize(old.why))) return 'justification lost';
	return null;
}

function needItem(entry: NeedEntry): Item {
	const old = needDeclaration(entry);
	return {
		field: 'needs',
		value: old.need,
		lost(targets) {
			const declared = targets
				.flatMap((target) => target.needs.map(needDeclaration))
				.filter((need) => need.need === old.need);
			const reasons = declared.map((need) => sameNeed(old, need));
			if (reasons.includes(null)) return null;
			// Carried by a relationship: the target's resolved adoption needs state it at the same level and pin.
			const carried = targets.some((target) =>
				graph
					.needs(target.id)
					.some(
						(need) =>
							need.need === old.need &&
							need.level === old.level &&
							(old.pinned === undefined || need.pins.some((pin) => pin.technology === old.pinned)) &&
							(old.when === undefined || need.conditions.some((condition) => condition.includes(normalize(old.when)))),
					),
			);
			return carried ? null : (reasons[0] ?? 'need missing');
		},
	};
}

/** A proven record's verification survives only on a target that still claims proof for it. */
function maturityItem(record: SnapshotRecord): Item | null {
	if (record.maturity !== 'proven') return null;
	return {
		field: 'maturity',
		value: record.maturity,
		lost: (targets) =>
			targets.some(
				(target) => MATURITY_RANK.indexOf(target.maturity) >= MATURITY_RANK.indexOf('proven') && target.verifiedAt,
			)
				? null
				: `proven (verified ${record.verifiedAt ?? '?'}) on a target that is not proven`,
	};
}

function relationshipItem(from: string, to: string): Item {
	return {
		field: 'depends_on',
		value: to,
		lost(targets) {
			const id = now(to);
			for (const target of targets) {
				if (id === target.id) return null;
				const related = [
					...adoptionTargets(target).map((edge) => edge.id),
					...target.references.map((entry) => entry.id),
					...target.alternatives.flatMap((alternative) => (alternative.pattern ? [alternative.pattern] : [])),
					...graph.effectiveEdges(target.id).map((edge) => edge.to),
					...graph.assumptionsFor(target.id).map((assumption) => assumption.id),
				];
				if (related.includes(id)) return null;
			}
			const fate = relationships.entries.find(
				(entry) =>
					entry.before === 'depends_on' && (entry.from === now(from) || entry.from === from) && entry.to === id,
			);
			return fate && fate.why.length > 20 ? null : 'relationship has no counterpart and no recorded fate';
		},
	};
}

function items(entry: ManifestEntry): Item[] {
	const { record } = entry;
	const maturity = maturityItem(record);
	return [
		...REF_FIELDS.flatMap((field) => record[field].map((ref) => refItem(field, ref))),
		...TEXT_FIELDS.flatMap((field) => record[field].map((value) => textItem(field, value))),
		...record.invariants.map(invariantItem),
		...record.alternatives.map(alternativeItem),
		...record.needs.map(needItem),
		...(maturity ? [maturity] : []),
		...record.depends_on.map((to) => relationshipItem(record.id, to)),
		...(['summary', 'when_to_use'] as const).map(
			(field): Item => ({
				field,
				value: record[field],
				// May survive as the target's own text or on a transferred ref's note.
				lost: (targets) =>
					targets.some((target) =>
						normalize(JSON.stringify(target)).includes(JSON.stringify(normalize(record[field])).slice(1, -1)),
					)
						? null
						: 'text missing',
			}),
		),
	];
}

/** A reclassification is a claim about where the item went; the gate checks the claim. */
function reclassificationHolds(
	correction: NonNullable<ManifestEntry['reclassified']>[number],
	targets: PatternRecord[],
): boolean {
	if (correction.reason.length <= 20) return false;
	if (correction.to === 'keywords') {
		return targets.some((target) =>
			target.keywords.some((keyword) => normalize(keyword) === normalize(correction.value)),
		);
	}
	const level = correction.to.match(/^needs \((required|conditional|optional|implementation)\b/)?.[1];
	if (level) {
		return targets.some(
			(target) =>
				target.needs.some(
					(need) => needDeclaration(need).need === correction.value && needDeclaration(need).level === level,
				) || graph.needs(target.id).some((need) => need.need === correction.value && need.level === level),
		);
	}
	return false;
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

	it('says which state each snapshot is, and explains every pre-reconciliation correction', () => {
		for (const entry of manifest.entries) {
			expect(['slice-1', 'corrected-before-reconciliation'], entry.previousId).toContain(entry.recordState);
			expect(entry.recordState === 'corrected-before-reconciliation', entry.previousId).toBe(
				entry.historical !== undefined,
			);
			for (const difference of entry.historical?.differences ?? []) {
				expect(difference.reason.length, `${entry.previousId}.${difference.field}`).toBeGreaterThan(20);
			}
		}
	});

	it('a corrected snapshot differs from its historical record exactly in the fields it explains', () => {
		for (const entry of manifest.entries.filter((candidate) => candidate.historical)) {
			const { commit, differences } = entry.historical as NonNullable<ManifestEntry['historical']>;
			const historical = (
				JSON.parse(
					execSync(`git show ${commit}:pattern-library/registry.json`, {
						cwd: ROOT,
						maxBuffer: 64 * 1024 * 1024,
					}).toString(),
				) as { patterns: Record<string, unknown>[] }
			).patterns.find((pattern) => pattern.id === entry.previousId);
			expect(historical, `${entry.previousId} at ${commit}`).toBeDefined();
			const changed = Object.keys({ ...historical, ...entry.record }).filter(
				(field) =>
					field !== 'kind' &&
					JSON.stringify((historical as Record<string, unknown>)[field]) !==
						JSON.stringify((entry.record as unknown as Record<string, unknown>)[field]),
			);
			expect(changed.sort(), entry.previousId).toEqual(differences.map((difference) => difference.field).sort());
			for (const difference of differences) {
				expect(difference.slice1, `${entry.previousId}.${difference.field}`).toEqual(
					(historical as Record<string, unknown>)[difference.field],
				);
			}
		}
	});

	it('every reclassification names where the item went, and the item is there', () => {
		for (const entry of manifest.entries) {
			const targets = [entry.target, entry.alsoTarget].flatMap((id) => (id ? [byId.get(id) as PatternRecord] : []));
			for (const correction of entry.reclassified ?? []) {
				expect(reclassificationHolds(correction, targets), `${entry.previousId}: ${JSON.stringify(correction)}`).toBe(
					true,
				);
			}
		}
	});

	for (const entry of manifest.entries) {
		it(`${entry.previousId} (${entry.action} → ${entry.target}) loses no knowledge`, () => {
			const targets = [entry.target, entry.alsoTarget]
				.filter((id): id is string => typeof id === 'string')
				.map((id) => byId.get(id) as PatternRecord);
			const corrected = (field: string, value: string) =>
				entry.dropped.some((dropped) => dropped.field === field && dropped.value === value) ||
				(entry.reclassified ?? []).some(
					(correction) =>
						correction.field === field && correction.value === value && reclassificationHolds(correction, targets),
				);
			const lost = items(entry)
				.map((item) => ({ field: item.field, value: item.value, why: item.lost(targets) }))
				.filter((item) => item.why !== null && !corrected(item.field, item.value));
			expect(lost, 'items neither preserved on the target nor recorded as an intentional correction').toEqual([]);
		});
	}
});

describe('relationship migration manifest', () => {
	const current = registry.patterns.flatMap((pattern) => [
		...adoptionTargets(pattern).map((edge) => ({ from: pattern.id, to: edge.id, type: edge.type as string })),
		...pattern.references.map((entry) => ({ from: pattern.id, to: entry.id, type: 'references' })),
	]);
	const key = (edge: { from: string; to: string; type: string }) => `${edge.from} -${edge.type}-> ${edge.to}`;

	it('records every current relationship exactly once, with its type, level and condition', () => {
		const recorded = relationships.entries.filter((entry) => entry.after.type !== 'none');
		expect(recorded.map((entry) => key({ ...entry, type: entry.after.type })).sort()).toEqual(current.map(key).sort());
		for (const entry of recorded) {
			const pattern = byId.get(entry.from) as PatternRecord;
			if (entry.after.type !== 'composes') continue;
			const constituent = pattern.composes.find((candidate) => candidate.id === entry.to);
			expect(constituent?.level, key({ ...entry, type: 'composes' })).toBe(entry.after.level);
			expect(constituent?.when, key({ ...entry, type: 'composes' })).toBe(entry.after.when);
		}
	});

	it('gives every depends_on edge of the base commit exactly one fate, with a reason', () => {
		const base = (
			JSON.parse(
				execSync(`git show ${relationships.baseCommit}:pattern-library/registry.json`, {
					cwd: ROOT,
					maxBuffer: 64 * 1024 * 1024,
				}).toString(),
			) as { patterns: SnapshotRecord[] }
		).patterns.flatMap((pattern) => pattern.depends_on.map((to) => `${pattern.id} -> ${to}`));
		const migrated = relationships.entries
			.filter((entry) => entry.before === 'depends_on')
			.map((entry) => `${entry.from} -> ${entry.to}`);
		expect(migrated.sort()).toEqual(base.sort());
		for (const entry of relationships.entries)
			expect(entry.why.length, `${entry.from} → ${entry.to}`).toBeGreaterThan(20);
	});

	it('a dropped edge names where its knowledge lives, and that home exists', () => {
		for (const entry of relationships.entries.filter((candidate) => candidate.after.type === 'none')) {
			const from = byId.get(entry.from) as PatternRecord;
			const home = entry.after.home;
			if (home === 'assumption') {
				expect(
					graph.assumptionsFor(entry.from).map((assumption) => assumption.id),
					`${entry.from} → ${entry.to}`,
				).toContain(entry.to);
			} else if (home === 'alternative') {
				expect(
					from.alternatives.map((alternative) => alternative.pattern),
					`${entry.from} → ${entry.to}`,
				).toContain(entry.to);
			} else if (home === 'inherited') {
				expect(
					graph.effectiveEdges(entry.from).map((edge) => edge.to),
					`${entry.from} → ${entry.to}`,
				).toContain(entry.to);
			} else if (home === 'reference') {
				// The pair is related once; the reference may point either way.
				const to = byId.get(entry.to) as PatternRecord;
				const linked =
					from.references.some((reference) => reference.id === entry.to) ||
					to.references.some((reference) => reference.id === entry.from);
				expect(linked, `${entry.from} ↔ ${entry.to}`).toBe(true);
			} else {
				expect(home, `${entry.from} → ${entry.to}`).toBe('decision catalogue');
				expect(DECISIONS, `${entry.from} → ${entry.to}`).toContain(`"${entry.to}"`);
			}
		}
	});
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
