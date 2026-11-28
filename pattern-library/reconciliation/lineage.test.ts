/**
 * The analytics lineage (`lineage.ts`): read-time attribution of historical telemetry subjects,
 * derived from the reconciliation manifest, and proof that it is not a compatibility layer.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REGISTRY } from '../../src/lib/server/patterns/registry.ts';
import { attributeUsage, historicalLineage, type ManifestEntry } from './lineage.ts';
import manifestJson from './manifest.json';

const entries = (manifestJson as { entries: ManifestEntry[] }).entries;
const current = new Set(REGISTRY.patterns.map((pattern) => pattern.id));
const lineage = historicalLineage(entries, current);
const before = new Date('2026-11-01T00:00:00Z');
const unreleased = { releasedAt: null };
const of = (action: ManifestEntry['action']) => entries.filter((entry) => entry.action === action);

describe('historical lineage from the manifest', () => {
	it('derives every lineage from the manifest: each previous id resolves by its action', () => {
		for (const entry of entries) {
			const found = lineage(entry.previousId, before, unreleased);
			const expected =
				entry.action === 'split'
					? 'split'
					: entry.action === 'retire'
						? 'retired'
						: entry.action === 'merge'
							? 'merged'
							: entry.target === entry.previousId
								? 'current'
								: 'renamed';
			expect(found.kind, entry.previousId).toBe(expected);
		}
	});

	it('a rename is a direct correspondence; a merge attributes many old ids to one', () => {
		const rename = of('rename').find((entry) => entry.previousId !== entry.target) as ManifestEntry;
		expect(lineage(rename.previousId, before, unreleased)).toEqual({
			kind: 'renamed',
			from: rename.previousId,
			to: rename.target,
		});
		const merge = of('merge')[0];
		const usage = attributeUsage(
			[
				{ subject: merge.previousId, count: 3, recordedAt: before },
				{ subject: merge.target, count: 2, recordedAt: before },
			],
			lineage,
			unreleased,
		);
		expect(usage.current.get(merge.target)).toBe(5);
	});

	it('a split stays ambiguous: the history is not copied onto every resulting record', () => {
		const split = of('split')[0];
		const usage = attributeUsage([{ subject: split.previousId, count: 7, recordedAt: before }], lineage, unreleased);
		expect(usage.ambiguous).toEqual([
			{ from: split.previousId, candidates: [split.target, split.alsoTarget].sort(), count: 7 },
		]);
		expect([...usage.current.values()].reduce((sum, count) => sum + count, 0)).toBe(0);
		// After the release, the kept id means the narrower record again.
		const released = { releasedAt: new Date('2026-12-01T00:00:00Z') };
		const later = attributeUsage(
			[{ subject: split.previousId, count: 2, recordedAt: new Date('2026-12-02T00:00:00Z') }],
			lineage,
			released,
		);
		expect(later.current.get(split.previousId)).toBe(2);
	});

	it('a retired identity is kept; the record holding its knowledge is context, never adoption', () => {
		const retire = of('retire')[0];
		const usage = attributeUsage([{ subject: retire.previousId, count: 4, recordedAt: before }], lineage, unreleased);
		expect(usage.retired).toEqual([{ from: retire.previousId, knowledgeIn: retire.target, count: 4 }]);
		expect(usage.current.has(retire.target)).toBe(false);
	});

	it('sentinels and excerpt paths are not patterns; an unknown id stays unknown', () => {
		const usage = attributeUsage(
			[
				{ subject: '(invalid)', count: 1, recordedAt: before },
				{ subject: 'src/lib/server/x.ts', count: 1, recordedAt: before },
				{ subject: 'never-existed', count: 1, recordedAt: before },
			],
			lineage,
			unreleased,
		);
		expect(usage.notPatterns).toBe(2);
		expect(usage.unknown).toEqual([{ id: 'never-existed', count: 1 }]);
	});
});

describe('the lineage is analytics only — not a compatibility layer', () => {
	const ROOT = resolve(import.meta.dirname, '../..');
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const path = join(dir, name);
			return statSync(path).isDirectory() ? files(path) : /\.(ts|js|svelte)$/.test(name) ? [path] : [];
		});

	it('no tool, planner, transport or registry reader imports it', () => {
		const readers = [
			...files(resolve(ROOT, 'pattern-library')).filter((path) => !path.includes('/reconciliation/')),
			...files(resolve(ROOT, 'mcp')).filter((path) => !path.endsWith('.bundle.js')),
			...files(resolve(ROOT, 'src/lib/server/mcp')).filter((path) => !path.includes('/telemetry/')),
			...files(resolve(ROOT, 'src/lib/server/patterns')),
			...files(resolve(ROOT, 'src/lib/server/ai')),
		];
		const importers = readers.filter((path) => readFileSync(path, 'utf8').includes('reconciliation/lineage'));
		expect(importers).toEqual([]);
	});

	it('the registry holds current ids only', () => {
		const previous = new Set(
			entries.filter((entry) => entry.previousId !== entry.target).map((entry) => entry.previousId),
		);
		expect(REGISTRY.patterns.filter((pattern) => previous.has(pattern.id)).map((pattern) => pattern.id)).toEqual([]);
	});
});
