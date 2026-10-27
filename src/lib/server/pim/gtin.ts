/**
 * GTIN (EAN/UPC) identifiers: the check digit, and recovering one a spreadsheet damaged.
 *
 * The damage is specific. A GTIN-13 that starts with zeros, typed into a cell Excel treats
 * as a number, loses those zeros (`0012345678905` → `12345678905`); a UPC-A loses nothing
 * but is 12 digits where a target expects 13. Both are recoverable because the check digit
 * says whether the padded number is the one that was meant. A value shown in scientific
 * notation (`1.23457E+12`) has lost digits outright and is not recoverable — it is refused,
 * never rounded back into a plausible code.
 */

const GTIN_LENGTHS = new Set([8, 12, 13, 14]);

/** True when `digits` is a GTIN-8/12/13/14 whose last digit is its check digit. */
export function isValidGtin(digits: string): boolean {
	if (!/^\d+$/.test(digits) || !GTIN_LENGTHS.has(digits.length)) return false;
	let sum = 0;
	for (let i = digits.length - 2, weight = 3; i >= 0; i--, weight = 4 - weight) sum += Number(digits[i]) * weight;
	return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

/**
 * The value as a valid GTIN, or null when it cannot be one. Spaces and hyphens are
 * removed; 9–12 digits are left-padded to GTIN-13 (lost leading zeros, UPC-A); 8, 13 and
 * 14 digits are kept. Anything else — letters, scientific notation, a failed check digit
 * after padding — is null, so the caller reports it instead of storing a guess.
 */
export function normalizeGtin(value: string): string | null {
	const digits = value.replace(/[\s-]/g, '');
	if (!/^\d+$/.test(digits)) return null;
	const padded = digits.length >= 9 && digits.length <= 12 ? digits.padStart(13, '0') : digits;
	return isValidGtin(padded) ? padded : null;
}
