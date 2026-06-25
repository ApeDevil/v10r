import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { planChunks } from './plan';

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

describe('Bun-importable purity', () => {
	// plan.ts + its pure deps are imported by the standalone Bun ingest script via relative
	// path, which cannot resolve Vite aliases. A stray $lib / $env / import.meta would
	// silently re-break `db:ingest-docs`. Guard the contract at the source level so a future
	// careless import is caught here, not in production.
	const pureModules = ['./plan.ts', './markdown-split.ts', '../rag-shared/embed-config.ts'];
	for (const rel of pureModules) {
		it(`${rel} imports no $lib / $env alias and uses no import.meta`, () => {
			const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');
			// Match actual USAGE (static/dynamic alias imports, import.meta property access),
			// not the prose mentions of these tokens in the modules' own purity-contract comments.
			expect(src).not.toMatch(/(?:from|import)\s*\(?\s*['"]\$(?:lib|env)/);
			expect(src).not.toMatch(/import\.meta\./);
		});
	}
});
