import { describe, expect, it } from 'vitest';
import { sanitizeInternalPath } from './safe-path';

describe('sanitizeInternalPath', () => {
	it('passes ordinary internal paths through unchanged', () => {
		expect(sanitizeInternalPath('/foo')).toBe('/foo');
		expect(sanitizeInternalPath('/foo/bar')).toBe('/foo/bar');
		expect(sanitizeInternalPath('/')).toBe('/');
	});

	it('preserves the query string', () => {
		expect(sanitizeInternalPath('/foo?a=1&b=2')).toBe('/foo?a=1&b=2');
	});

	// The open-redirect regression. `/en//evil.com` reached this as `//evil.com`
	// and was emitted as a 308 Location — permanent, cached, and upstream of
	// every auth/CSRF/rate-limit handler.
	it('rejects protocol-relative targets', () => {
		expect(sanitizeInternalPath('//evil.com')).toBeNull();
		expect(sanitizeInternalPath('///evil.com')).toBeNull();
		expect(sanitizeInternalPath('////evil.com')).toBeNull();
		expect(sanitizeInternalPath('//evil.com/path?x=1')).toBeNull();
	});

	// WHATWG folds `\` to `/` for special schemes, so these are protocol-relative
	// to a browser even though a naive startsWith('//') check misses them.
	it('rejects backslash-disguised authorities', () => {
		expect(sanitizeInternalPath('/\\evil.com')).toBeNull();
		expect(sanitizeInternalPath('/\\\\evil.com')).toBeNull();
	});

	it('rejects absolute URLs', () => {
		expect(sanitizeInternalPath('https://evil.com')).toBeNull();
		expect(sanitizeInternalPath('http://evil.com')).toBeNull();
		expect(sanitizeInternalPath('javascript:alert(1)')).toBeNull();
		expect(sanitizeInternalPath('data:text/html,<script>alert(1)</script>')).toBeNull();
	});

	it('rejects anything not rooted at /', () => {
		expect(sanitizeInternalPath('foo')).toBeNull();
		expect(sanitizeInternalPath('../foo')).toBeNull();
	});

	it('returns null for empty and nullish input', () => {
		expect(sanitizeInternalPath(null)).toBeNull();
		expect(sanitizeInternalPath(undefined)).toBeNull();
		expect(sanitizeInternalPath('')).toBeNull();
	});

	// Whatever a traversal normalises to, it must still be same-origin.
	it('normalises traversal without escaping the origin', () => {
		const out = sanitizeInternalPath('/foo/../bar');
		expect(out).toBe('/bar');
		expect(out?.startsWith('//')).toBe(false);
	});

	it('never returns a value a browser could read as off-origin', () => {
		const hostile = ['//evil.com', '///evil.com', '/\\evil.com', 'https://evil.com', '//evil.com/x'];
		for (const raw of hostile) {
			const out = sanitizeInternalPath(raw);
			// Either rejected, or a plain single-slash-rooted path.
			expect(out === null || (out.startsWith('/') && !out.startsWith('//'))).toBe(true);
		}
	});
});
