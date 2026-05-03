/**
 * Intl wrappers that accept locale EXPLICITLY so SSR and CSR render the same
 * string (no AsyncLocalStorage / no `navigator.languages` mismatch on hydration).
 *
 * Call sites pass `page.data.locale` (set by the root +layout.server.ts) — this
 * keeps the resolved locale consistent across the SvelteKit data graph.
 *
 * On the client, `getFormattingLocale(locale)` upgrades the translation locale
 * (`'de'`) to a regional one (`'de-CH'`) using `navigator.languages` when
 * available — but only after hydration, so the SSR HTML and the first client
 * paint match byte-for-byte.
 */

const LOCALE_DEFAULTS: Record<string, string> = {
	en: 'en-US',
	de: 'de-DE',
	ru: 'ru-RU',
};

/**
 * Resolve a regional formatting locale from a translation locale.
 *
 * SSR: returns the LOCALE_DEFAULTS map entry (deterministic).
 * CSR: prefers a `navigator.languages` entry that starts with the translation
 * locale, falling back to the same default. The first render after hydration
 * therefore matches the SSR HTML; subsequent reactive renders may pick up the
 * regional preference.
 */
export function getFormattingLocale(locale: string): string {
	if (typeof navigator !== 'undefined' && navigator.languages) {
		const preferred = navigator.languages.find((l) => l.startsWith(locale));
		if (preferred) return preferred;
	}
	return LOCALE_DEFAULTS[locale] ?? locale;
}

export function formatDate(
	date: Date,
	locale: string,
	options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
	return new Intl.DateTimeFormat(getFormattingLocale(locale), options).format(date);
}

export function formatNumber(value: number, locale: string, options: Intl.NumberFormatOptions = {}): string {
	return new Intl.NumberFormat(getFormattingLocale(locale), options).format(value);
}

export function formatCurrency(value: number, locale: string, currency = 'USD'): string {
	return new Intl.NumberFormat(getFormattingLocale(locale), {
		style: 'currency',
		currency,
	}).format(value);
}

export function formatPercent(value: number, locale: string): string {
	return new Intl.NumberFormat(getFormattingLocale(locale), {
		style: 'percent',
		minimumFractionDigits: 0,
		maximumFractionDigits: 1,
	}).format(value);
}

export function formatRelative(date: Date, locale: string): string {
	const rtf = new Intl.RelativeTimeFormat(getFormattingLocale(locale), { numeric: 'auto' });

	const diffMs = date.getTime() - Date.now();
	const diffMins = Math.round(diffMs / (1000 * 60));
	const diffHours = Math.round(diffMs / (1000 * 60 * 60));
	const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

	if (Math.abs(diffMins) < 60) {
		return rtf.format(diffMins, 'minute');
	}
	if (Math.abs(diffHours) < 24) {
		return rtf.format(diffHours, 'hour');
	}
	return rtf.format(diffDays, 'day');
}
