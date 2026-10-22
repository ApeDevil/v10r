/**
 * AGENT INSTRUCTIONS GATE — the files every coding agent loads before it reads anything else
 * (`AGENTS.md`, `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/**`) must not route it to
 * code that is gone, and must not carry text a human reviewer cannot see.
 *
 * Stale routing is the common failure of context files: a refactor moves a directory, the
 * routing table keeps pointing at it, and every agent after that starts by reading nothing.
 * Hidden bidi and zero-width characters are the rule-file backdoor class — instructions an
 * agent obeys and a reviewer never sees in the diff.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function markdownUnder(dir: string): string[] {
	const abs = join(ROOT, dir);
	if (!existsSync(abs)) return [];
	return readdirSync(abs, { recursive: true, encoding: 'utf8' })
		.filter((name) => name.endsWith('.md'))
		.map((name) => join(dir, name));
}

const FILES = ['AGENTS.md', 'CLAUDE.md', ...markdownUnder('.claude/agents'), ...markdownUnder('.claude/skills')];

/** Repo paths are backticked and start with a top-level directory or name a root config file. */
const PATH_PREFIX = /^(src|docs|scripts|pattern-library|mcp|messages|static|crates|bin|\.claude)\//;
const ROOT_FILES = new Set(['compose.yaml', 'package.json', 'drizzle.config.ts', 'svelte.config.js', 'vercel.json']);
/** Placeholders and globs name a shape, not a path (`$lib/` is resolved to `src/lib/` first). */
const NOT_A_PATH = /[*<>{}…$]|\[(domain|layer)\]|\.\.\./;
/** A bare `name/` in a routing table is relative to one of these. */
const DIR_BASES = ['', 'src/lib/server/', 'src/lib/', 'src/routes/', 'docs/'];
/** Paths named on purpose as absent. Each entry must still be mentioned, or the gate fails. */
const ABSENT_ON_PURPOSE: ReadonlyArray<{ file: string; path: string; why: string }> = [
	{
		file: '.claude/agents/cony.md',
		path: 'src/lib/server/i18n',
		why: 'states that the directory deliberately does not exist yet',
	},
	...['arty', 'laly', 'visy'].map((agent) => ({
		file: `.claude/agents/${agent}.md`,
		path: `.claude/agent-memory/${agent}`,
		why: 'the agent creates its memory directory on its first save',
	})),
];

/**
 * Zero-width, bidi-override and Unicode tag characters (U+E0000–E007F) — invisible in a diff.
 * Numeric ranges, not a regex: a formatter once rewrote this regex's escapes into the very
 * invisible characters it exists to find.
 */
const HIDDEN_RANGES: ReadonlyArray<readonly [number, number]> = [
	[0x200b, 0x200f],
	[0x202a, 0x202e],
	[0x2060, 0x2064],
	[0x2066, 0x2069],
	[0xfeff, 0xfeff],
	[0xe0000, 0xe007f],
];

function hasHiddenCharacter(text: string): boolean {
	for (const char of text) {
		const point = char.codePointAt(0) ?? 0;
		if (HIDDEN_RANGES.some(([low, high]) => point >= low && point <= high)) return true;
	}
	return false;
}

interface Mention {
	file: string;
	token: string;
	candidates: string[];
}

function mentions(): Mention[] {
	const found: Mention[] = [];
	for (const file of FILES) {
		const text = readFileSync(join(ROOT, file), 'utf8');
		for (const [, token] of text.matchAll(/`([^`\s]+)`/g)) {
			const path = token
				.replace(/^\$lib\//, 'src/lib/')
				.replace(/(#.*|:\d+(-\d+)?)$/, '')
				.replace(/[.,;:]+$/, '')
				.replace(/\/$/, '');
			if (NOT_A_PATH.test(path)) continue;
			if (PATH_PREFIX.test(path) || ROOT_FILES.has(path)) {
				// A module specifier may omit its extension, as an import would.
				found.push({ file, token, candidates: [path, `${path}.ts`, `${path}.svelte`, `${path}.svelte.ts`] });
			} else if (/^[a-z][a-z0-9_-]*\/$/.test(token)) {
				found.push({ file, token, candidates: DIR_BASES.map((base) => `${base}${path}`) });
			}
		}
	}
	return found;
}

describe('agent instruction files', () => {
	const all = mentions();

	it('scans the files and finds paths (a renamed directory would pass vacuously)', () => {
		expect(FILES.length).toBeGreaterThan(10);
		expect(all.length).toBeGreaterThan(50);
	});

	it('route only to paths that exist', () => {
		const stale = all
			.filter((m) => !m.candidates.some((c) => existsSync(join(ROOT, c))))
			.filter((m) => !ABSENT_ON_PURPOSE.some((a) => a.file === m.file && m.candidates.includes(a.path)))
			.map((m) => `${m.file}: \`${m.token}\``);
		expect(stale).toEqual([]);
	});

	it('keeps no stale allowance', () => {
		for (const allowance of ABSENT_ON_PURPOSE) {
			const mentioned = all.some((m) => m.file === allowance.file && m.candidates.includes(allowance.path));
			expect(mentioned, `${allowance.file} no longer mentions ${allowance.path} — delete the allowance`).toBe(true);
			expect(existsSync(join(ROOT, allowance.path)), `${allowance.path} exists now — the text is stale`).toBe(false);
		}
	});

	it('detects the characters it guards against', () => {
		expect(hasHiddenCharacter(`a${String.fromCodePoint(0x202e)}b`)).toBe(true);
		expect(hasHiddenCharacter(`a${String.fromCodePoint(0xe0041)}b`)).toBe(true);
		expect(hasHiddenCharacter('plain ⚜️ text')).toBe(false);
	});

	it('carry no hidden bidi or zero-width characters', () => {
		const carrying = FILES.filter((file) => statSync(join(ROOT, file)).isFile()).filter((file) =>
			hasHiddenCharacter(readFileSync(join(ROOT, file), 'utf8')),
		);
		expect(carrying).toEqual([]);
	});
});
