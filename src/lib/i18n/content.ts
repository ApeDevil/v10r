import { getLocale } from '$lib/paraglide/runtime';

type TranslatedField = Record<string, string> | null | undefined;

/**
 * Translate content from a database JSON field.
 * Falls back: current locale → fallback locale → first available → empty string.
 */
export function tc(translations: TranslatedField, fallback = 'en'): string {
	if (!translations) return '';

	const currentLocale = getLocale();
	return (
		translations[currentLocale] ?? translations[fallback] ?? Object.values(translations)[0] ?? ''
	);
}

export function hasTranslation(translations: TranslatedField, targetLocale: string): boolean {
	return Boolean(translations?.[targetLocale]);
}

export function getAvailableLocales(translations: TranslatedField): string[] {
	if (!translations) return [];
	return Object.keys(translations).filter((key) => translations[key]);
}
