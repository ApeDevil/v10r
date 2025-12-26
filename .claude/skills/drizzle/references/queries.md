# Queries

Query builder vs relational API patterns.

## When to Use Which

| API | Use When |
|-----|----------|
| **Query Builder** (`db.select()`) | Simple queries, no relations, aggregations, complex joins |
| **Relational API** (`db.query.*`) | Queries with nested relations, cleaner syntax |

## Operators

```typescript
import {
  eq,        // =
  ne,        // !=
  lt,        // <
  lte,       // <=
  gt,        // >
  gte,       // >=
  isNull,    // IS NULL
  isNotNull, // IS NOT NULL
  inArray,   // IN (...)
  notInArray,// NOT IN (...)
  like,      // LIKE
  ilike,     // ILIKE (case-insensitive)
  between,   // BETWEEN
  and,       // AND
  or,        // OR
  not,       // NOT
  sql,       // Raw SQL
} from 'drizzle-orm';
```

## Query Builder

### Select

```typescript
// Basic select
const allItems = await db.select().from(items);

// Select specific columns
const titles = await db.select({
  id: items.id,
  title: items.title
}).from(items);

// With where clause
const userItems = await db.select()
  .from(items)
  .where(eq(items.userId, userId));

// Multiple conditions
const published = await db.select()
  .from(items)
  .where(and(
    eq(items.userId, userId),
    eq(items.status, 'published')
  ));

// OR conditions
const draftsOrPublished = await db.select()
  .from(items)
  .where(or(
    eq(items.status, 'draft'),
    eq(items.status, 'published')
  ));

// Order and limit
const recent = await db.select()
  .from(items)
  .orderBy(desc(items.createdAt))
  .limit(10);

// Offset for pagination
const page2 = await db.select()
  .from(items)
  .limit(10)
  .offset(10);
```

### Joins

```typescript
// Left join
const itemsWithUsers = await db.select({
  item: items,
  user: user,
})
  .from(items)
  .leftJoin(user, eq(items.userId, user.id));

// Inner join
const itemsWithTags = await db.select()
  .from(items)
  .innerJoin(itemTags, eq(items.id, itemTags.itemId))
  .innerJoin(tags, eq(itemTags.tagId, tags.id));

// Multiple joins
const full = await db.select({
  item: items,
  tag: tags,
  user: user,
})
  .from(items)
  .leftJoin(itemTags, eq(items.id, itemTags.itemId))
  .leftJoin(tags, eq(itemTags.tagId, tags.id))
  .leftJoin(user, eq(items.userId, user.id))
  .where(eq(items.status, 'published'));
```

### Aggregations

```typescript
import { count, sum, avg, min, max } from 'drizzle-orm';

// Count
const [{ total }] = await db.select({
  total: count()
}).from(items);

// Count with condition
const [{ published }] = await db.select({
  published: count()
})
  .from(items)
  .where(eq(items.status, 'published'));

// Group by
const byStatus = await db.select({
  status: items.status,
  count: count(),
})
  .from(items)
  .groupBy(items.status);

// Sum
const [{ total }] = await db.select({
  total: sum(orders.amount)
}).from(orders);
```

### Subqueries

```typescript
import { sql } from 'drizzle-orm';

// Subquery in where
const usersWithItems = await db.select()
  .from(user)
  .where(
    inArray(
      user.id,
      db.select({ id: items.userId }).from(items)
    )
  );

// Subquery as column
const itemCounts = await db.select({
  userId: user.id,
  name: user.name,
  itemCount: sql<number>`(
    SELECT COUNT(*) FROM ${items}
    WHERE ${items.userId} = ${user.id}
  )`,
}).from(user);
```

## Relational API

Requires relations to be defined and included in db client.

### Find Many

```typescript
// Basic
const allItems = await db.query.items.findMany();

// With where
const userItems = await db.query.items.findMany({
  where: eq(items.userId, userId),
});

// With relations
const itemsWithTags = await db.query.items.findMany({
  where: eq(items.userId, userId),
  with: {
    itemTags: {
      with: { tag: true }
    }
  }
});

// Order and limit
const recent = await db.query.items.findMany({
  orderBy: [desc(items.createdAt)],
  limit: 10,
});

// Select specific columns
const titles = await db.query.items.findMany({
  columns: { id: true, title: true },
});

// Exclude columns
const noContent = await db.query.items.findMany({
  columns: { content: false },
});
```

### Find First

```typescript
// Single item
const item = await db.query.items.findFirst({
  where: eq(items.id, itemId),
});

// With relations
const itemFull = await db.query.items.findFirst({
  where: eq(items.id, itemId),
  with: {
    user: true,
    itemTags: { with: { tag: true } }
  }
});
```

### Nested Relations

```typescript
// Deep nesting
const userWithAll = await db.query.user.findFirst({
  where: eq(user.id, userId),
  with: {
    profile: true,
    items: {
      where: eq(items.status, 'published'),
      orderBy: [desc(items.createdAt)],
      limit: 5,
      with: {
        itemTags: { with: { tag: true } }
      }
    }
  }
});
```

## Insert

```typescript
// Single insert
await db.insert(items).values({
  id: createId.item(),
  userId,
  title: 'New Item',
});

// Insert with returning
const [item] = await db.insert(items).values({
  id: createId.item(),
  userId,
  title: 'New Item',
}).returning();

// Insert multiple
await db.insert(tags).values([
  { id: createId.tag(), name: 'Tag 1' },
  { id: createId.tag(), name: 'Tag 2' },
]);

// Insert with conflict handling
await db.insert(tags)
  .values({ id: createId.tag(), name: 'Unique' })
  .onConflictDoNothing();

// Upsert
await db.insert(userSettings)
  .values({ userId, theme: 'dark' })
  .onConflictDoUpdate({
    target: userSettings.userId,
    set: { theme: 'dark' },
  });
```

## Update

```typescript
// Update with where
await db.update(items)
  .set({ status: 'published', updatedAt: new Date() })
  .where(eq(items.id, itemId));

// Update with returning
const [updated] = await db.update(items)
  .set({ title: 'New Title' })
  .where(eq(items.id, itemId))
  .returning();

// Update multiple conditions
await db.update(items)
  .set({ status: 'archived' })
  .where(and(
    eq(items.userId, userId),
    eq(items.status, 'draft')
  ));
```

## Delete

```typescript
// Delete with where
await db.delete(items)
  .where(eq(items.id, itemId));

// Delete with returning
const [deleted] = await db.delete(items)
  .where(eq(items.id, itemId))
  .returning();

// Delete multiple
await db.delete(items)
  .where(and(
    eq(items.userId, userId),
    eq(items.status, 'archived')
  ));
```

## Raw SQL

```typescript
import { sql } from 'drizzle-orm';

// Raw where clause
const items = await db.select()
  .from(items)
  .where(sql`${items.title} ILIKE ${`%${search}%`}`);

// Raw column
const withRank = await db.select({
  id: items.id,
  rank: sql<number>`ts_rank(to_tsvector(${items.content}), plainto_tsquery(${query}))`,
}).from(items);

// Full raw query
const result = await db.execute(sql`
  SELECT * FROM items
  WHERE created_at > NOW() - INTERVAL '7 days'
`);
```

## Prepared Statements

```typescript
// Create prepared statement
const getItem = db.query.items.findFirst({
  where: eq(items.id, sql.placeholder('id')),
}).prepare('get_item');

// Execute with params
const item = await getItem.execute({ id: itemId });
```
