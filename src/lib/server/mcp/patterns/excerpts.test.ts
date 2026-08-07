import { describe, expect, it } from 'vitest';
import { deriveExcerptAllowlist, isFileRef } from './allowlist';
import { PATTERNS } from './data';
import { EXCERPT_ALLOWLIST, isAllowlisted, readAllowlistedExcerpt, SNAPSHOT_PATHS } from './excerpts';

describe('EXCERPT_ALLOWLIST', () => {
	it('is non-empty and contains only registry-referenced repo-relative file paths', () => {
		expect(EXCERPT_ALLOWLIST.size).toBeGreaterThan(0);
		for (const path of EXCERPT_ALLOWLIST) {
			expect(path.startsWith('/')).toBe(false);
			expect(path).not.toMatch(/\.env|\.pem|\.key|secret|credential|node_modules|\.git/i);
		}
	});

	it('matches the pure derivation from the registry (no drift within the bundle)', () => {
		expect([...EXCERPT_ALLOWLIST].sort()).toEqual(deriveExcerptAllowlist());
	});

	it('derives from DEEP-tier records only — light index refs never grow the snapshot', () => {
		const deepFilePaths = new Set(
			PATTERNS.filter((p) => p.tier === 'deep')
				.flatMap((p) => [...p.docs, ...p.code, ...p.tests, ...p.showcases])
				.filter((ref) => isFileRef(ref))
				.map((ref) => ref.path),
		);
		for (const path of EXCERPT_ALLOWLIST) {
			expect(deepFilePaths.has(path), `${path} is not referenced by any deep record`).toBe(true);
		}
		// And a light-only docs ref is NOT allowlisted (falls to the not_found branch).
		const lightOnly = PATTERNS.filter((p) => p.tier === 'light')
			.flatMap((p) => p.docs)
			.filter((ref) => isFileRef(ref))
			.map((ref) => ref.path)
			.find((path) => !deepFilePaths.has(path));
		expect(lightOnly).toBeTruthy();
		if (lightOnly) {
			expect(isAllowlisted(lightOnly)).toBe(false);
			const result = readAllowlistedExcerpt(lightOnly);
			expect(result.ok).toBe(false);
			expect(result.text).toMatch(/deep-tier|not an allowlisted file/);
		}
	});
});

describe('build-time snapshot integrity', () => {
	it('every allowlisted path is captured in the bundled snapshot', () => {
		for (const path of EXCERPT_ALLOWLIST) {
			expect(SNAPSHOT_PATHS.has(path), `snapshot missing ${path}`).toBe(true);
		}
	});

	it('the snapshot contains no path outside the allowlist', () => {
		for (const path of SNAPSHOT_PATHS) {
			expect(isAllowlisted(path)).toBe(true);
		}
	});
});

describe('readAllowlistedExcerpt (served from the bundled snapshot, not the filesystem)', () => {
	it('reads an allowlisted file from the snapshot', () => {
		const path = [...SNAPSHOT_PATHS][0];
		expect(path).toBeTruthy();
		const result = readAllowlistedExcerpt(path, 1, 5);
		expect(result.ok).toBe(true);
		expect(result.text).toMatch(/lines 1-/);
	});

	it('rejects a real repo file that is NOT on the allowlist', () => {
		expect(isAllowlisted('package.json')).toBe(false);
		const result = readAllowlistedExcerpt('package.json');
		expect(result.ok).toBe(false);
		expect(result.text).toMatch(/not an allowlisted file/);
	});

	it('rejects secret-looking paths even if crafted', () => {
		expect(readAllowlistedExcerpt('.env').ok).toBe(false);
		expect(readAllowlistedExcerpt('secrets/keys.pem').ok).toBe(false);
	});

	it('rejects absolute paths', () => {
		const result = readAllowlistedExcerpt('/etc/passwd');
		expect(result.ok).toBe(false);
		expect(result.text).toMatch(/absolute paths are rejected/);
	});

	it('rejects traversal outside the repo', () => {
		expect(readAllowlistedExcerpt('../../../../etc/passwd').ok).toBe(false);
	});

	it('bounds the number of lines returned', () => {
		const path = [...SNAPSHOT_PATHS][0];
		const result = readAllowlistedExcerpt(path, 1, 10_000);
		expect(result.ok).toBe(true);
		// header + at most MAX_LINES(250) content lines
		expect(result.text.split('\n').length).toBeLessThanOrEqual(251);
	});
});
