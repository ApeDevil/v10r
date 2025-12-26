# Remote Functions (Experimental)

Type-safe RPC-style server calls. Added in SvelteKit 2.27.

**Status:** Experimental - API may change without notice.

## Enable

```javascript
// svelte.config.js
export default {
  kit: {
    experimental: {
      remoteFunctions: true
    }
  }
};
```

## Define Remote Functions

Create `.remote.ts` files anywhere in `src/routes/`:

```typescript
// src/routes/api/users.remote.ts
import { query, command, form } from '$app/server';
import { db } from '$lib/server/db';

// Read operations
export const getUsers = query(async () => {
  return db.users.findMany();
});

export const getUserById = query(async (event, id: string) => {
  return db.users.findUnique({ where: { id } });
});

// Write operations (imperative)
export const createUser = command(async (event, data: { name: string; email: string }) => {
  return db.users.create({ data });
});

export const deleteUser = command(async (event, id: string) => {
  await db.users.delete({ where: { id } });
});

// Form submissions
export const submitContact = form(async (event, formData) => {
  const name = formData.get('name');
  const message = formData.get('message');
  await sendEmail({ name, message });
  return { success: true };
});
```

## Function Types

### query
For read operations. Returns data.

```typescript
export const getData = query(async (event, filter?: string) => {
  return db.items.findMany({ where: { name: { contains: filter } } });
});
```

### command
For write operations. Can accept multiple arguments.

```typescript
export const updateItem = command(async (event, id: string, updates: Partial<Item>) => {
  return db.items.update({ where: { id }, data: updates });
});
```

### form
For form submissions. Receives FormData.

```typescript
export const handleForm = form(async (event, formData) => {
  const email = formData.get('email') as string;
  // Process form
  return { success: true };
});
```

### prerender
Can run during prerendering.

```typescript
export const getStaticData = prerender(async () => {
  return fetchStaticContent();
});
```

## Call Remote Functions

```svelte
<script lang="ts">
  import { getUsers, createUser, deleteUser } from './api/users.remote';

  let users = $state<User[]>([]);
  let loading = $state(false);

  async function load() {
    loading = true;
    users = await getUsers();
    loading = false;
  }

  async function addUser() {
    const user = await createUser({ name: 'New User', email: 'new@example.com' });
    users = [...users, user];
  }

  async function removeUser(id: string) {
    await deleteUser(id);
    users = users.filter(u => u.id !== id);
  }
</script>

<button onclick={load} disabled={loading}>
  {loading ? 'Loading...' : 'Load Users'}
</button>

{#each users as user}
  <div>
    {user.name}
    <button onclick={() => removeUser(user.id)}>Delete</button>
  </div>
{/each}

<button onclick={addUser}>Add User</button>
```

## Batching (query.batch)

Solves N+1 problem by batching queries in same macrotask:

```typescript
// Definition
export const getUserById = query.batch(async (event, ids: string[]) => {
  // Called once with ALL ids from the same macrotask
  const users = await db.users.findMany({
    where: { id: { in: ids } }
  });

  // Must return array in same order as input ids
  return ids.map(id => users.find(u => u.id === id));
});
```

```svelte
<script>
  import { getUserById } from './api/users.remote';

  // These three calls get batched into ONE database query
  const user1 = await getUserById('1');
  const user2 = await getUserById('2');
  const user3 = await getUserById('3');
</script>
```

## Form Usage

```svelte
<script lang="ts">
  import { submitContact } from './api/contact.remote';
</script>

<form action={submitContact}>
  <input name="name" required />
  <textarea name="message" required></textarea>
  <button>Send</button>
</form>
```

## Event Object

All remote functions receive the event as first argument:

```typescript
export const protectedAction = command(async (event, data: SomeData) => {
  // Access request info
  const user = event.locals.user;
  if (!user) throw error(401, 'Unauthorized');

  // Access route/url (added in 2.44.0)
  console.log(event.route.id);
  console.log(event.url.pathname);

  // Access cookies
  const token = event.cookies.get('token');

  return doSomething(data, user);
});
```

## When to Use

**Use Remote Functions for:**
- Internal app logic (authenticated operations)
- Type-safe client-server communication
- Eliminating boilerplate API routes
- When you want RPC-style simplicity

**Use +server.js API Routes for:**
- Public APIs consumed by third parties
- Webhooks
- REST/GraphQL endpoints
- When you need full HTTP control

## Type Safety

Full type inference across client-server boundary:

```typescript
// users.remote.ts
export const createUser = command(async (event, data: { name: string; age: number }) => {
  return db.users.create({ data });
});
```

```svelte
<script lang="ts">
  import { createUser } from './users.remote';

  // TypeScript knows:
  // - createUser requires { name: string; age: number }
  // - Returns Promise<User>

  const user = await createUser({ name: 'Ada', age: 30 });
  //    ^? User
</script>
```

## Recent Updates

**November 2025 (2.44.0):**
- `event.route` and `event.url` now available in remote functions

**November 2025 (2.46.0):**
- Imperative form validation support

**December 2025 (2.49.0):**
- File uploads can be streamed in form remote functions
- Access file data before upload completes

## Caveats

1. **Experimental:** API may change in minor versions
2. **No external consumption:** Designed for internal use only
3. **Requires JavaScript:** Unlike form actions, no progressive enhancement
4. **Single-app scope:** Functions only work within same SvelteKit app
