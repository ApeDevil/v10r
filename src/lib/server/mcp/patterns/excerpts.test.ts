import { describe, expect, it } from 'vitest';
import { deriveExcerptAllowlist } from './allowlist';
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
