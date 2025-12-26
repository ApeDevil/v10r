---
name: drizzle
description: Drizzle ORM patterns for Velociraptor. Use when writing database schemas, queries, transactions, or migrations. Includes Neon PostgreSQL serverless, type inference from relations, Better Auth table conventions, and error handling. Essential for any $lib/server/db file.
---

# Drizzle ORM

Type-safe SQL with Neon PostgreSQL serverless. Schema-first, zero runtime overhead.

| Concept | Purpose |
|---------|---------|
| `pgTable` | Define tables |
| `relations` | Drizzle relations (NOT SQL foreign keys) |
| `db.query` | Relational query API |
| `db.insert/update/delete` | Query builder API |
| `db.transaction` | Atomic operations |

## Schema Definition

```typescript
// src/lib/server/db/schema/items.ts
import { pgTable, text, timestamp, pgEnum, primaryKey, index } from 'drizzle-orm/pg-core';
import { user } from './_better-auth';

export const itemStatusEnum = pgEnum('item_status', ['draft', 'published', 'archived']);

export const items = pgTable('items', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: itemStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

// Indexes - define separately
export const itemsUserIdx = index('items_user_id_idx').on(items.userId);
export const itemsStatusIdx = index('items_status_idx').on(items.status);
```

### Junction Tables

```typescript
export const itemTags = pgTable(
  'item_tags',
  {
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.itemId, table.tagId] })
  })
);
```

## Better Auth Tables

Better Auth auto-generates schema. **Never edit manually.**

```bash
bunx @better-auth/cli generate
bunx drizzle-kit migrate
```

```typescript
// src/lib/server/db/schema/_better-auth.ts
// AUTO-GENERATED - underscore prefix indicates generated file
// Re-run CLI after Better Auth updates

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// CRITICAL: Better Auth does NOT auto-generate indexes. Add manually!
export const sessionUserIdx = index('session_user_id_idx').on(session.userId);
export const sessionExpiresIdx = index('session_expires_at_idx').on(session.expiresAt);
```

## Schema Index

```typescript
// src/lib/server/db/schema/index.ts
export * from './_better-auth'; // Auto-generated
export * from './auth';         // Custom: userProfile
export * from './items';        // Custom: items, tags, itemTags
```

## ID Generation

Prefixed IDs for debugging clarity:

```typescript
// src/lib/server/db/id.ts
import { nanoid } from 'nanoid';

export const createId = {
  user: () => `usr_${nanoid(12)}`,
  session: () => `ses_${nanoid(24)}`,
  item: () => `itm_${nanoid(12)}`,
  tag: () => `tag_${nanoid(8)}`,
  file: () => `fil_${nanoid(12)}`,
};

// Usage: const id = createId.item(); // 'itm_V1StGXR8_Z5j'
```

## Relations

Drizzle relations are **separate from SQL foreign keys**. Define in `relations.ts`:

```typescript
// src/lib/server/db/relations.ts
import { relations } from 'drizzle-orm';
import { user } from './schema/_better-auth';
import { items, tags, itemTags } from './schema/items';

export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(userProfile, {
    fields: [user.id],
    references: [userProfile.userId]
  }),
  items: many(items),
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  user: one(user, {
    fields: [items.userId],
    references: [user.id]
  }),
  itemTags: many(itemTags)
}));

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, {
    fields: [itemTags.itemId],
    references: [items.id]
  }),
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id]
  })
}));
```

**Rule:** Relations must be exported in db client for `db.query` to work.

## Database Client

```typescript
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import * as relations from './relations';

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema: { ...schema, ...relations }  // BOTH required for db.query
});

export { schema };
export * from './types';
export * from './id';
```

## Queries

### Relational API (with relations)

```typescript
// Use db.query for queries that need relations
const items = await db.query.items.findMany({
  where: eq(items.userId, userId),
  with: {
    itemTags: {
      with: { tag: true }
    }
  }
});

// Single item
const item = await db.query.items.findFirst({
  where: eq(items.id, itemId),
  with: { user: true }
});
```

### Query Builder (without relations)

```typescript
import { eq, and, desc, sql } from 'drizzle-orm';

// Simple queries
const items = await db.select().from(schema.items)
  .where(eq(schema.items.userId, userId))
  .orderBy(desc(schema.items.createdAt));

// Joins (manual)
const itemsWithTags = await db.select()
  .from(schema.items)
  .leftJoin(schema.itemTags, eq(schema.items.id, schema.itemTags.itemId))
  .leftJoin(schema.tags, eq(schema.itemTags.tagId, schema.tags.id));
```

### Mutations

```typescript
// Insert with returning
const [item] = await db.insert(schema.items).values({
  id: createId.item(),
  userId,
  title: 'New Item',
}).returning();

// Update
await db.update(schema.items)
  .set({ status: 'published', updatedAt: new Date() })
  .where(eq(schema.items.id, itemId));

// Delete
await db.delete(schema.items)
  .where(eq(schema.items.id, itemId));
```

## Type Inference

```typescript
// src/lib/server/db/types.ts
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Basic types from schema
export type Item = InferSelectModel<typeof items>;
export type NewItem = InferInsertModel<typeof items>;

// Composite types for relations (manual - InferSelectModel doesn't include relations)
export type ItemWithTags = Item & { tags: Tag[] };
export type ItemFull = Item & { tags: Tag[]; user: User };
```

### Type from Query Function

```typescript
// Best pattern: Infer from the actual query
export async function getItemsWithTags(userId: string) {
  return db.query.items.findMany({
    where: eq(items.userId, userId),
    with: { itemTags: { with: { tag: true } } }
  });
}

// Infer the return type
export type ItemsWithTags = Awaited<ReturnType<typeof getItemsWithTags>>;
```

## Transactions

```typescript
await db.transaction(async (tx) => {
  // 1. Create item
  const [item] = await tx.insert(schema.items).values({
    id: createId.item(),
    userId,
    title: form.data.title,
  }).returning();

  // 2. Create associations
  if (form.data.tagIds?.length) {
    await tx.insert(schema.itemTags).values(
      form.data.tagIds.map(tagId => ({
        itemId: item.id,
        tagId,
      }))
    );
  }
});
```

**When to use transactions:**
- Insert + related records
- Conditional update (read-then-write)
- Outbox pattern for events

## Error Handling

```typescript
// src/lib/server/db/errors.ts
import { error } from '@sveltejs/kit';

export const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
} as const;

export function mapDbError(err: unknown): never {
  if (err instanceof Error && 'code' in err) {
    const code = (err as { code: string }).code;
    switch (code) {
      case PG_ERROR_CODES.UNIQUE_VIOLATION:
        error(409, 'A record with this value already exists.');
      case PG_ERROR_CODES.FOREIGN_KEY_VIOLATION:
        error(400, 'Referenced record does not exist.');
      default:
        console.error('Database error:', err);
        error(500, 'Database error occurred.');
    }
  }
  error(500, 'An unexpected error occurred.');
}
```

```typescript
// Usage in load functions
try {
  const item = await db.query.items.findFirst({ where: eq(items.id, params.id) });
  if (!item) error(404, 'Item not found');
  return { item };
} catch (err) {
  mapDbError(err);
}
```

## Migrations

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! }
});
```

```bash
bunx drizzle-kit generate  # Generate migration from schema changes
bunx drizzle-kit migrate   # Apply migrations
bunx drizzle-kit push      # Push directly (dev only, destructive)
bunx drizzle-kit studio    # Visual database browser
```

## Anti-Patterns

**Don't use Prisma-style syntax:**
```typescript
// WRONG - Prisma syntax
const items = await db.items.findMany({ where: { userId } });

// RIGHT - Drizzle syntax
const items = await db.query.items.findMany({ where: eq(items.userId, userId) });
```

**Don't forget to include relations in db client:**
```typescript
// WRONG - db.query won't work
export const db = drizzle(sql, { schema });

// RIGHT - include relations
export const db = drizzle(sql, { schema: { ...schema, ...relations } });
```

**Don't expect InferSelectModel to include relations:**
```typescript
// WRONG - relations not included
type Item = InferSelectModel<typeof items>;
const item: Item = { ...data, tags: [] }; // Error: 'tags' does not exist

// RIGHT - define composite type manually
type ItemWithTags = Item & { tags: Tag[] };
```

**Don't use db.query for simple queries without relations:**
```typescript
// WRONG - unnecessary overhead
await db.query.items.findFirst({ where: eq(items.id, id) });

// RIGHT - use query builder for simple cases
await db.select().from(items).where(eq(items.id, id)).limit(1);
```

**Don't edit Better Auth generated schema:**
```typescript
// WRONG - editing _better-auth.ts
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  customField: text('custom'), // DON'T add here!
});

// RIGHT - extend in separate table
export const userProfile = pgTable('user_profile', {
  userId: text('user_id').primaryKey().references(() => user.id),
  customField: text('custom'),
});
```

## File Structure

```
src/lib/server/db/
├── index.ts              # DB client export
├── id.ts                 # ID generation (createId.item(), etc.)
├── types.ts              # Type inference
├── errors.ts             # Error code mapping
├── relations.ts          # Drizzle relations
└── schema/
    ├── index.ts          # Re-exports
    ├── _better-auth.ts   # Auto-generated (underscore = generated)
    ├── auth.ts           # Custom: userProfile
    └── items.ts          # Custom: items, tags, itemTags
```

## References

- **references/schema.md** - Table definitions, indexes, enums, constraints
- **references/queries.md** - Query builder vs relational API, operators
- **references/relations.md** - Drizzle relations, many-to-many patterns
- **references/transactions.md** - Atomic operations, outbox pattern
- **references/types.md** - Type inference patterns, composite types
