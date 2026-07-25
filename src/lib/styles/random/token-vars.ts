/**
 * Palette token → CSS custom property mapping, plus the client-side live preview
 * used while someone is crafting a custom palette.
 *
 * The mapping is shared with the SSR `<style>` injector in hooks.server.ts on
 * purpose: two copies that merely happen to agree today is exactly how a preview
 * silently stops matching what the server renders.
 */

import { browser } from '$app/environment';
import { VALID_TOKEN_KEYS } from './palette-sanitize';

/** `surface-1` → `--surface-1`; everything else → `--color-<token>`. */
export function tokenToCssVar(key: string): string {
	return key.startsWith('surface-') ? `--${key}` : `--color-${key}`;
}

/**
 * Paint a palette onto <html> as inline custom properties.
 *
 * Inline element styles outrank every `[data-palette]` rule, so this previews
 * without touching `data-palette` — that attribute stays owned solely by the
 * `$effect` in state/style.svelte.ts, which must remain its only writer.
 */
export function applyPalettePreview(colors: Record<string, string>): void {
	if (!browser) return;
	const el = document.documentElement;
	for (const key of VALID_TOKEN_KEYS) {
		const value = colors[key];
		if (value) {
			el.style.setProperty(tokenToCssVar(key), value);
		} else {
			el.style.removeProperty(tokenToCssVar(key));
		}
	}
}

/** Remove every token this module may have set. Safe to call unconditionally. */
export function clearPalettePreview(): void {
	if (!browser) return;
	const el = document.documentElement;
	for (const key of VALID_TOKEN_KEYS) {
		el.style.removeProperty(tokenToCssVar(key));
	}
}
