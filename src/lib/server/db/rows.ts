/**
 * Driver result shim for raw `db.execute()` calls.
 *
 * Prefer Drizzle's query builder with `.returning()` wherever it can express the
 * statement — it normalizes to a plain array on both drivers and makes this helper
 * unnecessary. Reach for raw `db.execute()` only where the builder cannot, e.g.
 * `FOR UPDATE SKIP LOCKED` inside a subquery (see notifications/outbox.ts).
 */

/**
 * Unwrap a `db.execute()` result into plain rows.
 *
 * The two drivers this codebase runs on disagree about the shape: the
 * `neon-serverless` pool used in production returns a pg `QueryResult`
 * (`{ rows, rowCount }`), while `pglite` — and the HTTP driver — hand back a
 * bare array. Casting straight to an array therefore type-checks and then
 * throws at runtime on whichever driver you did not test against, which is
 * exactly how a panel ends up permanently empty behind a `safeDeferPromise`
 * fallback instead of loudly failing.
 */
export function rowsOf<T>(result: unknown): T[] {
	if (Array.isArray(result)) return result as T[];
	const rows = (result as { rows?: unknown })?.rows;
	return Array.isArray(rows) ? (rows as T[]) : [];
}

/**
 * Portable affected/returned row count for a raw `db.execute()`.
 *
 * Do NOT read `rowCount` off the result directly: it exists only on the pg
 * `QueryResult` shape and is `undefined` on pglite, so `res.rowCount ?? 0`
 * silently reports zero under test. Requires the statement to carry a
 * `RETURNING` clause.
 */
export function rowCountOf(result: unknown): number {
	return rowsOf(result).length;
}
