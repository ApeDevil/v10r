/**
 * Canonical JSON text: object keys sorted by UTF-16 code unit, no whitespace, `undefined`
 * properties skipped (they are absent in JSON). Two equal values give the same bytes whatever
 * produced them — a derivation key, a stored record after a `jsonb` round trip (`jsonb`
 * reorders keys, shorter first), an editor's copy.
 */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, inner]) => inner !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([key, inner]) => `${JSON.stringify(key)}:${canonicalJson(inner)}`).join(',')}}`;
	}
	return JSON.stringify(value);
}
