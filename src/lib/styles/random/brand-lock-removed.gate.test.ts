/**
 * DELETION GATE — fails the build if the site-wide brand lock creeps back.
 *
 * v10r deliberately has no branding: every visitor picks their own palette,
 * typography and shape. Removing the lock touched two *independent* admin nav
 * registries with different shapes and no parity test between them, so a
 * partial revert could easily restore a sidebar entry that 404s. This gate is
 * the durable check that the feature stayed gone.
 *
 * Custom palettes are NOT part of this — `server/style/palettes.ts` and
 * `app.custom_palettes` are live, per-user, and expected to be referenced.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(process.cwd(), 'src');
const SKIP_DIRS = new Set(['paraglide', 'node_modules']);

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (SKIP_DIRS.has(entry.name)) continue;
			out.push(...walk(join(dir, entry.name)));
		} else if (/\.(ts|svelte|js|json)$/.test(entry.name)) {
			out.push(join(dir, entry.name));
		}
	}
	return out;
}

const FORBIDDEN: { label: string; re: RegExp }[] = [
	{ label: 'the deleted /admin/branding route', re: /admin\/branding/ },
	{ label: 'the deleted brand_settings table', re: /brand_settings|brandSettings/ },
	{ label: 'the deleted brand config reader', re: /getBrandConfig|invalidateBrandCache/ },
	{ label: 'the deleted `branded` lock flag', re: /\bstyle\.branded\b|\bbranded\?\s*:/ },
	{ label: 'the deleted nav_admin_branding message key', re: /nav_admin_branding/ },
];

const THIS_FILE = 'brand-lock-removed.gate.test.ts';

describe('brand lock deletion gate', () => {
	const files = walk(SRC_DIR).filter((f) => !f.endsWith(THIS_FILE));

	it('scans a plausible number of source files', () => {
		expect(files.length).toBeGreaterThan(100);
	});

	for (const { label, re } of FORBIDDEN) {
		it(`has no reference to ${label}`, () => {
			const hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
			expect(hits.map((f) => f.replace(`${process.cwd()}/`, ''))).toEqual([]);
		});
	}
});
