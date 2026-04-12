/**
 * Pagination utilities — offset-based and cursor-based.
 *
 * Offset-based (simpler):
 *   Query: ?page=1&pageSize=50
 *   Response: { items: T[], pagination: { page, pageSize, total, totalPages } }
 *
 * Cursor-based (for large/sorted sets):
 *   Query: ?cursor=X&limit=N
 *   Response: { items: T[], has_more: boolean, cursor?: string }
 */

import { json } from '@sveltejs/kit';

// ---------------------------------------------------------------------------
// Offset-based pagination
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export interface PaginationParams {
	page: number;
	pageSize: number;
	offset: number;
}

/** Parse page/pageSize query params with bounds enforcement. */
export function parsePagination(url: URL, defaultPageSize = DEFAULT_PAGE_SIZE): PaginationParams {
	const page = Math.max(1, Number(url.searchParams.get('page')) || 1);
	const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(url.searchParams.get('pageSize')) || defaultPageSize));
	return { page, pageSize, offset: (page - 1) * pageSize };
}

/** Return a standardized paginated JSON response. */
export function apiPaginated<T>(items: T[], total: number, params: PaginationParams) {
	return json({
		data: {
			items,
			pagination: {
				page: params.page,
				pageSize: params.pageSize,
				total,
				totalPages: Math.ceil(total / params.pageSize),
			},
		},
	});
}

// ---------------------------------------------------------------------------
// Cursor-based pagination
// ---------------------------------------------------------------------------

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
