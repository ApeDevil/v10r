# Relations

Drizzle relations for the relational query API.

## Contents

- [Key Concepts](#key-concepts) - Relations ≠ foreign keys, bidirectional
- [Relation Types](#relation-types) - one, many
- [One-to-One](#one-to-one) - Owner and inverse sides
- [One-to-Many](#one-to-many) - User has many items
- [Many-to-Many](#many-to-many) - Junction tables, querying, flattening results
- [Self-Referencing Relations](#self-referencing-relations) - Parent/children
- [Named Relations](#named-relations) - Multiple relations between same tables
- [Relation File Organization](#relation-file-organization) - Grouping by table
- [Including Relations in DB Client](#including-relations-in-db-client) - drizzle() config
- [Querying with Relations](#querying-with-relations) - with: { nested }

## Key Concepts

1. **Drizzle relations ≠ SQL foreign keys** - Relations are for `db.query` API, foreign keys are for SQL constraints
2. **Relations are bidirectional** - Define on both sides for full navigation
3. **Relations live in separate file** - Keep `relations.ts` apart from schema files
4. **Must be included in db client** - Pass to drizzle() for db.query to work

## Relation Types

```typescript
import { relations } from 'drizzle-orm';

// One-to-One
export const userRelations = relations(user, ({ one }) => ({
  profile: one(userProfile, {
    fields: [user.id],
    references: [userProfile.userId]
  }),
}));

// One-to-Many
export const userRelations = relations(user, ({ many }) => ({
  items: many(items),
}));

// Many-to-One (inverse of one-to-many)
export const itemsRelations = relations(items, ({ one }) => ({
  user: one(user, {
    fields: [items.userId],
    references: [user.id]
  }),
}));
```

## One-to-One

Owner side defines the foreign key field:

```typescript
// User owns profile (profile has userId foreign key)
export const userRelations = relations(user, ({ one }) => ({
  profile: one(userProfile, {
    fields: [user.id],
    references: [userProfile.userId]
  }),
}));

// Inverse side
export const userProfileRelations = relations(userProfile, ({ one }) => ({
  user: one(user, {
    fields: [userProfile.userId],
    references: [user.id]
  }),
}));
```

## One-to-Many

```typescript
// User has many items
export const userRelations = relations(user, ({ many }) => ({
  items: many(items),
}));

// Item belongs to user
export const itemsRelations = relations(items, ({ one }) => ({
  user: one(user, {
    fields: [items.userId],
    references: [user.id]
  }),
}));
```

## Many-to-Many

Requires a junction table:

```typescript
// Schema
export const items = pgTable('items', { ... });
export const tags = pgTable('tags', { ... });
export const itemTags = pgTable('item_tags', {
  itemId: text('item_id').notNull().references(() => items.id),
  tagId: text('tag_id').notNull().references(() => tags.id),
}, (t) => ({ pk: primaryKey({ columns: [t.itemId, t.tagId] }) }));

// Relations
export const itemsRelations = relations(items, ({ many }) => ({
  itemTags: many(itemTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  itemTags: many(itemTags),
}));

export const itemTagsRelations = relations(itemTags, ({ one }) => ({
  item: one(items, {
    fields: [itemTags.itemId],
    references: [items.id]
  }),
  tag: one(tags, {
    fields: [itemTags.tagId],
    references: [tags.id]
  }),
}));
```

### Querying Many-to-Many

```typescript
// Get items with their tags
const itemsWithTags = await db.query.items.findMany({
  with: {
    itemTags: {
      with: { tag: true }
    }
  }
});

// Result structure:
// {
//   id: 'itm_xxx',
//   title: 'Item',
//   itemTags: [
//     { itemId: 'itm_xxx', tagId: 'tag_xxx', tag: { id: 'tag_xxx', name: 'Tag' } }
//   ]
// }
```

### Flattening Many-to-Many Results

```typescript
// Transform to simpler structure
const items = await db.query.items.findMany({
  with: { itemTags: { with: { tag: true } } }
});

const transformed = items.map(item => ({
  ...item,
  tags: item.itemTags.map(it => it.tag),
}));

// Result:
// { id: 'itm_xxx', title: 'Item', tags: [{ id: 'tag_xxx', name: 'Tag' }] }
```

## Self-Referencing Relations

```typescript
// Categories with parent/children
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id'),
});

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: 'parent_child',
  }),
  children: many(categories, { relationName: 'parent_child' }),
}));
```

## Named Relations

Use `relationName` when you have multiple relations between same tables:

```typescript
export const users = pgTable('users', { ... });
export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  senderId: text('sender_id').notNull(),
  receiverId: text('receiver_id').notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sentMessages: many(messages, { relationName: 'sender' }),
  receivedMessages: many(messages, { relationName: 'receiver' }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: 'sender',
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: 'receiver',
  }),
}));
```

## Relation File Organization

```typescript
// src/lib/server/db/relations.ts
import { relations } from 'drizzle-orm';
import { user, session, account } from './schema/_better-auth';
import { userProfile } from './schema/auth';
import { userSettings } from './schema/settings';
import { items, tags, itemTags } from './schema/items';
import { files } from './schema/files';

// Group by table
export const userRelations = relations(user, ({ one, many }) => ({
  profile: one(userProfile, {
    fields: [user.id],
    references: [userProfile.userId]
  }),
  settings: one(userSettings, {
    fields: [user.id],
    references: [userSettings.userId]
  }),
  sessions: many(session),
  accounts: many(account),
  items: many(items),
  files: many(files),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id]
  }),
}));

// ... continue for all tables
```

## Including Relations in DB Client

```typescript
// src/lib/server/db/index.ts
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import * as relations from './relations';

export const db = drizzle(sql, {
  // BOTH schema AND relations required
  schema: { ...schema, ...relations }
});
```

## Querying with Relations

```typescript
// Include single relation
await db.query.items.findMany({
  with: { user: true }
});

// Include nested relations
await db.query.items.findMany({
  with: {
    user: true,
    itemTags: {
      with: { tag: true }
    }
  }
});

// Filter within relation
await db.query.user.findFirst({
  where: eq(user.id, userId),
  with: {
    items: {
      where: eq(items.status, 'published'),
      orderBy: [desc(items.createdAt)],
      limit: 5,
    }
  }
});

// Select specific columns from relation
await db.query.items.findMany({
  columns: { id: true, title: true },
  with: {
    user: {
      columns: { id: true, name: true }
    }
  }
});
```
