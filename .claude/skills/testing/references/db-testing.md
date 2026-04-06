# Database Testing

Patterns for testing Drizzle ORM queries against real PostgreSQL — no mocks.

## PGlite (In-Process PostgreSQL)

PGlite runs full PostgreSQL in-process via WASM. Already in devDependencies (`@electric-sql/pglite`). Zero network, millisecond startup.

### Setup Pattern

```typescript
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '$lib/server/db/schema';

let client: PGlite;
let db: ReturnType<typeof drizzle>;

beforeEach(async () => {
  client = new PGlite();
  db = drizzle(client, { schema });

  // Option A: Raw SQL from your migration files
  await client.exec(migrationSQL);

  // Option B: Drizzle push (applies schema directly)
  // Requires drizzle-kit programmatic API
});

afterEach(async () => {
  await client.close();
});
```

### Testing Query Logic

```typescript
describe('user queries', () => {
  it('finds user by email', async () => {
    await db.insert(schema.users).values({
      id: 'u1',
      email: 'test@example.com',
      name: 'Test User',
    });

    const user = await db.query.users.findFirst({
      where: eq(schema.users.email, 'test@example.com'),
    });

    expect(user).toBeDefined();
    expect(user!.name).toBe('Test User');
  });

  it('enforces unique email constraint', async () => {
    await db.insert(schema.users).values({
      id: 'u1',
      email: 'dupe@example.com',
      name: 'First',
    });

    await expect(
      db.insert(schema.users).values({
        id: 'u2',
        email: 'dupe@example.com',
        name: 'Second',
      })
    ).rejects.toThrow();
  });
});
```

### Testing Transactions

```typescript
it('rolls back on error', async () => {
  await expect(
    db.transaction(async (tx) => {
      await tx.insert(schema.items).values({ id: '1', name: 'Test' });
      throw new Error('Simulated failure');
    })
  ).rejects.toThrow('Simulated failure');

  const items = await db.select().from(schema.items);
  expect(items).toHaveLength(0); // Rolled back
});
```

### PGlite Limitations

- No Neon serverless driver semantics (connection pooling, branching)
- Some PostgreSQL extensions may not be available
- No concurrent connection testing (single-process)
- Performance characteristics differ from real PostgreSQL

Use PGlite for: query logic, constraint testing, transaction behavior.
Use Neon branches for: integration tests that need real PostgreSQL behavior.

## Neon Branching

Neon branches are copy-on-write — O(1) creation regardless of DB size.

### Per-Test-Run Branch

```typescript
// scripts/test-branch.ts
const response = await fetch(
  `https://console.neon.tech/api/v2/projects/${projectId}/branches`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${NEON_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: {
        parent_id: mainBranchId,
        name: `test-${Date.now()}`,
      },
      endpoints: [{ type: 'read_write' }],
    }),
  }
);
```

### Cleanup

Always delete test branches after use. Set auto-deletion as a safety net:

```typescript
afterAll(async () => {
  await fetch(
    `https://console.neon.tech/api/v2/projects/${projectId}/branches/${branchId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${NEON_API_KEY}` } }
  );
});
```

### Cost Considerations

- Branch creation/deletion: Neon API calls (rate-limited)
- Storage: copy-on-write, minimal overhead
- Compute: each branch with an endpoint incurs compute seconds
- Watch mode: avoid creating branches on every file save — use PGlite for that

## Transaction Rollback Isolation

For tests sharing a single database connection:

```typescript
let tx: Transaction;

beforeEach(async () => {
  tx = await db.transaction();
});

afterEach(async () => {
  await tx.rollback();
});
```

**Limitation**: Requires the WebSocket driver, not HTTP. Neon's HTTP driver is stateless — transactions don't persist across requests.

## Error Sanitization Testing

Critical: database error messages must never leak schema internals to users.

```typescript
import { safeDbMessage } from '$lib/server/db/errors';

describe('safeDbMessage', () => {
  it('sanitizes unique constraint violations', () => {
    const raw = 'duplicate key value violates unique constraint "users_email_unique"';
    const safe = safeDbMessage(raw);
    expect(safe).not.toContain('users_email_unique');
    expect(safe).not.toContain('duplicate key');
  });

  it('sanitizes table references', () => {
    const raw = 'insert or update on table "auth.sessions" violates foreign key';
    const safe = safeDbMessage(raw);
    expect(safe).not.toContain('auth.sessions');
  });

  it('returns generic message for unknown errors', () => {
    const safe = safeDbMessage('something unexpected');
    expect(safe).toBeTruthy();
    expect(safe.length).toBeLessThan(100);
  });
});
```
