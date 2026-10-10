/**
 * CREDITS GATE — fails the suite if the `/credits` registry drifts from
 * reality in any of four ways:
 *
 *   1. PRESENCE — an `npm`-sourced entry credits a package that is no longer
 *      in `package.json` (dep was removed, credit lingered).
 *   2. LICENSE  — the SPDX string shown on the page disagrees with the
 *      installed package's own `license` metadata (skipped when the package
 *      isn't resolvable locally or its license field isn't a plain string).
 *   3. DOCS     — a `docs` href doesn't resolve to a published manifest entry
 *      (same ground truth as the showcase docs gate: `getManifest()`, not the
 *      filesystem).
 *   4. SHOWCASE — a `showcase` href isn't a real node in the showcase
 *      registry tree.
 *
 * Curation itself (which technologies deserve an entry) is editorial and
 * deliberately not tested.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getManifest } from '$lib/server/docs/manifest';
import { showcases } from '../showcases/catalog/registry';
import { requiresAttribution } from './asset-rights';
import { assetCredits, creditGroups, credits } from './registry';

const rootUrl = (rel: string) => fileURLToPath(new URL(`../../../${rel}`, import.meta.url));

const pkgJson = JSON.parse(readFileSync(rootUrl('package.json'), 'utf-8')) as {
	dependencies?: Record<string, string>;
	devDependencies?: Record<string, string>;
};
const declaredDeps = new Set([
	...Object.keys(pkgJson.dependencies ?? {}),
	...Object.keys(pkgJson.devDependencies ?? {}),
]);

/** `license` from the installed package's own metadata, or null when unknowable. */
function installedLicense(pkg: string): string | null {
	const path = rootUrl(`node_modules/${pkg}/package.json`);
	if (!existsSync(path)) return null;
	const meta = JSON.parse(readFileSync(path, 'utf-8')) as { license?: unknown };
	return typeof meta.license === 'string' ? meta.license : null;
}

function showcaseHrefs(): Set<string> {
	const out = new Set<string>();
	for (const card of showcases) {
		out.add(card.href);
		for (const sublink of card.sublinks ?? []) {
			out.add(sublink.href);
			for (const child of sublink.children ?? []) out.add(child.href);
		}
	}
	return out;
}

describe('credits registry gate', () => {
	const manifest = getManifest();
	const validDocUrls = new Set<string>();
	for (const section of ['foundation', 'blueprint', 'stack'] as const) {
		for (const entry of manifest[section]) {
			validDocUrls.add(`/docs/${section}/${entry.slug}`);
		}
	}
	const validShowcases = showcaseHrefs();

	it('scans a non-empty registry', () => {
		expect(credits.length).toBeGreaterThan(0);
	});

	it('entry ids are unique', () => {
		const ids = credits.map((c) => c.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it('every entry belongs to a declared group, every group has entries', () => {
		const groupIds = new Set(creditGroups.map((g) => g.id));
		for (const entry of credits) {
			expect(groupIds.has(entry.group), `${entry.id}: unknown group "${entry.group}"`).toBe(true);
		}
		for (const group of creditGroups) {
			expect(
				credits.some((c) => c.group === group.id),
				`group "${group.id}" has no entries`,
			).toBe(true);
		}
	});

	// One assertion per RULE over the whole registry, not one `it()` per entry. The five
	// checks below each collected ~20 cases; a failure now names every offender on one line.
	const npmEntries = credits.filter((e) => e.source.kind === 'npm');

	it('PRESENCE — every npm-sourced credit is still a real dependency', () => {
		const offenders = npmEntries
			.filter((e) => !declaredDeps.has((e.source as { pkg: string }).pkg))
			.map((e) => `${e.id} → "${(e.source as { pkg: string }).pkg}"`);
		expect(offenders, 'not in dependencies/devDependencies — remove or update the credit').toEqual([]);
	});

	it('LICENSE — every npm-sourced credit declares a license', () => {
		expect(npmEntries.filter((e) => !e.license).map((e) => e.id)).toEqual([]);
	});

	it('LICENSE — displayed SPDX matches installed package metadata', () => {
		// `installedLicense` returns null when the package is not resolvable locally; the
		// PRESENCE check still holds in that case, so those are skipped rather than failed.
		const offenders = npmEntries
			.map((e) => ({ e, pkg: (e.source as { pkg: string }).pkg }))
			.map(({ e, pkg }) => ({ e, pkg, actual: installedLicense(pkg) }))
			.filter(({ e, actual }) => actual !== null && e.license !== actual)
			.map(({ e, pkg, actual }) => `${e.id} → "${pkg}" declares "${e.license}" but ships "${actual}"`);
		expect(offenders).toEqual([]);
	});

	it('DOCS — every docs href resolves to a published doc', () => {
		const offenders = credits.filter((e) => e.docs && !validDocUrls.has(e.docs)).map((e) => `${e.id} → "${e.docs}"`);
		expect(offenders, 'not found in the published docs manifest').toEqual([]);
	});

	it('SHOWCASE — every showcase href is a real showcase-tree node', () => {
		const offenders = credits
			.filter((e) => e.showcase && !validShowcases.has(e.showcase))
			.map((e) => `${e.id} → "${e.showcase}"`);
		expect(offenders, 'not found in the showcase registry').toEqual([]);
	});

	it('SERVICES — hosted services claim no license', () => {
		const offenders = credits
			.filter((e) => e.source.kind === 'service' && e.license !== undefined)
			.map((e) => `${e.id} declares "${e.license}"`);
		expect(offenders).toEqual([]);
	});

	it('the scans are non-empty (a shrunken registry would pass every check above vacuously)', () => {
		expect(npmEntries.length).toBeGreaterThan(0);
		expect(credits.filter((e) => e.docs).length).toBeGreaterThan(0);
		expect(credits.filter((e) => e.showcase).length).toBeGreaterThan(0);
		expect(credits.filter((e) => e.source.kind === 'service').length).toBeGreaterThan(0);
	});
});

/**
 * ASSET RIGHTS — every third-party file under the asset directories is credited exactly once,
 * from the module that owns it, with a well-formed license; a license that requires attribution
 * carries an author and an https source. This checks metadata presence and shape, never legal
 * sufficiency — that is a human judgement no identifier encodes.
 */
describe('asset rights', () => {
	const ASSET_DIRS = ['static/models', 'static/images/parts'];
	const SPDX_ID = /^(LicenseRef-[A-Za-z0-9.-]+|[A-Za-z0-9][A-Za-z0-9.+-]*)$/;
	const CC_ID = /^CC(0-1\.0|-BY(-SA|-ND|-NC)*-\d\.\d)$/;

	function filesUnder(rel: string): string[] {
		const abs = rootUrl(rel);
		return readdirSync(abs, { recursive: true, withFileTypes: true })
			.filter((entry) => entry.isFile())
			.map((entry) => `${entry.parentPath.slice(rootUrl('static').length)}/${entry.name}`);
	}

	const shipped = ASSET_DIRS.flatMap(filesUnder).sort();

	it('scans a non-empty asset set (a moved directory would pass every check vacuously)', () => {
		expect(shipped.length).toBeGreaterThan(5);
		expect(assetCredits.length).toBeGreaterThan(5);
	});

	it('credits every shipped asset exactly once and no file that is not shipped', () => {
		const credited = assetCredits.map((asset) => asset.path).sort();
		expect(credited).toEqual([...new Set(credited)]);
		expect(credited).toEqual(shipped);
	});

	it('gives every asset an SPDX id, and an author plus https source where the license requires attribution', () => {
		for (const { path, rights } of assetCredits) {
			expect(rights.license, path).toMatch(SPDX_ID);
			// Creative Commons ids are case-sensitive SPDX; a near-miss (`cc-by-4.0`, `CC-BY4.0`)
			// would dodge requiresAttribution and with it the author check below.
			if (/^cc/i.test(rights.license)) expect(rights.license, path).toMatch(CC_ID);
			expect(rights.source, path).toMatch(/^https:\/\//);
			if (requiresAttribution(rights.license)) expect(rights.author.trim().length, path).toBeGreaterThan(0);
		}
	});

	it('recognises the attribution licenses it ships', () => {
		expect(requiresAttribution('CC-BY-4.0')).toBe(true);
		expect(requiresAttribution('CC-BY-SA-2.0')).toBe(true);
		expect(requiresAttribution('CC0-1.0')).toBe(false);
		expect(requiresAttribution('LicenseRef-PublicDomain')).toBe(false);
		expect(assetCredits.some((asset) => requiresAttribution(asset.rights.license))).toBe(true);
	});
});
