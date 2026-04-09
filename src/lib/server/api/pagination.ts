/**
 * Cursor-based pagination utilities.
 *
 * Standard response shape:
 * { items: T[], has_more: boolean, cursor?: string }
 *
 * Cursors are opaque base64-encoded JSON containing sort column values.
 * Clients pass `?cursor=X&limit=N` query params.
 */

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** Encode cursor values as an opaque base64 string. */
export function encodeCursor(values: Record<string, string | number | null>): string {
	return btoa(JSON.stringify(values));
}

/** Decode an opaque cursor back to its values. Returns null on invalid input. */
export function decodeCursor(cursor: string): Record<string, string | number | null> | null {
	try {
		return JSON.parse(atob(cursor));
	} catch {
		return null;
	}
}

/** Parse limit from query params with bounds enforcement. */
export function parseLimit(url: URL, defaultLimit = DEFAULT_LIMIT): number {
	const raw = Number(url.searchParams.get('limit'));
	if (!raw || raw < 1) return defaultLimit;
	return Math.min(raw, MAX_LIMIT);
}

/** Parse cursor from query params. Returns null if absent or invalid. */
export function parseCursor(url: URL): Record<string, string | number | null> | null {
	const raw = url.searchParams.get('cursor');
	if (!raw) return null;
	return decodeCursor(raw);
}

/**
 * Build a paginated response from a query result.
 *
 * Fetch limit+1 items from DB. If you got more than limit, there are more pages.
 * The cursor function extracts the sort key(s) from the last item.
 */
export function paginatedResponse<T>(
	items: T[],
	limit: number,
	cursorFn: (item: T) => Record<string, string | number | null>,
) {
	const hasMore = items.length > limit;
	const trimmed = hasMore ? items.slice(0, limit) : items;

	return {
		items: trimmed,
		has_more: hasMore,
		...(hasMore &&
			trimmed.length > 0 && {
				cursor: encodeCursor(cursorFn(trimmed[trimmed.length - 1])),
			}),
	};
}
