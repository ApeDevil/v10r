/**
 * An application-defined attribute kind, the way an application adds one: a pure kind for the
 * engine and a control for the editor, registered next to the core kinds. Nothing in
 * `#lib/dynamic-attributes` knows it exists — a record that names `app.rating` in an app that
 * does not register it keeps the value, opaque, and shows it read-only.
 */
import type { AttributeKind } from '#lib/dynamic-attributes/index.ts';

export const RATING_MAX = 5;

export const ratingKind: AttributeKind = {
	id: 'app.rating',
	defaultConfig: () => ({}),
	parseConfig: (input) =>
		input !== null && typeof input === 'object' && !Array.isArray(input) && Object.keys(input).length === 0
			? {}
			: undefined,
	accepts: (value) =>
		value === null || (Number.isInteger(value) && (value as number) >= 1 && (value as number) <= RATING_MAX),
	empty: () => null,
	text: (value) => (value === null ? '' : '★'.repeat(value as number)),
	fromText(text) {
		const trimmed = text.trim();
		if (trimmed === '') return null;
		if (/^★{1,5}$/.test(trimmed)) return trimmed.length;
		const n = Number(trimmed);
		return Number.isInteger(n) && n >= 1 && n <= RATING_MAX ? n : undefined;
	},
};
