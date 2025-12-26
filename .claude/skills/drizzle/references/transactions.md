# Transactions

Atomic database operations with Drizzle.

## Contents

- [Basic Transaction](#basic-transaction) - db.transaction(tx => ...)
- [When to Use Transactions](#when-to-use-transactions) - Decision table
- [Form Action with Transaction](#form-action-with-transaction) - Full example
- [Returning Values from Transactions](#returning-values-from-transactions)
- [Error Handling in Transactions](#error-handling-in-transactions)
- [Nested Operations Pattern](#nested-operations-pattern) - Create related records
- [Outbox Pattern](#outbox-pattern) - Event sourcing, async processing
- [Read-Modify-Write](#read-modify-write) - Prevent race conditions
- [Conditional Insert](#conditional-insert) - Check before create
- [Neon Serverless Considerations](#neon-serverless-considerations) - Keep transactions short

## Basic Transaction

```typescript
await db.transaction(async (tx) => {
  // All operations use tx instead of db
  const [item] = await tx.insert(schema.items).values({
    id: createId.item(),
    userId,
    title: 'New Item',
  }).returning();

  await tx.insert(schema.itemTags).values({
    itemId: item.id,
    tagId,
  });
});
// If any operation fails, all are rolled back
```

## When to Use Transactions

| Scenario | Transaction? |
|----------|--------------|
| Single insert/update | No |
| Insert + related records | **Yes** |
| Read-modify-write | **Yes** |
| Insert + outbox event | **Yes** |
| Read-only queries | No |
| Independent updates | No |

## Form Action with Transaction

```typescript
// src/routes/items/new/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';
import { db, createId, schema } from '$lib/server/db';

export const actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, valibot(itemSchema));
    if (!form.valid) return fail(400, { form });

    await db.transaction(async (tx) => {
      // 1. Create the item
      const [item] = await tx.insert(schema.items).values({
        id: createId.item(),
        userId: locals.user!.id,
        title: form.data.title,
        description: form.data.description,
      }).returning();

      // 2. Create tag associations
      if (form.data.tagIds?.length) {
        await tx.insert(schema.itemTags).values(
          form.data.tagIds.map(tagId => ({
            itemId: item.id,
            tagId,
          }))
        );
      }

      // 3. Create initial file record if uploaded
      if (form.data.imageUrl) {
        await tx.insert(schema.files).values({
          id: createId.file(),
          userId: locals.user!.id,
          itemId: item.id,
          filename: 'cover.jpg',
          storageKey: form.data.imageUrl,
          size: 0,
          mimeType: 'image/jpeg',
        });
      }
    });

    redirect(303, '/items');
  },
};
```

## Returning Values from Transactions

```typescript
const result = await db.transaction(async (tx) => {
  const [item] = await tx.insert(schema.items).values({
    id: createId.item(),
    userId,
    title: 'New Item',
  }).returning();

  const [file] = await tx.insert(schema.files).values({
    id: createId.file(),
    itemId: item.id,
    userId,
    filename: 'doc.pdf',
    storageKey: 's3://...',
    size: 1024,
    mimeType: 'application/pdf',
  }).returning();

  return { item, file };
});

console.log(result.item.id, result.file.id);
```

## Error Handling in Transactions

```typescript
import { mapDbError } from '$lib/server/db/errors';

try {
  await db.transaction(async (tx) => {
    await tx.insert(schema.items).values({ ... });
    await tx.insert(schema.itemTags).values({ ... });
  });
} catch (err) {
  // Transaction automatically rolled back
  mapDbError(err);
}
```

## Nested Operations Pattern

```typescript
await db.transaction(async (tx) => {
  // Create user
  const [user] = await tx.insert(schema.user).values({
    id: createId.user(),
    email,
    name,
  }).returning();

  // Create profile
  await tx.insert(schema.userProfile).values({
    userId: user.id,
    timezone: 'UTC',
  });

  // Create settings
  await tx.insert(schema.userSettings).values({
    userId: user.id,
    theme: 'system',
    language: 'en',
  });

  // Create initial item
  await tx.insert(schema.items).values({
    id: createId.item(),
    userId: user.id,
    title: 'Welcome!',
    status: 'draft',
  });
});
```

## Outbox Pattern

For event sourcing and async processing:

```typescript
// Schema for outbox
export const outbox = pgTable('outbox', {
  id: text('id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(),
  aggregateId: text('aggregate_id').notNull(),
  eventType: text('event_type').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  processedAt: timestamp('processed_at'),
});

// Usage in transaction
await db.transaction(async (tx) => {
  // Main operation
  const [item] = await tx.insert(schema.items).values({
    id: createId.item(),
    userId,
    title,
  }).returning();

  // Outbox event for async processing
  await tx.insert(schema.outbox).values({
    id: `obx_${nanoid(12)}`,
    aggregateType: 'item',
    aggregateId: item.id,
    eventType: 'item.created',
    payload: {
      itemId: item.id,
      userId,
      title,
    },
  });
});
// Later: Worker polls outbox and syncs to Neo4j
```

## Read-Modify-Write

Prevent race conditions:

```typescript
await db.transaction(async (tx) => {
  // Read current value
  const [item] = await tx.select()
    .from(schema.items)
    .where(eq(schema.items.id, itemId))
    .for('update'); // Lock row

  if (!item) throw new Error('Item not found');

  // Modify and write
  await tx.update(schema.items)
    .set({ viewCount: item.viewCount + 1 })
    .where(eq(schema.items.id, itemId));
});
```

## Conditional Insert

```typescript
await db.transaction(async (tx) => {
  // Check if exists
  const existing = await tx.query.items.findFirst({
    where: and(
      eq(items.userId, userId),
      eq(items.title, title),
    ),
  });

  if (existing) {
    throw new Error('Item with this title already exists');
  }

  // Create if not exists
  await tx.insert(schema.items).values({
    id: createId.item(),
    userId,
    title,
  });
});
```

## Neon Serverless Considerations

Neon's serverless driver handles transactions, but keep in mind:

1. **Connection pooling** - Transactions hold a connection
2. **Timeout** - Long transactions can timeout
3. **Keep transactions short** - Do computation outside, only DB ops inside

```typescript
// Good: Prepare data outside transaction
const itemId = createId.item();
const tagAssociations = tagIds.map(tagId => ({ itemId, tagId }));

await db.transaction(async (tx) => {
  await tx.insert(schema.items).values({ id: itemId, ... });
  await tx.insert(schema.itemTags).values(tagAssociations);
});

// Bad: Heavy computation inside transaction
await db.transaction(async (tx) => {
  const processedData = await heavyComputation(); // Don't do this
  await tx.insert(schema.items).values(processedData);
});
```

## Savepoints (Not Available)

Drizzle doesn't currently support savepoints (partial rollbacks within a transaction). Structure your logic to avoid needing them.
