# Type Inference

TypeScript patterns for Drizzle with full type safety.

## Basic Type Inference

```typescript
// src/lib/server/db/types.ts
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { items, tags, files } from './schema';

// Select types (for reading)
export type Item = InferSelectModel<typeof items>;
export type Tag = InferSelectModel<typeof tags>;
export type File = InferSelectModel<typeof files>;

// Insert types (for creating)
export type NewItem = InferInsertModel<typeof items>;
export type NewTag = InferInsertModel<typeof tags>;
export type NewFile = InferInsertModel<typeof files>;
```

## The Relations Problem

**InferSelectModel does NOT include relations.**

```typescript
// This type does NOT include tags
type Item = InferSelectModel<typeof items>;

// This will fail:
const item: Item = {
  id: 'itm_xxx',
  tags: [], // Error: 'tags' does not exist on type 'Item'
};
```

## Solutions for Relation Types

### Manual Composite Types

```typescript
// Define composite types manually
export type ItemWithTags = Item & {
  itemTags: Array<{
    itemId: string;
    tagId: string;
    tag: Tag;
  }>;
};

export type ItemWithUser = Item & {
  user: User;
};

export type ItemFull = Item & {
  user: User;
  itemTags: Array<{ tag: Tag }>;
  files: File[];
};
```

### Infer from Query Function (Recommended)

```typescript
// src/lib/server/db/queries/items.ts

// Define query function
export async function getItemsWithTags(userId: string) {
  return db.query.items.findMany({
    where: eq(items.userId, userId),
    with: {
      itemTags: {
        with: { tag: true }
      }
    }
  });
}

// Infer type from the function
export type ItemsWithTags = Awaited<ReturnType<typeof getItemsWithTags>>;

// Single item version
export async function getItemWithTags(itemId: string) {
  return db.query.items.findFirst({
    where: eq(items.id, itemId),
    with: {
      itemTags: { with: { tag: true } },
      user: true,
    }
  });
}

export type ItemWithTagsAndUser = NonNullable<
  Awaited<ReturnType<typeof getItemWithTags>>
>;
```

## Type Flow: DB → Load → Component

### Query Function

```typescript
// src/lib/server/db/queries/items.ts
export async function getItemsForUser(userId: string) {
  return db.query.items.findMany({
    where: eq(items.userId, userId),
    with: { itemTags: { with: { tag: true } } },
    orderBy: [desc(items.createdAt)],
  });
}

export type UserItems = Awaited<ReturnType<typeof getItemsForUser>>;
```

### Load Function

```typescript
// src/routes/app/items/+page.server.ts
import { getItemsForUser } from '$lib/server/db/queries/items';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const items = await getItemsForUser(locals.user!.id);
  return { items }; // Fully typed
};
```

### Component

```typescript
<!-- src/routes/app/items/+page.svelte -->
<script lang="ts">
  let { data } = $props();

  // data.items is fully typed including nested relations
  const items = $derived(data.items);
</script>

{#each items as item}
  <h2>{item.title}</h2>
  {#each item.itemTags as { tag }}
    <span>{tag.name}</span>
  {/each}
{/each}
```

## Partial Types

```typescript
// Pick specific fields
type ItemPreview = Pick<Item, 'id' | 'title' | 'status'>;

// Omit fields
type ItemWithoutContent = Omit<Item, 'content'>;

// Make fields optional
type ItemUpdate = Partial<Omit<Item, 'id' | 'createdAt'>>;
```

## Enum Types

```typescript
// Extract enum values as type
import { itemStatusEnum } from './schema/items';

// Get the enum type
type ItemStatus = typeof itemStatusEnum.enumValues[number];
// Result: 'draft' | 'published' | 'archived'

// Use in other types
interface ItemFilter {
  status?: ItemStatus;
  userId: string;
}
```

## Helper Types

```typescript
// src/lib/server/db/types.ts

// For query results that might be null
export type MaybeItem = Item | null | undefined;

// For arrays
export type Items = Item[];

// With pagination metadata
export interface PaginatedItems {
  items: Item[];
  total: number;
  page: number;
  pageSize: number;
}

// For form actions
export interface ItemCreateInput {
  title: string;
  description?: string;
  tagIds?: string[];
}
```

## $types Imports

SvelteKit generates types in `$types`:

```typescript
// +page.server.ts
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return { user: locals.user };
};

export const actions: Actions = {
  default: async ({ request }) => { ... }
};
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  // or just: let { data } = $props(); (inferred)
</script>
```

## Branded Types (Advanced)

For type safety on IDs:

```typescript
// Branded type helper
type Brand<T, B> = T & { __brand: B };

// Branded ID types
export type UserId = Brand<string, 'UserId'>;
export type ItemId = Brand<string, 'ItemId'>;
export type TagId = Brand<string, 'TagId'>;

// Type-safe ID generators
export const createId = {
  user: () => `usr_${nanoid(12)}` as UserId,
  item: () => `itm_${nanoid(12)}` as ItemId,
  tag: () => `tag_${nanoid(8)}` as TagId,
};

// Now TypeScript prevents mixing IDs
function getItem(id: ItemId) { ... }
function getUser(id: UserId) { ... }

getItem(createId.item()); // OK
getItem(createId.user()); // Error: UserId not assignable to ItemId
```

## Return Type Patterns

```typescript
// Guaranteed non-null (throws if not found)
export async function getItemOrFail(itemId: string): Promise<Item> {
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });
  if (!item) throw error(404, 'Item not found');
  return item;
}

// Nullable return
export async function findItem(itemId: string): Promise<Item | null> {
  const item = await db.query.items.findFirst({
    where: eq(items.id, itemId),
  });
  return item ?? null;
}

// Array (never null, may be empty)
export async function listItems(userId: string): Promise<Item[]> {
  return db.query.items.findMany({
    where: eq(items.userId, userId),
  });
}
```

## Type Guards

```typescript
// Check if item has loaded relations
function hasUser(item: Item | ItemWithUser): item is ItemWithUser {
  return 'user' in item && item.user !== undefined;
}

// Usage
const item = await getItem(id);
if (hasUser(item)) {
  console.log(item.user.name); // TypeScript knows user exists
}
```
