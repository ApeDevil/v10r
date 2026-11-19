/**
 * Measures in product data: `12,5 cm`, `125mm`, `0.4 kg`. Parsing accepts the forms
 * suppliers actually send — decimal comma or point, unit glued on or spaced, any case —
 * and refuses the ambiguous ones (`1.250,5`, a unit outside the table) instead of guessing.
 */

/** Units the recipe can convert between, as a factor to the family's base unit. */
const UNITS = {
	mm: { family: 'length', factor: 0.001 },
	cm: { family: 'length', factor: 0.01 },
	m: { family: 'length', factor: 1 },
	g: { family: 'mass', factor: 0.001 },
	kg: { family: 'mass', factor: 1 },
	ml: { family: 'volume', factor: 0.001 },
	l: { family: 'volume', factor: 1 },
} as const;

export type MeasureUnit = keyof typeof UNITS;
export const MEASURE_UNITS = Object.keys(UNITS) as MeasureUnit[];

export interface Measure {
	amount: number;
	/** null for a bare number: the unit is not in the cell. */
	unit: MeasureUnit | null;
}

const MEASURE_RE = /^(-?\d+(?:[.,]\d+)?)\s*([a-zA-Z]*)$/;

export function isMeasureUnit(unit: string): unit is MeasureUnit {
	return Object.hasOwn(UNITS, unit);
}

/** The measure in `text`, or null when it is not one this table can read. */
export function parseMeasure(text: string): Measure | null {
	const match = MEASURE_RE.exec(text.trim());
	if (!match) return null;
	const amount = Number(match[1].replace(',', '.'));
	const unit = match[2].toLowerCase();
	if (unit === '') return { amount, unit: null };
	return isMeasureUnit(unit) ? { amount, unit } : null;
}

/** `amount` in `to`, or null when the two units measure different things. */
export function convertMeasure(amount: number, from: MeasureUnit, to: MeasureUnit): number | null {
	if (UNITS[from].family !== UNITS[to].family) return null;
	return (amount * UNITS[from].factor) / UNITS[to].factor;
}

/** Canonical text: point decimal, at most three places, no trailing zeros, one space. */
export function formatMeasure(amount: number, unit: MeasureUnit): string {
	return `${Number(amount.toFixed(3))} ${unit}`;
}
