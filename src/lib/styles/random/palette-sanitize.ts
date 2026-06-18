/**
 * Custom-palette injection allowlist — extracted from hooks.server.ts so it is
 * unit-testable. The i18n hook injects a `<style>` block built from a user/admin
 * custom palette into every page <head>; these guards are the only thing between
 * attacker-controlled palette JSON and an HTML/CSS injection. Keep them strict.
 */

/** Allowlisted token keys (from the PaletteColors interface). */
export const VALID_TOKEN_KEYS = new Set([
	'bg',
	'fg',
	'body',
	'heading',
	'muted',
	'border',
	'subtle',
	'primary',
	'primary-hover',
	'primary-container',
	'on-primary-container',
	'primary-dim',
	'on-primary',
	'secondary',
	'on-secondary',
	'accent',
	'accent-hover',
	'on-accent',
	'accent-container',
	'on-accent-container',
	'input',
	'input-border',
	'surface-1',
	'surface-2',
	'surface-3',
]);

/** A value is only emitted if it is a strict oklch(L C H) triple — no breakout chars. */
export const OKLCH_RE = /^oklch\(\s*[\d.]+\s+[\d.]+\s+[\d.]+\s*\)$/;

/** Keep only entries whose key is allowlisted AND whose value is a clean oklch() triple. */
export function safeEntries(colors: Record<string, string>): Array<[string, string]> {
	return Object.entries(colors).filter(([k, v]) => VALID_TOKEN_KEYS.has(k) && OKLCH_RE.test(v));
}
