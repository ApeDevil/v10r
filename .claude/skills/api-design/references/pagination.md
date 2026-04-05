# Pagination

Deep dive on pagination patterns with Drizzle ORM and PostgreSQL.

## Cursor vs Offset

| Factor | Offset | Cursor |
|--------|--------|--------|
| Random page access | Yes (`?page=47`) | No (sequential only) |
| Performance at depth | Degrades (`OFFSET 100000` = full scan) | Constant (seek method) |
| Consistency on mutations | Duplicates/gaps when rows insert/delete | Stable (cursor anchors position) |
| Implementation complexity | Simple | Moderate |
| Best for | Admin UIs, small datasets | User feeds, large/dynamic datasets |

**Default to cursor pagination.** Use offset only for admin-facing UIs where random page access is a requirement.

## Cursor Pagination with Drizzle

### Cursor Encoding

Use an opaque base64 cursor wrapping a composite key (timestamp + ID). The composite key ensures deterministic ordering even when timestamps collide.

```typescript
// src/lib/server/api/cursor.ts

interface CursorPayload {
  /** ISO timestamp */
  t: string;
  /** Entity ID */
  i: string;
}

export function encodeCursor(createdAt: Date, id: string): string {
  const payload: CursorPayload = {
    t: createdAt.toISOString(),
    i: id,
  };
  return btoa(JSON.stringify(payload));
}

export function decodeCursor(cursor: string): CursorPayload | null {
  try {
    const parsed = JSON.parse(atob(cursor));
    if (typeof parsed.t !== 'string' || typeof parsed.i !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
```

### Seek Query Pattern

The seek method uses a composite `WHERE` clause instead of `OFFSET`. PostgreSQL can use a composite index `(created_at DESC, id DESC)` to satisfy this efficiently at any depth.

```typescript
import { and, desc, eq, lt, or } from 'drizzle-orm';

interface PaginatedResult<T> {
  data: T[];
  meta: {
    limit: number;
    has_more: boolean;
    next_cursor: string | null;
  };
}

export async function paginateWithCursor<T extends { createdAt: Date; id: string }>(
  query: () => Promise<T[]>,
  limit: number,
): Promise<PaginatedResult<T>> {
  // Fetch one extra to detect has_more
  const items = await query();
  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const lastItem = items[items.length - 1];
  const nextCursor = hasMore && lastItem
    ? encodeCursor(lastItem.createdAt, lastItem.id)
    : null;

  return {
    data: items,
    meta: { limit, has_more: hasMore, next_cursor: nextCursor },
  };
}
```

### Full Endpoint Example

```typescript
// src/routes/api/v1/posts/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { decodeCursor, encodeCursor } from '$lib/server/api/cursor';
import { requireApiUser } from '$lib/server/auth/guards';
import { db } from '$lib/server/db';
import { posts } from '$lib/server/db/schema';
import { and, desc, eq, lt, or } from 'drizzle-orm';

export const GET: RequestHandler = async ({ url, locals }) => {
  const { user } = requireApiUser(locals);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100);
  const cursorParam = url.searchParams.get('cursor');
  const decoded = cursorParam ? decodeCursor(cursorParam) : null;

  const conditions = [eq(posts.userId, user.id)];

  if (decoded) {
    conditions.push(
      or(
        lt(posts.createdAt, new Date(decoded.t)),
        and(
          eq(posts.createdAt, new Date(decoded.t)),
          lt(posts.id, decoded.i),
        ),
      )!,
    );
  }

  const items = await db
    .select()
    .from(posts)
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt), desc(posts.id))
    .limit(limit + 1);

  const hasMore = items.length > limit;
  if (hasMore) items.pop();

  const lastItem = items[items.length - 1];

  return json({
    data: items.map(toPostResponse),
    meta: {
      limit,
      has_more: hasMore,
      next_cursor: hasMore && lastItem
        ? encodeCursor(lastItem.createdAt, lastItem.id)
        : null,
    },
  });
};
```

### Required Index

```sql
CREATE INDEX idx_posts_created_id ON posts (created_at DESC, id DESC);
```

Without this composite index, the seek method falls back to a sequential scan.

## Offset Pagination (Admin UIs)

```typescript
import * as v from 'valibot';

export const OffsetPaginationSchema = v.object({
  limit: v.optional(v.pipe(v.number(), v.minValue(1), v.maxValue(100)), 20),
  offset: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
});

// Usage in endpoint
const { limit, offset } = validateQuery(url, OffsetPaginationSchema);

const [results, [{ count }]] = await Promise.all([
  db.select().from(items).limit(limit).offset(offset),
  db.select({ count: sql`count(*)` }).from(items),
]);

return json({
  data: results.map(toItemResponse),
  meta: {
    total: Number(count),
    limit,
    offset,
    has_more: offset + results.length < Number(count),
  },
});
```

## Pagination in AI Tool Results

AI tools use the same pagination functions but return structured data (not Response objects):

```typescript
execute: async ({ cursor }) => {
  const result = await getPostsPaginated(userId, 10, cursor);
  return {
    posts: result.data.map(p => ({
      id: p.id,
      title: `[POST_TITLE]${p.title}[/POST_TITLE]`,
      created_at: p.createdAt.toISOString(),
    })),
    has_more: result.meta.has_more,
    next_cursor: result.meta.next_cursor,
  };
},
```
