import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { vizColor } from './theme-bridge';

/**
 * Viz colors come from tokens, read through `theme-bridge`. A hex fallback here was never
 * harmless: the tokens are oklch(), so `palette[0] || '#3b82f6'` painted a foreign blue
 * whenever a token was unset, and `${palette[0]}33` produced an invalid color string the
 * charts silently dropped. Scoped to the viz layer and its showcases — the canvas-library
 * boundary where this bug class lives.
 */
const ROOT = process.cwd();
const SCOPES = [
	'src/lib/components/viz',
	'src/routes/[[locale=locale]]/(public)/showcases/viz',
	'src/routes/[[locale=locale]]/(public)/showcases/toolkits/image-kit',
];
const HEX_LITERAL = /['"`]#[0-9a-fA-F]{3,8}['"`]|\}[0-9a-fA-F]{2}`/;

function sourceFiles(dir: string): string[] {
	return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && /\.(svelte|ts)$/.test(entry.name) && !entry.name.endsWith('.test.ts'))
		.map((entry) => relative(ROOT, join(entry.parentPath, entry.name)));
}

describe('viz colors', () => {
	it('carry no hex literal and no hex-alpha suffix', () => {
		const offenders = SCOPES.flatMap(sourceFiles).filter((file) =>
			HEX_LITERAL.test(readFileSync(join(ROOT, file), 'utf8')),
		);
		expect(offenders, 'use vizColor / toRgba / a var(--token) instead').toEqual([]);
	});

	it('vizColor cycles the palette and falls back to the primary token, never a literal', () => {
		expect(vizColor(['a', 'b', 'c'], 4)).toBe('b');
		expect(vizColor(['a', '', 'c'], 1)).toBe('currentColor'); // unset token; no document in this lane
		expect(vizColor([], 3)).toBe('currentColor');
	});
});
