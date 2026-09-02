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
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { getManifest } from '$lib/server/docs/manifest';
import { showcases } from '../showcases/catalog/registry';
import { creditGroups, credits } from './registry';

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

	describe('PRESENCE — every npm-sourced credit is still a real dependency', () => {
		for (const entry of credits) {
			if (entry.source.kind !== 'npm') continue;
			const pkg = entry.source.pkg;
			it(`${entry.id} → "${pkg}" is in package.json`, () => {
				expect(
					declaredDeps.has(pkg),
					`"${pkg}" is not in dependencies/devDependencies — remove or update the credit`,
				).toBe(true);
			});
		}
	});

	describe('LICENSE — displayed SPDX matches installed package metadata', () => {
		for (const entry of credits) {
			if (entry.source.kind !== 'npm') continue;
			const pkg = entry.source.pkg;
			it(`${entry.id} → "${pkg}" license "${entry.license}"`, () => {
				expect(entry.license, `npm-sourced entry ${entry.id} must declare a license`).toBeTruthy();
				const actual = installedLicense(pkg);
				if (actual === null) return; // not resolvable locally — presence check still holds
				expect(entry.license, `"${pkg}" ships license "${actual}"`).toBe(actual);
			});
		}
	});

	describe('DOCS — every docs href resolves to a published doc', () => {
		for (const entry of credits) {
			if (!entry.docs) continue;
			const href = entry.docs;
			it(`${entry.id} → "${href}"`, () => {
				expect(validDocUrls.has(href), `"${href}" not found in the published docs manifest`).toBe(true);
			});
		}
	});

	describe('SHOWCASE — every showcase href is a real showcase-tree node', () => {
		for (const entry of credits) {
			if (!entry.showcase) continue;
			const href = entry.showcase;
			it(`${entry.id} → "${href}"`, () => {
				expect(validShowcases.has(href), `"${href}" not found in the showcase registry`).toBe(true);
			});
		}
	});

	describe('SERVICES — hosted services claim no license', () => {
		for (const entry of credits) {
			if (entry.source.kind !== 'service') continue;
			it(`${entry.id} has no license string`, () => {
				expect(entry.license).toBeUndefined();
			});
		}
	});
});
