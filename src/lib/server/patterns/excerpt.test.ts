import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PATTERNS } from '#lib/server/patterns/index.ts';
import { renderExcerpt, splitFragment } from '#patterns/excerpt.ts';

const CODE = [
	"import { x } from './x';",
	'',
	'/** The first. */',
	'export const FIRST = 1;',
	'',
	'/**',
	' * Does the thing.',
	' */',
	'export function doThing(a: number): number {',
	'',
	'\treturn a + FIRST;',
	'}',
	'',
	'// A trailing helper.',
	'function helper() {}',
	'',
].join('\n');

const DOC = [
	'# Title',
	'intro',
	'## Alpha / beta',
	'alpha body',
	'### Nested',
	'nested body',
	'```md',
	'## Not a heading',
	'```',
	'## Gamma',
	'gamma body',
].join('\n');

describe('renderExcerpt — sections', () => {
	it('returns a code declaration with its doc comment, up to the next top-level item', () => {
		const result = renderExcerpt('a.ts', CODE, { section: 'doThing' });
		expect(result.ok && [result.shownFrom, result.shownTo]).toEqual([6, 12]);
		expect(result.ok && result.text).toContain('§ doThing');
	});

	it('accepts a call-style name and ignores case', () => {
		const result = renderExcerpt('a.ts', CODE, { section: 'DOTHING()' });
		expect(result.ok && result.shownFrom).toBe(6);
	});

	it('returns a markdown heading with its sub-headings, by text or by slug', () => {
		for (const section of ['Alpha / beta', 'alpha--beta']) {
			const result = renderExcerpt('a.md', DOC, { section });
			expect(result.ok && [result.shownFrom, result.shownTo], section).toEqual([3, 9]);
		}
	});

	it('does not mistake a heading inside a fenced block for a section', () => {
		const result = renderExcerpt('a.md', DOC, { section: 'Not a heading' });
		expect(result.ok).toBe(false);
	});

	it('names what exists when the section does not', () => {
		const result = renderExcerpt('a.ts', CODE, { section: 'missing' });
		expect(result.ok).toBe(false);
		expect(!result.ok && result.reason).toBe('no_section');
		expect(result.text).toContain('FIRST (L3), doThing (L6), helper (L14)');
	});

	it('caps a long section and says where it continues', () => {
		const result = renderExcerpt('a.ts', CODE, { section: 'doThing', lineCount: 2 });
		expect(result.ok && result.shownTo).toBe(7);
		expect(result.text).toContain('section continues to line 12 — request start_line 8');
	});
});

describe('renderExcerpt — windows', () => {
	it('ends a window that stops early with the sections below it', () => {
		const result = renderExcerpt('a.md', DOC, { startLine: 1, lineCount: 4 });
		expect(result.text).toContain('more lines. Sections below — pass one as section: Nested (L5), Gamma (L10)');
	});

	it('adds nothing when the window reaches the end of the file', () => {
		const result = renderExcerpt('a.md', DOC, {});
		expect(result.text).not.toContain('more lines');
	});

	it('keeps the beyond-EOF answer actionable', () => {
		const result = renderExcerpt('a.md', DOC, { startLine: 999 });
		expect(!result.ok && result.reason).toBe('beyond_eof');
	});
});

describe('splitFragment', () => {
	it('splits the form cards print', () => {
		expect(splitFragment('docs/x.md#a-b')).toEqual({ file: 'docs/x.md', fragment: 'a-b' });
		expect(splitFragment('docs/x.md')).toEqual({ file: 'docs/x.md', fragment: undefined });
	});
});

/**
 * Every `#fragment` a card cites must resolve to a section — the agent reads refs verbatim, so a
 * fragment that names no heading is a dead link the tool would answer with an error.
 */
describe('registry fragments', () => {
	it('every cited #fragment resolves to a heading in its file', () => {
		const dead = PATTERNS.flatMap((pattern) =>
			[...pattern.docs, ...pattern.code, ...pattern.tests]
				.map((ref) => splitFragment(ref.path))
				.filter((ref): ref is { file: string; fragment: string } => ref.fragment !== undefined)
				.filter(({ file, fragment }) => !renderExcerpt(file, readFileSync(file, 'utf8'), { section: fragment }).ok)
				.map(({ file, fragment }) => `${pattern.id}: ${file}#${fragment}`),
		);
		expect(dead).toEqual([]);
	});
});
