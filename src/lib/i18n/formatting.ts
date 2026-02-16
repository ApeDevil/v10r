import { getLocale } from '$lib/paraglide/runtime';

const LOCALE_DEFAULTS: Record<string, string> = {
	en: 'en-US',
	de: 'de-DE',
	fr: 'fr-FR'
};

/**
 * Get formatting locale with regional preference.
 * Translation locale "de" → Formatting locale "de-CH" (from browser)
 */
export function getFormattingLocale(): string {
	const lang = getLocale();

	if (typeof navigator !== 'undefined' && navigator.languages) {
		const preferred = navigator.languages.find((l) => l.startsWith(lang));
		if (preferred) return preferred;
	}

	return LOCALE_DEFAULTS[lang] ?? lang;
}

export function formatDate(
	date: Date,
	options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): string {
	return new Intl.DateTimeFormat(getFormattingLocale(), options).format(date);
}

export function formatNumber(value: number, options: Intl.NumberFormatOptions = {}): string {
	return new Intl.NumberFormat(getFormattingLocale(), options).format(value);
}

export function formatCurrency(value: number, currency = 'USD'): string {
	return new Intl.NumberFormat(getFormattingLocale(), {
		style: 'currency',
		currency
	}).format(value);
}

export function formatPercent(value: number): string {
	return new Intl.NumberFormat(getFormattingLocale(), {
		style: 'percent',
		minimumFractionDigits: 0,
		maximumFractionDigits: 1
	}).format(value);
}

export function formatRelative(date: Date): string {
	const rtf = new Intl.RelativeTimeFormat(getFormattingLocale(), { numeric: 'auto' });

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
