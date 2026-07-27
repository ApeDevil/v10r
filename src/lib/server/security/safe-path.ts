/**
 * Same-origin path validation — the single implementation behind every
 * server-side redirect target in the app.
 *
 * Three call sites feed user-influenced strings into a `Location` header or a
 * `redirect()`: the `?returnTo=` param on the login and verify pages, and the
 * `/en/` prefix-stripping hook. Each previously carried its own copy of this
 * logic (login and verify were byte-identical duplicates; the hook had none,
 * which is how the open redirect got in).
 *
 * What has to be rejected, and why plain "starts with /" is not enough:
 *  - `//evil.com`   — protocol-relative; the browser reads it as a foreign origin.
 *  - `///evil.com`  — same, after the extra slashes collapse.
 *  - `/\evil.com`   — WHATWG folds `\` to `/` for http(s), so this is `//evil.com`.
 *
 * The `new URL(raw, base)` + origin comparison catches all three at once,
 * including forms not enumerated above: anything that resolves off-origin
 * fails the check regardless of how it was spelled.
 */

/** Sentinel base — any input that escapes it resolves to a different origin. */
const PROBE_BASE = 'http://localhost';

/**
 * Returns `raw` as a safe same-origin `pathname + search`, or `null` when it is
 * absolute, protocol-relative, backslash-disguised, or unparseable.
 *
 * Returns `null` rather than a fallback path: callers differ on what the
 * fallback should be (a page redirects to its default, the hook declines to
 * redirect at all), and baking one in here would force the wrong behaviour on
 * one of them.
 */
export function sanitizeInternalPath(raw: string | null | undefined): string | null {
	if (!raw) return null;
	if (!raw.startsWith('/') || raw.startsWith('//')) return null;
	try {
		const parsed = new URL(raw, PROBE_BASE);
		if (parsed.origin !== PROBE_BASE) return null;
		return parsed.pathname + parsed.search;
	} catch {
		return null;
	}
}
