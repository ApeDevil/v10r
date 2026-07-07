/**
 * ELEVATION HARDCODE GUARD — fails the suite if any `.svelte` file under `src/`
 * pastes a literal `data-elevation="N"` (or the curly-brace `{'N'}` / `{"N"}` /
 * `{N}` variants) back into markup instead of computing the rung.
 *
 * The Surface (Tonal) Elevation system (`./elevation.ts`, the twin this file is
 * co-located with) migrated every real surface from static
 * `data-elevation="1..4"` literals to a RELATIVE context engine: `useSurface()`
 * computes `parent + 1` via Svelte context and emits `data-elevation` only
 * through `{...s.attrs}`. A repo grep + clyn audit confirmed the migration is
 * currently 100% clean. Nothing at the type level stops a future edit from
 * pasting a literal back in — this scan is the durable enforcement so "elevation
 * is computed, not hand-authored" cannot silently rot.
 *
 * Exemption: the three showcase teaching demos that deliberately illustrate
 * absolute rungs and intentional level-skips as pedagogy. As of this writing
 * none of them actually contain a literal either — `ElevationSection.svelte`,
 * `RungStack.svelte` and `ContrastReadout.svelte` all compute
 * `data-elevation={String(x)}` from a local `Rung[]` array, one hop removed from
 * a bare literal — but they stay allowlisted because inlining a literal there
 * for a new demo swatch is legitimate pedagogy, not a regression, and the
 * allowlist should not have to move the day someone does that.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC_DIR = join(process.cwd(), 'src');

function walk(dir: string): string[] {
	const out: string[] = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) out.push(...walk(full));
		else out.push(full);
	}
	return out;
}

/**
 * Matches a HARDCODED data-elevation rung:
 *   - data-elevation="3"   / data-elevation='2'        (quoted HTML attribute literal)
 *   - data-elevation={'4'} / data-elevation={"1"}      (curly-brace string literal)
 *   - data-elevation={3}                               (curly-brace bare numeric literal)
 *
 * Deliberately does NOT match — these are the sanctioned computed paths:
 *   - `{...s.attrs}` spreads — no `data-elevation=` substring appears at all
 *   - `data-elevation={elevationAttr(...)}` / `{useSurface(...)}` / `{resolveLevel(...)}`
 *   - `data-elevation={String(x)}` or any other non-literal JS/TS expression
 *   - `data-elevation="1..4"` prose in comments — the `..` breaks the strict
 *     `\d+["']` boundary, so an ellipsis range can never match this pattern
 *   - `[data-elevation]` CSS presence selectors — no `=` follows the attribute name
 *
 * Text-scan, not AST-aware (mirrors leak-gate's own approach): it would also
 * flag a hypothetical CSS value-selector like `[data-elevation="3"]`, which is
 * an accepted broader net (still a hardcoded rung, just spelled in CSS) — the
 * repo currently has zero of those, only bare `[data-elevation]` presence
 * selectors, which this pattern does not touch.
 */
const HARDCODED_ELEVATION_RE = /data-elevation=(?:["']\d+["']|\{\s*["']?\d+["']?\s*\})/;

/**
 * Absolute paths of the ONLY files permitted to contain a literal. Verified via
 * `grep -rn 'data-elevation="[0-9]' src --include='*.svelte'` (plus the
 * `{'N'}` / `{"N"}` / `{N}` variants) turning up EMPTY repo-wide, including
 * inside these three files — see the module docstring. They stay allowlisted
 * pre-emptively because they are the one place a literal legitimately teaches
 * an absolute rung; every other file in `src/` must go through the engine.
 */
const ALLOWLIST = new Set<string>([
	// Elevation Ladder / Rung Inspector / Never-Skip-Levels hero section — teaches
	// the E0-E4 ladder and the "never skip a rung" rule by name, absolute rung by
	// absolute rung.
	join(SRC_DIR, 'routes/[[locale=locale]]/(public)/showcases/ui/components/_sections/ElevationSection.svelte'),
	// Concentric "matryoshka" rung renderer ElevationSection composes to draw each
	// named stage (Background/Sidebar/Card/Dialog/Tooltip) at its absolute rung.
	join(SRC_DIR, 'routes/[[locale=locale]]/(public)/showcases/ui/components/_components/RungStack.svelte'),
	// Live WCAG-contrast readout — renders a real 2-rung mini-stack at explicit
	// lower/upper rungs to measure the boundary the rim math guarantees >= 3:1.
	join(SRC_DIR, 'routes/[[locale=locale]]/(public)/showcases/ui/components/_components/ContrastReadout.svelte'),
]);

function isAllowlisted(absPath: string): boolean {
	return ALLOWLIST.has(absPath);
}

describe('data-elevation hardcode guard — regex contract', () => {
	const forbidden = [
		'data-elevation="3"',
		"data-elevation='2'",
		"data-elevation={'4'}",
		'data-elevation={"1"}',
		'data-elevation={3}',
		"data-elevation={ '2' }",
	];

	for (const snippet of forbidden) {
		it(`flags hardcoded literal: ${snippet}`, () => {
			expect(HARDCODED_ELEVATION_RE.test(snippet), `expected ${snippet} to match`).toBe(true);
		});
	}

	const sanctioned = [
		'data-elevation={elevationAttr(menuLevel)}',
		'data-elevation={elevationAttr(s.depth + 1)}',
		'data-elevation={resolveLevel(opts)}',
		'data-elevation={String(r.e)}',
		'data-elevation={String(rung)}',
		'data-elevation={r.e === 0 ? undefined : String(r.e)}',
		'{...s.attrs}',
		'<ContextMenuPrimitive.Content data-elevation={elevationAttr(menuLevel)} />',
		'data-elevation="1..4"',
		'[data-elevation]',
		'.swatch:not([data-elevation])',
		"content: 'E' attr(data-elevation) '  ·  <Surface>';",
	];

	for (const snippet of sanctioned) {
		it(`does not flag sanctioned/prose form: ${snippet}`, () => {
			expect(HARDCODED_ELEVATION_RE.test(snippet), `expected ${snippet} NOT to match`).toBe(false);
		});
	}
});

describe('data-elevation hardcode guard — allowlist precision', () => {
	const [elevationSection, rungStack, contrastReadout] = [...ALLOWLIST];

	it('has exactly the 3 verified showcase files, nothing more', () => {
		expect(ALLOWLIST.size).toBe(3);
	});

	it('recognizes each real allowlisted path', () => {
		expect(isAllowlisted(elevationSection)).toBe(true);
		expect(isAllowlisted(rungStack)).toBe(true);
		expect(isAllowlisted(contrastReadout)).toBe(true);
	});

	it('does NOT exempt a same-basename file living outside the showcase dir (path-exact, not basename)', () => {
		const impostor = join(SRC_DIR, 'lib/components/layout/ElevationSection.svelte');
		expect(isAllowlisted(impostor)).toBe(false);
	});

	it('does NOT exempt a neighboring file in the SAME showcase directory by prefix', () => {
		const neighbor = join(
			SRC_DIR,
			'routes/[[locale=locale]]/(public)/showcases/ui/components/_sections/ElevationSection.notes.svelte',
		);
		expect(isAllowlisted(neighbor)).toBe(false);
	});
});

describe('data-elevation hardcode guard — repo scan', () => {
	const files = walk(SRC_DIR).filter((f) => f.endsWith('.svelte'));

	it('scans a non-empty set of .svelte files', () => {
		expect(files.length).toBeGreaterThan(0);
	});

	it('the allowlist resolves to real files actually present in the scan', () => {
		for (const p of ALLOWLIST) {
			expect(files, `allowlisted path not found on disk: ${p}`).toContain(p);
		}
	});

	for (const file of files) {
		if (isAllowlisted(file)) continue;

		it(`no hardcoded data-elevation literal in ${file.replace(SRC_DIR, 'src')}`, () => {
			const src = readFileSync(file, 'utf8');
			const found = src.match(HARDCODED_ELEVATION_RE)?.[0];
			expect(found, `found hardcoded literal "${found}" — compute it via useSurface() instead`).toBeUndefined();
		});
	}
});
