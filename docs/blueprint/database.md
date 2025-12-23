# Database Schema

PostgreSQL schema for Velociraptor template using Drizzle ORM.

## Overview

| Table | Purpose | Used By |
|-------|---------|---------|
| `users` | User accounts | Auth, all features |
| `sessions` | Auth sessions | Session management |
| `oauth_accounts` | OAuth provider links | OAuth login |
| `user_settings` | Preferences | Theme, i18n |
| `items` | Generic entities | CRUD showcase |
| `tags` | Categorization | Data showcase |
| `item_tags` | Item-tag relations | Data showcase |
| `files` | Upload references | Files showcase |
| `password_reset_tokens` | Password recovery | Auth |
| `email_verification_tokens` | Email verification | Auth |

---

## Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │    sessions     │
├─────────────────┤       ├─────────────────┤
│ id visually: PK │◀──────│ user_id FK      │
│ email           │       │ id PK           │
│ password_hash   │       │ expires_at      │
│ name            │       └─────────────────┘
│ avatar_url      │
│ email_verified  │       ┌─────────────────┐
│ created_at      │◀──────│ user_settings   │
│ updated_at      │       ├─────────────────┤
└────────┬────────┘       │ user_id PK/FK   │
         │                │ theme           │
         │                │ language        │
         │                │ notifications   │
         │                └─────────────────┘
         │
         │  ┌─────────────────┐
         │  │     items       │
         │  ├─────────────────┤
         └─▶│ user_id FK      │
            │ id PK           │◀─┐
            │ title           │  │
            │ description     │  │     ┌─────────────────┐
            │ content         │  │     │   item_tags     │
            │ status          │  │     ├─────────────────┤
            │ image_url       │  └─────│ item_id FK      │
            │ created_at      │        │ tag_id FK       │──┐
            │ updated_at      │        └─────────────────┘  │
            └────────┬────────┘                             │
                     │                 ┌─────────────────┐  │
                     │                 │      tags       │  │
                     │                 ├─────────────────┤  │
                     │                 │ id PK           │◀─┘
                     │                 │ name            │
                     │                 │ color           │
                     │                 │ created_at      │
                     │                 └─────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │     files       │
            ├─────────────────┤
            │ id PK           │
            │ user_id FK      │
            │ item_id FK?     │
            │ filename        │
            │ storage_key     │
            │ url             │
            │ size            │
            │ mime_type       │
            │ created_at      │
            └─────────────────┘
```

---

## Drizzle Schema

### Users & Auth

```ts
// src/lib/server/db/schema/auth.ts
import { pgTable, text, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(), // 'usr_' + nanoid
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  avatarUrl: text('avatar_url'),
  emailVerified: boolean('email_verified').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull()
});

export const oauthAccounts = pgTable('oauth_accounts', {
  providerId: text('provider_id').notNull(), // 'github', 'google'
  providerUserId: text('provider_user_id').notNull(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.providerId, table.providerUserId] }),
}));

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true })
});

export const emailVerificationTokens = pgTable('email_verification_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true })
});
```

### User Settings

```ts
// src/lib/server/db/schema/settings.ts
import { pgTable, text, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);

export const userSettings = pgTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  theme: themeEnum('theme').notNull().default('system'),
  language: text('language').notNull().default('en'),
  notificationsEnabled: boolean('notifications_enabled').notNull().default(true)
});
```

### Items & Tags

```ts
// src/lib/server/db/schema/items.ts
import { pgTable, text, timestamp, pgEnum, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './auth';

export const itemStatusEnum = pgEnum('item_status', ['draft', 'published', 'archived']);

export const items = pgTable('items', {
  id: text('id').primaryKey(), // 'itm_' + nanoid
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  content: text('content'),
  status: itemStatusEnum('status').notNull().default('draft'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const tags = pgTable('tags', {
  id: text('id').primaryKey(), // 'tag_' + nanoid
  name: text('name').notNull().unique(),
  color: text('color').notNull().default('#6b7280'), // gray-500
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

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

### Files

```ts
// src/lib/server/db/schema/files.ts
import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { users } from './auth';
import { items } from './items';

export const files = pgTable('files', {
  id: text('id').primaryKey(), // 'fil_' + nanoid
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  itemId: text('item_id').references(() => items.id, { onDelete: 'set null' }),
  filename: text('filename').notNull(),
  storageKey: text('storage_key').notNull(), // R2 object key
  url: text('url'), // Public URL if public, null if private
  size: integer('size').notNull(), // bytes
  mimeType: text('mime_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});
```

### Schema Index

```ts
// src/lib/server/db/schema/index.ts
export * from './auth';
export * from './settings';
export * from './items';
export * from './files';
```

---

## Indexes

```ts
// Add to respective schema files
import { index } from 'drizzle-orm/pg-core';

// users - email lookup
export const usersEmailIdx = index('users_email_idx').on(users.email);

// sessions - user lookup, expiry cleanup
export const sessionsUserIdx = index('sessions_user_id_idx').on(sessions.userId);
export const sessionsExpiresIdx = index('sessions_expires_at_idx').on(sessions.expiresAt);

// items - user's items, status filter, recent first
export const itemsUserIdx = index('items_user_id_idx').on(items.userId);
export const itemsStatusIdx = index('items_status_idx').on(items.status);
export const itemsCreatedIdx = index('items_created_at_idx').on(items.createdAt);

// files - user's files, item attachments
export const filesUserIdx = index('files_user_id_idx').on(files.userId);
export const filesItemIdx = index('files_item_id_idx').on(files.itemId);

// tokens - cleanup expired
export const passwordResetExpiresIdx = index('password_reset_expires_idx')
  .on(passwordResetTokens.expiresAt);
export const emailVerificationExpiresIdx = index('email_verification_expires_idx')
  .on(emailVerificationTokens.expiresAt);
```

---

## ID Generation

Prefixed IDs for debugging clarity:

```ts
// src/lib/server/db/id.ts
import { nanoid } from 'nanoid';

export const createId = {
  user: () => `usr_${nanoid(12)}`,
  session: () => `ses_${nanoid(24)}`,
  item: () => `itm_${nanoid(12)}`,
  tag: () => `tag_${nanoid(8)}`,
  file: () => `fil_${nanoid(12)}`,
  token: () => nanoid(32)
};

// Usage:
// const user = { id: createId.user(), ... }
// Results in: 'usr_V1StGXR8_Z5j'
```

---

## Relations (Drizzle)

```ts
// src/lib/server/db/relations.ts
import { relations } from 'drizzle-orm';
import { users, sessions, userSettings } from './schema/auth';
import { items, tags, itemTags } from './schema/items';
import { files } from './schema/files';

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(userSettings, {
    fields: [users.id],
    references: [userSettings.userId]
  }),
  sessions: many(sessions),
  items: many(items),
  files: many(files)
}));

export const itemsRelations = relations(items, ({ one, many }) => ({
  user: one(users, {
    fields: [items.userId],
    references: [users.id]
  }),
  files: many(files),
  itemTags: many(itemTags)
}));

export const tagsRelations = relations(tags, ({ many }) => ({
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

export const filesRelations = relations(files, ({ one }) => ({
  user: one(users, {
    fields: [files.userId],
    references: [users.id]
  }),
  item: one(items, {
    fields: [files.itemId],
    references: [items.id]
  })
}));
```

---

## Type Inference

```ts
// src/lib/server/db/types.ts
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { users, sessions, oauthAccounts, userSettings, items, tags, files } from './schema';

// Select types (reading from DB)
export type User = InferSelectModel<typeof users>;
export type Session = InferSelectModel<typeof sessions>;
export type OAuthAccount = InferSelectModel<typeof oauthAccounts>;
export type UserSettings = InferSelectModel<typeof userSettings>;
export type Item = InferSelectModel<typeof items>;
export type Tag = InferSelectModel<typeof tags>;
export type File = InferSelectModel<typeof files>;

// Insert types (writing to DB)
export type NewUser = InferInsertModel<typeof users>;
export type NewItem = InferInsertModel<typeof items>;
export type NewTag = InferInsertModel<typeof tags>;
export type NewFile = InferInsertModel<typeof files>;

// Composite types for queries with joins
export type ItemWithTags = Item & { tags: Tag[] };
export type ItemWithFiles = Item & { files: File[] };
export type ItemFull = Item & { tags: Tag[]; files: File[]; user: User };
```

---

## Database Client

```ts
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
import * as relations from './relations';

const sql = neon(process.env.DATABASE_URL!);

export const db = drizzle(sql, {
  schema: { ...schema, ...relations }
});

export { schema };
export * from './types';
export * from './id';
```

---

## Neo4j Graph Model

Separate from Postgres. Used for relationships and graph traversal.

### Node Types

```cypher
// Page nodes (template documentation)
(:Page {
  id: string,
  path: string,      // '/showcase/theme'
  title: string,
  category: string   // 'showcase' | 'app' | 'auth' | 'docs'
})

// Feature nodes (stack components)
(:Feature {
  id: string,
  name: string,      // 'Lucia', 'Drizzle', 'UnoCSS'
  category: string   // 'auth' | 'database' | 'styling' | 'validation'
})

// Concept nodes (for future RAG)
(:Concept {
  id: string,
  name: string,
  description: string
})
```

### Relationship Types

```cypher
// Page relationships
(:Page)-[:USES]->(:Feature)           // Page uses this stack feature
(:Page)-[:RELATES_TO]->(:Page)        // Related pages
(:Page)-[:REQUIRES]->(:Page)          // Must understand this first

// Feature relationships
(:Feature)-[:DEPENDS_ON]->(:Feature)  // Feature dependency
(:Feature)-[:IMPLEMENTS]->(:Concept)  // Feature implements concept

// Navigation
(:Page)-[:NEXT]->(:Page)              // Suggested reading order
```

### Example Data

```cypher
// Create pages
CREATE (:Page {id: 'pg_theme', path: '/showcase/theme', title: 'Theme', category: 'showcase'})
CREATE (:Page {id: 'pg_ui', path: '/showcase/ui', title: 'UI Components', category: 'showcase'})
CREATE (:Page {id: 'pg_forms', path: '/showcase/forms', title: 'Forms', category: 'showcase'})

// Create features
CREATE (:Feature {id: 'ft_unocss', name: 'UnoCSS', category: 'styling'})
CREATE (:Feature {id: 'ft_bitsui', name: 'Bits UI', category: 'components'})
CREATE (:Feature {id: 'ft_superforms', name: 'Superforms', category: 'forms'})
CREATE (:Feature {id: 'ft_valibot', name: 'Valibot', category: 'validation'})

// Create relationships
MATCH (p:Page {id: 'pg_theme'}), (f:Feature {id: 'ft_unocss'})
CREATE (p)-[:USES]->(f)

MATCH (p:Page {id: 'pg_ui'}), (f:Feature {id: 'ft_bitsui'})
CREATE (p)-[:USES]->(f)

MATCH (p:Page {id: 'pg_forms'}), (f1:Feature {id: 'ft_superforms'}), (f2:Feature {id: 'ft_valibot'})
CREATE (p)-[:USES]->(f1), (p)-[:USES]->(f2)

MATCH (f1:Feature {id: 'ft_superforms'}), (f2:Feature {id: 'ft_valibot'})
CREATE (f1)-[:DEPENDS_ON]->(f2)

// Page reading order
MATCH (p1:Page {id: 'pg_theme'}), (p2:Page {id: 'pg_ui'})
CREATE (p1)-[:NEXT]->(p2)
```

### Query Examples

```cypher
// What features does a page use?
MATCH (p:Page {path: '/showcase/forms'})-[:USES]->(f:Feature)
RETURN f.name

// What pages use a feature?
MATCH (p:Page)-[:USES]->(f:Feature {name: 'Valibot'})
RETURN p.path, p.title

// Feature dependency tree
MATCH path = (f:Feature {name: 'Superforms'})-[:DEPENDS_ON*]->(dep:Feature)
RETURN path

// Suggested reading path
MATCH path = (start:Page {path: '/showcase/theme'})-[:NEXT*1..5]->(end:Page)
RETURN [node IN nodes(path) | node.title] AS readingOrder
```

---

## Migration Strategy

### Initial Setup

```bash
# Generate migration from schema
bunx drizzle-kit generate

# Apply migration
bunx drizzle-kit migrate

# Or push directly (dev only)
bunx drizzle-kit push
```

### Drizzle Config

```ts
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  }
});
```

---

## Seed Data

```ts
// scripts/seed.ts
import { db, createId, schema } from '$lib/server/db';

async function seed() {
  // Create test user
  const userId = createId.user();
  await db.insert(schema.users).values({
    id: userId,
    email: 'demo@example.com',
    name: 'Demo User',
    emailVerified: true
  });

  // Create user settings
  await db.insert(schema.userSettings).values({
    userId,
    theme: 'system',
    language: 'en'
  });

  // Create tags
  const tags = [
    { id: createId.tag(), name: 'Important', color: '#ef4444' },
    { id: createId.tag(), name: 'Work', color: '#3b82f6' },
    { id: createId.tag(), name: 'Personal', color: '#22c55e' }
  ];
  await db.insert(schema.tags).values(tags);

  // Create items
  const items = [
    {
      id: createId.item(),
      userId,
      title: 'First Item',
      description: 'This is a sample item for testing.',
      status: 'published' as const
    },
    {
      id: createId.item(),
      userId,
      title: 'Draft Item',
      description: 'This item is still a draft.',
      status: 'draft' as const
    }
  ];
  await db.insert(schema.items).values(items);

  // Link items to tags
  await db.insert(schema.itemTags).values([
    { itemId: items[0].id, tagId: tags[0].id },
    { itemId: items[0].id, tagId: tags[1].id },
    { itemId: items[1].id, tagId: tags[2].id }
  ]);

  console.log('Seed complete');
}

seed();
```

---

## File Structure

```
src/lib/server/db/
├── index.ts              # DB client export
├── id.ts                 # ID generation
├── types.ts              # Type inference
├── relations.ts          # Drizzle relations
└── schema/
    ├── index.ts          # Re-exports
    ├── auth.ts           # users, sessions, tokens
    ├── settings.ts       # user_settings
    ├── items.ts          # items, tags, item_tags
    └── files.ts          # files

drizzle/
├── 0000_initial.sql      # Generated migration
└── meta/                 # Migration metadata

scripts/
└── seed.ts               # Seed data
```

---

## Summary

| Database | Tables | Purpose |
|----------|--------|---------|
| **Postgres** | 10 | Users, auth, OAuth, content, files |
| **Neo4j** | 3 node types | Relationships, navigation, RAG |

| Table | Records Expected |
|-------|------------------|
| users | 1-1000 (template scale) |
| items | 10-10000 |
| tags | 10-100 |
| files | 100-10000 |

Schema is intentionally minimal but complete enough to demonstrate all CRUD patterns, relationships, and file handling.

---

## Related

- [auth.md](./auth.md) - Session management, OAuth implementation using these tables
- [api.md](./api.md) - REST endpoints that query this schema
- [pages.md](./pages.md) - Routes that demonstrate CRUD operations
