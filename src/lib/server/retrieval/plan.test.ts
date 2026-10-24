import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { contentHash } from '../db/content-hash';
import { CHUNKER_VERSION, planChunks } from './plan';

const OPTS = { sectionTarget: 1000, paragraphTarget: 300, overlap: 50 };

describe('planChunks', () => {
	it('returns a single parent for short text', async () => {
		const { parents } = await planChunks('Hello world.', OPTS);
		expect(parents).toHaveLength(1);
		expect(parents[0].level).toBe('section');
		expect(parents[0].content).toBe('Hello world.');
		expect(parents[0].position).toBe(0);
	});

	it('produces children nested under their parent', async () => {
		const { parents, children } = await planChunks('Short text.', OPTS);
		expect(children.length).toBeGreaterThanOrEqual(1);
		for (const child of children) {
			expect(child.parentId).toBe(parents[0].id);
			expect(child.level).toBe('paragraph');
		}
	});

	it('splits long text into multiple parents with sequential positions', async () => {
		const longText = Array.from(
			{ length: 30 },
			(_, i) => `Paragraph ${i}: ${'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(5)}`,
		).join('\n\n');
		const { parents } = await planChunks(longText, OPTS);
		expect(parents.length).toBeGreaterThan(1);
		for (let i = 0; i < parents.length; i++) expect(parents[i].position).toBe(i);
	});

	it('generates unique chk_ ids and SHA-256 content hashes', async () => {
		const { parents, children } = await planChunks('Test content.\n\nAnother paragraph.', OPTS);
		const allIds = [...parents, ...children].map((c) => c.id);
		for (const id of allIds) expect(id).toMatch(/^chk_[a-f0-9]{12}$/);
		expect(new Set(allIds).size).toBe(allIds.length);
		expect(parents[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it('passes tuning through — a tiny section target never yields fewer parents than a huge one', async () => {
		const text = Array.from({ length: 12 }, (_, i) => `Body paragraph ${i}. ${'word '.repeat(40)}`).join('\n\n');
		const small = await planChunks(text, { sectionTarget: 40, paragraphTarget: 30, overlap: 0 });
		const large = await planChunks(text, { sectionTarget: 100_000, paragraphTarget: 300, overlap: 0 });
		expect(large.parents).toHaveLength(1);
		expect(small.parents.length).toBeGreaterThanOrEqual(large.parents.length);
	});
});

describe('chunker output fingerprint', () => {
	// Stored chunks are derivations of their documents through this planner, keyed by
	// CHUNKER_VERSION. If this fingerprint moves, the planner's OUTPUT changed: decide whether
	// existing corpora must be re-derived (bump CHUNKER_VERSION, then re-pin both values) or
	// the change is output-neutral after all. Re-pinning without that decision is how a corpus
	// silently goes stale.
	const FIXTURE = [
		'# Title',
		'',
		'Intro paragraph with a [link](/docs) and `code`.',
		'',
		'## Section A',
		'',
		...Array.from({ length: 8 }, (_, i) => `Paragraph A${i}. ${'alpha beta gamma delta '.repeat(12)}`),
		'',
		'## Section B',
		'',
		'```ts',
		'const x = 1;',
		'```',
		'',
		...Array.from({ length: 5 }, (_, i) => `- list item ${i} ${'word '.repeat(20)}`),
		'',
		'### Section C',
		'',
		'| col a | col b |',
		'| --- | --- |',
		...Array.from({ length: 6 }, (_, i) => `| row ${i} ${'cell '.repeat(6)} | ${'value '.repeat(6)} |`),
		'',
		`One oversized paragraph that must be split by the overlap logic. ${'lorem ipsum dolor sit '.repeat(80)}`,
		'',
		'#### Windows line endings\r',
		'',
		'A paragraph ending in CRLF.\r',
	].join('\n');

	it('matches the output pinned for this CHUNKER_VERSION', async () => {
		const { parents, children } = await planChunks(FIXTURE, { sectionTarget: 200, paragraphTarget: 60, overlap: 10 });
		const parentIndex = new Map(parents.map((p, i) => [p.id, i]));
		const shape = [
			...parents.map((p) => ['s', p.position, p.tokenCount, p.content]),
			...children.map((c) => ['p', parentIndex.get(c.parentId ?? ''), c.position, c.tokenCount, c.content]),
		];
		expect({ version: CHUNKER_VERSION, fingerprint: await contentHash(JSON.stringify(shape)) }).toEqual({
			version: 1,
			fingerprint: 'd6a6f80b35b7c1f1a051be3906cdfcea82472463c66c8890b59670eb7079cb55',
		});
	});
});

describe('Bun-importable purity', () => {
	// plan.ts + its pure deps are imported by the standalone Bun ingest script via relative
	// path. A stray `#lib` import (its closure can reach SvelteKit's `$app/*` virtual modules),
	// a `$app/*` import or import.meta would silently re-break `db:ingest-docs`. Guard the
	// contract at the source level so a future careless import is caught here, not in production.
	const pureModules = ['./plan.ts', './markdown-split.ts', '../retrieval-shared/embed-config.ts'];
	for (const rel of pureModules) {
		it(`${rel} imports no #lib / $app module and uses no import.meta`, () => {
			const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
			// Match actual USAGE (static/dynamic alias imports, import.meta property access),
			// not the prose mentions of these tokens in the modules' own purity-contract comments.
			expect(src).not.toMatch(/(?:from|import)\s*\(?\s*['"][#$]/);
			expect(src).not.toMatch(/import\.meta\./);
		});
	}
});
