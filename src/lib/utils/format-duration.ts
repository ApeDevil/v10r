/**
 * Duration formatting — the single implementation behind every "how long"
 * label. Call sites must import it rather than keep a local copy.
 *
 * Locale note: these are compact technical labels (`3m 12s`), not prose —
 * unit letters stay untranslated by design, like `ms` in devtools.
 */

/** Format Redis-style TTL seconds. -2 = key expired, -1 = no expiry set. */
export function formatTtl(seconds: number): string {
	if (seconds === -2) return 'expired';
	if (seconds === -1) return 'no expiry';
	if (seconds < 60) return `${seconds}s`;
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/** Format a millisecond duration: `840ms`, `12s`, `3m 12s`. */
export function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const seconds = Math.floor(ms / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	return `${minutes}m ${seconds % 60}s`;
}
