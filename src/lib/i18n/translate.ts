/**
 * Resolve a translated DB content field.
 *
 * Conventions for translatable short fields (e.g. `blog.domain.name` + `name_i18n`):
 *   - `source` is the EN canonical value, stored in a NOT NULL column.
 *   - `i18n` is a JSONB partial map keyed by non-base locale (`de`, `ru`, …).
 *   - `tc(source, i18n, requested)` resolves: requested → en (source) → first
 *     non-empty translation → empty string.
 *
 * The locale is passed explicitly (no `getLocale()` here) so the resolver is
 * pure and SSR-safe — call sites supply `event.locals.locale` on the server or
 * `getLocale()` at the component edge on the client. This avoids accidentally
 * coupling DB-content reads to Paraglide's AsyncLocalStorage scope.
 */

import type { Locale } from './runtime';

export type TranslationMap = Partial<Record<Exclude<Locale, 'en'>, string>>;

export function tc(source: string, i18n: TranslationMap | null | undefined, requested: Locale): string {
	if (requested === 'en') return source;
	const direct = i18n?.[requested];
	if (direct) return direct;
	if (source) return source;
	if (i18n) {
		for (const value of Object.values(i18n)) {
			if (value) return value;
		}
	}
	return '';
}

/**
 * Strict variant: returns null when no translation exists for the requested locale.
 * Useful for admin views that need to render "missing" honestly.
 */
export function tcStrict(source: string, i18n: TranslationMap | null | undefined, requested: Locale): string | null {
	if (requested === 'en') return source || null;
	return i18n?.[requested] ?? null;
}
