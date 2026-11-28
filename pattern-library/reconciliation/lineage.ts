/**
 * Historical lineage of pattern identities, for ANALYTICS ONLY (Slice 4, release checklist row 1).
 *
 * Stored telemetry (`mcp.call_log.subject`) keeps the identity a call was answered with: rows are
 * evidence of what happened and are never rewritten. This module reads them at query time and says
 * how an old subject relates to today's registry, derived from `manifest.json` alone — there is no
 * second mapping table to drift:
 *
 * - `rename` / `rename+reclassify` → `renamed`: a direct correspondence, attributed to the new id;
 * - `merge` → `merged`: many old ids attribute to the one record they became;
 * - `split` → `split`: ambiguous — the history is NOT copied onto every resulting record; the
 *   candidates are named and the count stays unattributed;
 * - `retire` → `retired`: the old identity is kept. The record that absorbed its knowledge is
 *   named as context only: a call to a former showcase or implementation record is not adoption
 *   of the canonical pattern.
 *
 * It is not a compatibility layer: no MCP tool, planner or registry reader may resolve an id
 * through it (`lineage.test.ts` proves no tool module imports it), and the registry holds current
 * ids only. Framework-free and filesystem-free: the caller passes the manifest and current ids.
 */

export interface ManifestEntry {
	previousId: string;
	target: string;
	alsoTarget?: string;
	action: 'rename' | 'rename+reclassify' | 'merge' | 'retire' | 'split';
}

export type Lineage =
	| { kind: 'current'; id: string }
	| { kind: 'renamed'; from: string; to: string }
	| { kind: 'merged'; from: string; into: string }
	| { kind: 'split'; from: string; candidates: string[] }
	| { kind: 'retired'; from: string; knowledgeIn: string }
	/** Not a pattern id at all: a sentinel (`(invalid)`, `(no-match)`) or an excerpt path. */
	| { kind: 'not-a-pattern'; subject: string }
	/** A pattern-shaped id that is neither current nor in the manifest. */
	| { kind: 'unknown'; id: string };

export interface LineageOptions {
	/**
	 * When the reconciled registry reached production. A subject that is still a current id but
	 * was split (it kept its id and narrowed) is ambiguous only for rows recorded before this;
	 * null = not released yet, so every row predates it.
	 */
	releasedAt: Date | null;
}

const PATTERN_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function historicalLineage(entries: readonly ManifestEntry[], currentIds: ReadonlySet<string>) {
	const byPrevious = new Map(entries.map((entry) => [entry.previousId, entry]));
	return (subject: string, recordedAt: Date, options: LineageOptions): Lineage => {
		if (!PATTERN_ID.test(subject)) return { kind: 'not-a-pattern', subject };
		const entry = byPrevious.get(subject);
		const predates = options.releasedAt === null || recordedAt < options.releasedAt;
		if (entry && predates) {
			switch (entry.action) {
				case 'split':
					return {
						kind: 'split',
						from: subject,
						candidates: [entry.target, ...(entry.alsoTarget ? [entry.alsoTarget] : [])].sort(),
					};
				case 'retire':
					return { kind: 'retired', from: subject, knowledgeIn: entry.target };
				case 'merge':
					return { kind: 'merged', from: subject, into: entry.target };
				default:
					return entry.target === subject
						? { kind: 'current', id: subject }
						: { kind: 'renamed', from: subject, to: entry.target };
			}
		}
		if (currentIds.has(subject)) return { kind: 'current', id: subject };
		return { kind: 'unknown', id: subject };
	};
}

export interface SubjectCount {
	subject: string;
	count: number;
	recordedAt: Date;
}

/** Counts grouped for an analytics panel, with every ambiguity and retired identity kept apart. */
export interface AttributedUsage {
	/** Current id → calls attributable to it (its own, renamed and merged history). */
	current: Map<string, number>;
	/** Split identities: never divided among the candidates. */
	ambiguous: { from: string; candidates: string[]; count: number }[];
	/** Retired identities, kept as they were. */
	retired: { from: string; knowledgeIn: string; count: number }[];
	unknown: { id: string; count: number }[];
	notPatterns: number;
}

export function attributeUsage(
	rows: readonly SubjectCount[],
	lineage: ReturnType<typeof historicalLineage>,
	options: LineageOptions,
): AttributedUsage {
	const current = new Map<string, number>();
	const ambiguous = new Map<string, { from: string; candidates: string[]; count: number }>();
	const retired = new Map<string, { from: string; knowledgeIn: string; count: number }>();
	const unknown = new Map<string, number>();
	let notPatterns = 0;
	const add = (map: Map<string, number>, key: string, count: number) => map.set(key, (map.get(key) ?? 0) + count);
	for (const row of rows) {
		const found = lineage(row.subject, row.recordedAt, options);
		switch (found.kind) {
			case 'current':
				add(current, found.id, row.count);
				break;
			case 'renamed':
				add(current, found.to, row.count);
				break;
			case 'merged':
				add(current, found.into, row.count);
				break;
			case 'split': {
				const known = ambiguous.get(found.from) ?? { from: found.from, candidates: found.candidates, count: 0 };
				known.count += row.count;
				ambiguous.set(found.from, known);
				break;
			}
			case 'retired': {
				const known = retired.get(found.from) ?? { from: found.from, knowledgeIn: found.knowledgeIn, count: 0 };
				known.count += row.count;
				retired.set(found.from, known);
				break;
			}
			case 'unknown':
				add(unknown, found.id, row.count);
				break;
			default:
				notPatterns += row.count;
		}
	}
	const byId = <T extends { from: string }>(values: Iterable<T>) =>
		[...values].sort((a, b) => (a.from < b.from ? -1 : 1));
	return {
		current: new Map([...current].sort(([a], [b]) => (a < b ? -1 : 1))),
		ambiguous: byId(ambiguous.values()),
		retired: byId(retired.values()),
		unknown: [...unknown].map(([id, count]) => ({ id, count })).sort((a, b) => (a.id < b.id ? -1 : 1)),
		notPatterns,
	};
}
