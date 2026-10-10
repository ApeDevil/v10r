/**
 * Rights metadata for a third-party asset the app ships — a 3D model, a photo.
 *
 * Recorded once, by the module that owns the asset (`$lib/3d/models.ts`, `$lib/3d/parts.ts`),
 * and read by every surface that has to credit it: `/credits` and the place the asset is shown.
 * There is no second copy beside the files; `registry.gate.test.ts` binds this metadata to what
 * is actually under `static/`.
 *
 * This is machine-readable metadata, not a legal conclusion. The gate proves an entry is present,
 * well-formed and rendered — never that the license permits the use, which no identifier can say.
 */
export interface AssetRights {
	/** The creator, as the source credits them. */
	author: string;
	/**
	 * SPDX license identifier (`CC-BY-4.0`, `CC0-1.0`, …). `LicenseRef-PublicDomain` where the
	 * source marks the work public domain without a license — SPDX has no id for that.
	 */
	license: string;
	/** Where the asset was obtained (https). */
	source: string;
}

/** Licenses whose terms require crediting the author wherever the work is shown (CC BY and CC BY-SA families). */
export function requiresAttribution(license: string): boolean {
	return /^CC-BY(-SA|-ND|-NC)*-\d/.test(license);
}

/** SPDX id → the form people read: `CC-BY-SA-2.0` → `CC BY-SA 2.0`, `CC0-1.0` → `CC0 1.0`. */
export function licenseLabel(license: string): string {
	if (license === 'LicenseRef-PublicDomain') return 'public domain';
	const cc = /^CC-(.+)-(\d+\.\d+)$/.exec(license);
	if (cc) return `CC ${cc[1]} ${cc[2]}`;
	const zero = /^CC0-(\d+\.\d+)$/.exec(license);
	if (zero) return `CC0 ${zero[1]}`;
	return license;
}

/** The one-line credit shown beside an asset: `author — license`. */
export function creditLine(rights: AssetRights): string {
	return `${rights.author} — ${licenseLabel(rights.license)}`;
}
