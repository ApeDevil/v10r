#!/usr/bin/env bun
/**
 * Guard: forbid opacity modifiers on CSS-variable-backed color tokens.
 *
 * UnoCSS cannot decompose a hex CSS custom property into RGB channels, so a class like
 * `bg-muted/10` emits `background-color: var(--color-muted)` at FULL opacity — silently
 * wrong. Every project color token is a hex CSS var (src/app.css), so opacity modifiers
 * are broken for ALL of them, in both `.svelte` and `.ts` (CVA) files. The supported
 * workaround is scoped CSS: `color-mix(in srgb, var(--color-x) NN%, transparent)`.
 * See docs/stack/ui/unocss.md.
 *
 * Fails the validate gate if any `<util>-<token>/<digits>` class appears in src/.
 * (The arbitrary form `bg-x/[0.5]` shares the bug but is not scanned — rare here.)
 */
import { readFileSync } from 'node:fs';
import { Glob } from 'bun';

const APP_CSS = 'src/app.css';
const UTILITY_PREFIXES = [
	'bg',
	'text',
	'border',
	'ring-offset',
	'ring',
	'outline',
	'divide',
	'fill',
	'stroke',
	'from',
	'via',
	'to',
	'shadow',
	'accent',
	'caret',
	'decoration',
	'placeholder',
];

// Files that intentionally carry the marker class alongside a scoped color-mix() override
// (the established menu-highlight pattern — the utility is overridden by higher-specificity
// [data-*] scoped CSS in the sibling component). New opacity-on-token usage ELSEWHERE is a
// bug. Do not grow this list without also adding the matching color-mix() override.
const ALLOWLIST = new Set([
	'src/lib/components/composites/dropdown-menu/dropdown-menu.ts',
	'src/lib/components/composites/dropdown-menu/DropdownMenu.svelte',
	'src/lib/components/composites/context-menu/context-menu.ts',
	'src/lib/components/composites/context-menu/ContextMenu.svelte',
	'src/lib/components/composites/menu-bar/menu-bar.ts',
	'src/lib/components/composites/menu-bar/MenuBar.svelte',
]);

function loadColorTokens(): string[] {
	const css = readFileSync(APP_CSS, 'utf8');
	const tokens = new Set<string>();
	for (const m of css.matchAll(/--color-([a-z0-9-]+)\s*:/g)) tokens.add(m[1]);
	// Longest first so `primary-hover` is tried before `primary` in the alternation.
	return [...tokens].sort((a, b) => b.length - a.length);
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const tokens = loadColorTokens();
if (tokens.length === 0) {
	console.error(`opacity-guard: no --color-* tokens found in ${APP_CSS}`);
	process.exit(1);
}

const prefixAlt = UTILITY_PREFIXES.join('|');
const tokenAlt = tokens.map(escapeRe).join('|');
// Class boundary before the prefix (allows variant colons like `hover:`, `dark:`).
const RE = new RegExp(`(?<![a-z0-9-])(?:${prefixAlt})-(?:${tokenAlt})/\\d{1,3}`, 'g');

interface Hit {
	file: string;
	line: number;
	matches: string;
}
const hits: Hit[] = [];

let allowlisted = 0;
const glob = new Glob('src/**/*.{svelte,ts}');
for (const file of glob.scanSync('.')) {
	if (file.endsWith('.test.ts') || file.includes('/paraglide/')) continue;
	if (ALLOWLIST.has(file)) {
		allowlisted++;
		continue;
	}
	const lines = readFileSync(file, 'utf8').split('\n');
	for (let i = 0; i < lines.length; i++) {
		const found = lines[i].match(RE);
		if (found) hits.push({ file, line: i + 1, matches: found.join(', ') });
	}
}

if (hits.length > 0) {
	console.error(
		`\n❌ opacity-guard: ${hits.length} opacity modifier(s) on CSS-variable color tokens (render at FULL opacity):\n`,
	);
	for (const h of hits) console.error(`  ${h.file}:${h.line}  →  ${h.matches}`);
	console.error('\nReplace with scoped CSS color-mix(). See docs/stack/ui/unocss.md.');
	process.exit(1);
}

console.log(
	`opacity-guard: clean — ${tokens.length} color tokens checked across src/ (${allowlisted} color-mix-backed files allowlisted).`,
);
