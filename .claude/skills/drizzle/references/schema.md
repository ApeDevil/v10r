# Schema Definition

Complete reference for Drizzle PostgreSQL schema patterns.

## Column Types

```typescript
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  date,
  json,
  jsonb,
  uuid,
  serial,
  bigserial,
  real,
  doublePrecision,
  varchar,
  char,
} from 'drizzle-orm/pg-core';

const example = pgTable('example', {
  // Strings
  id: text('id').primaryKey(),
  name: varchar('name', { length: 255 }),
  code: char('code', { length: 2 }),

  // Numbers
  count: integer('count'),
  order: serial('order'),          // Auto-increment
  bigId: bigserial('big_id', { mode: 'number' }),
  price: real('price'),
  precise: doublePrecision('precise'),

  // Boolean
  active: boolean('active').default(true),

  // Dates
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  birthDate: date('birth_date'),

  // JSON
  metadata: json('metadata'),      // json type
  settings: jsonb('settings'),     // jsonb type (indexable)

  // UUID
  externalId: uuid('external_id').defaultRandom(),
});
```

## Column Modifiers

```typescript
const items = pgTable('items', {
  id: text('id').primaryKey(),

  // Required field
  title: text('title').notNull(),

  // Unique constraint
  slug: text('slug').notNull().unique(),

  // Default values
  status: text('status').notNull().default('draft'),
  count: integer('count').notNull().default(0),

  // Auto timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),

  // Foreign key
  userId: text('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});
```

## Enums

```typescript
import { pgEnum } from 'drizzle-orm/pg-core';

// Define enum
export const itemStatusEnum = pgEnum('item_status', [
  'draft',
  'published',
  'archived'
]);

// Use in table
export const items = pgTable('items', {
  status: itemStatusEnum('status').notNull().default('draft'),
});
```

## Foreign Keys

```typescript
// Inline reference
userId: text('user_id')
  .notNull()
  .references(() => user.id, { onDelete: 'cascade' }),

// onDelete options:
// 'cascade'    - Delete child when parent deleted
// 'set null'   - Set to null when parent deleted
// 'no action'  - Throw error (default)
// 'restrict'   - Throw error
// 'set default'- Set to default value

// Optional foreign key (nullable)
itemId: text('item_id')
  .references(() => items.id, { onDelete: 'set null' }),
```

## Composite Primary Keys

```typescript
import { primaryKey } from 'drizzle-orm/pg-core';

export const itemTags = pgTable(
  'item_tags',
  {
    itemId: text('item_id').notNull(),
    tagId: text('tag_id').notNull(),
    addedAt: timestamp('added_at').defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.itemId, table.tagId] })
  })
);
```

## Indexes

```typescript
import { index, uniqueIndex } from 'drizzle-orm/pg-core';

export const items = pgTable(
  'items',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    slug: text('slug').notNull(),
    status: text('status'),
    createdAt: timestamp('created_at'),
  },
  (table) => ({
    // Single column index
    userIdx: index('items_user_id_idx').on(table.userId),

    // Unique index
    slugIdx: uniqueIndex('items_slug_idx').on(table.slug),

    // Composite index
    userStatusIdx: index('items_user_status_idx')
      .on(table.userId, table.status),

    // Descending index for sorting
    createdIdx: index('items_created_at_idx')
      .on(table.createdAt.desc()),
  })
);
```

### Better Auth Index Gotcha

Better Auth does NOT auto-generate indexes. Add manually for performance:

```typescript
// In _better-auth.ts after generation
export const sessionUserIdx = index('session_user_id_idx').on(session.userId);
export const sessionExpiresIdx = index('session_expires_at_idx').on(session.expiresAt);
```

## Check Constraints

```typescript
import { check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const products = pgTable(
  'products',
  {
    id: text('id').primaryKey(),
    price: integer('price').notNull(),
    quantity: integer('quantity').notNull(),
  },
  (table) => ({
    pricePositive: check('price_positive', sql`${table.price} >= 0`),
    quantityValid: check('quantity_valid', sql`${table.quantity} >= 0`),
  })
);
```

## Schema Organization

```
src/lib/server/db/schema/
├── index.ts          # Re-exports all schemas
├── _better-auth.ts   # Auto-generated (underscore prefix)
├── auth.ts           # userProfile, userSettings
├── items.ts          # items, tags, itemTags
└── files.ts          # files, attachments
```

```typescript
// src/lib/server/db/schema/index.ts
export * from './_better-auth';
export * from './auth';
export * from './items';
export * from './files';
```

## Timestamp Patterns

```typescript
// Standard timestamp columns
createdAt: timestamp('created_at', { withTimezone: true })
  .notNull()
  .defaultNow(),

updatedAt: timestamp('updated_at', { withTimezone: true })
  .notNull()
  .defaultNow(),

// For sessions/tokens with expiry
expiresAt: timestamp('expires_at', { withTimezone: true })
  .notNull(),

// Optional timestamp
deletedAt: timestamp('deleted_at', { withTimezone: true }),
```

## Array Columns

```typescript
import { text } from 'drizzle-orm/pg-core';

export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  // Array of strings
  tags: text('tags').array(),
  // Array with default
  categories: text('categories').array().default([]),
});
```

## JSONB Patterns

```typescript
import { jsonb } from 'drizzle-orm/pg-core';

export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  // Untyped JSON
  metadata: jsonb('metadata'),

  // Typed JSON (type-only, no runtime validation)
  preferences: jsonb('preferences').$type<{
    theme: 'light' | 'dark';
    notifications: boolean;
  }>(),
});
```
