---
name: db-relational
description: Relational database patterns for Velociraptor. Use when designing schemas, writing queries, optimizing performance, or managing migrations. Covers PostgreSQL, Neon serverless, normalization, indexing, RLS, and N+1 prevention. Essential for any database schema or query work.
---

# Relational Database Patterns

Vendor-agnostic relational database patterns. Currently implemented with PostgreSQL (Neon serverless).

## Contents

- [Data Modeling](#data-modeling) - Normalization, denormalization, JSONB
- [Index Strategy](#index-strategy) - B-tree, GIN, partial indexes
- [Query Patterns](#query-patterns) - CTEs, window functions, N+1 prevention
- [Row-Level Security](#row-level-security) - See references/rls.md
- [Performance](#performance) - EXPLAIN, optimization, batch operations
- [Security](#security) - Injection, encryption, least privilege
- [Transactions](#transactions) - See references/transactions.md
- [Migrations](#migrations) - Strategy, versioning
- [Anti-Patterns](#anti-patterns) - Common mistakes
- [References](#references) - Vendor-specific details

## Data Modeling

### Normalization (Default Choice)

Normalize to **Third Normal Form (3NF)** by default:

1. **1NF**: Atomic values, no repeating groups
2. **2NF**: No partial dependencies on composite keys
3. **3NF**: No transitive dependencies between non-key attributes

**Stop at 3NF when:**
- Schema is stable
- Join performance is acceptable
- No multi-valued dependencies

### When to Denormalize

| Scenario | Action |
|----------|--------|
| Read-heavy, rarely updated | Consider denormalization |
| Reporting/analytics | Materialized views |
| Performance bottleneck on joins | Selective denormalization |
| Real-time requirements | Pre-computed aggregates |

**Rule:** Denormalize AFTER achieving satisfactory normalization. Many systems use hybrid models.

### JSONB vs Normalized Tables

| Use JSONB | Use Normalized Tables |
|-----------|----------------------|
| Flexible/unknown schema | Fixed, well-defined schema |
| Config objects, metadata | Frequently queried fields |
| Audit trails (store as-is) | Need joins across fields |
| Rarely queried internals | Statistics/query planning |

**Critical: TOAST Performance Cliff**
- PostgreSQL compresses JSONB > 2KB (TOAST)
- Performance degrades 2-10× for large documents
- Keep JSONB values under 2KB when possible

```typescript
// Good: Small, focused JSONB
settings: jsonb('settings').$type<{
  theme: 'light' | 'dark';
  notifications: boolean;
}>()

// Bad: Large JSONB that should be normalized
content: jsonb('content').$type<{
  title: string;
  body: string;      // Could be 10KB+
  comments: Array<>; // Should be separate table
}>()
```

### Foreign Keys and Referential Integrity

**ON DELETE options:**

| Option | Behavior | Use When |
|--------|----------|----------|
| `RESTRICT` | Prevent deletion | Critical relationships |
| `CASCADE` | Delete related rows | Clearly dependent data |
| `SET NULL` | Set FK to NULL | Optional relationships |
| `NO ACTION INITIALLY DEFERRED` | Check at transaction end | Complex cascades |

**Critical:** Always index foreign key columns. Missing FK indexes make cascading deletes extremely slow.

```typescript
// Schema with indexed FK
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
}, (table) => ({
  userIdIdx: index('posts_user_id_idx').on(table.userId), // Index the FK!
}));
```

## Index Strategy

### The Golden Rule

> Indexes speed up reads but slow down writes. Index what you query, not everything.

### Index Types

| Type | Use For | Example |
|------|---------|---------|
| **B-tree** (default) | Equality, range, sorting | `WHERE email = ?`, `ORDER BY created_at` |
| **GIN** | Arrays, JSONB, full-text | `WHERE tags @> ARRAY['svelte']` |
| **GiST** | Spatial, range types | `WHERE location <@ box` |
| **Hash** | Equality only (rare) | `WHERE id = ?` (B-tree usually better) |

### What to Index

1. **Primary keys** - Automatic
2. **Foreign keys** - ALWAYS (manual in Postgres)
3. **WHERE clause columns** - Frequently filtered
4. **JOIN columns** - Used in joins
5. **ORDER BY columns** - Avoid sorts

### What NOT to Index

- Low-cardinality columns (boolean, status with few values)
- Rarely queried columns
- Frequently updated columns (high write cost)
- Small tables (seq scan is fine)

### Partial Indexes

Index only rows matching a condition. Dramatically smaller and faster.

```typescript
// Only index pending orders (5% of table)
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  status: text('status').notNull(),
  customerId: integer('customer_id').notNull(),
}, (table) => ({
  // Full index: 1984KB
  // Partial index: 16KB
  pendingIdx: index('orders_pending_idx')
    .on(table.customerId)
    .where(sql`status = 'pending'`),
}));
```

**Use when:** 5-30% of rows are frequently queried.

### Composite Indexes

```typescript
// Order matters! Left-to-right prefix matching
tenantStatusIdx: index('tenant_status_idx')
  .on(table.tenantId, table.status, table.createdAt)

// This index supports:
// WHERE tenant_id = ?                    ✓
// WHERE tenant_id = ? AND status = ?     ✓
// WHERE tenant_id = ? AND status = ? AND created_at > ?  ✓
// WHERE status = ?                       ✗ (can't skip tenant_id)
```

## Query Patterns

### Common Table Expressions (CTEs)

Temporary result sets for query organization.

```sql
WITH active_users AS (
  SELECT * FROM users WHERE status = 'active'
),
user_stats AS (
  SELECT user_id, count(*) as post_count
  FROM posts
  GROUP BY user_id
)
SELECT u.*, s.post_count
FROM active_users u
LEFT JOIN user_stats s ON u.id = s.user_id;
```

**PostgreSQL 12+ behavior:**
- CTEs are inlined by default (optimized)
- Use `WITH ... AS MATERIALIZED` to force caching
- Use `WITH ... AS NOT MATERIALIZED` to force inlining

### Window Functions

Calculations across related rows without grouping.

```sql
-- Rank users by post count within each organization
SELECT
  id,
  org_id,
  post_count,
  RANK() OVER (PARTITION BY org_id ORDER BY post_count DESC) as rank
FROM users;

-- Running total
SELECT
  date,
  amount,
  SUM(amount) OVER (ORDER BY date) as running_total
FROM transactions;

-- Previous/next row values
SELECT
  id,
  value,
  LAG(value) OVER (ORDER BY id) as prev_value,
  LEAD(value) OVER (ORDER BY id) as next_value
FROM measurements;
```

### N+1 Query Prevention

**The Problem:**
```typescript
// WRONG - N+1 queries (1 + N round trips)
const users = await db.select().from(usersTable);
for (const user of users) {
  user.posts = await db.select().from(posts).where(eq(posts.userId, user.id));
}
```

**Solutions:**

1. **Drizzle Relations API (Best):**
```typescript
// Single query with automatic joins
const result = await db.query.users.findMany({
  with: { posts: true }
});
```

2. **Batch with inArray:**
```typescript
const userIds = users.map(u => u.id);
const allPosts = await db.select().from(posts)
  .where(inArray(posts.userId, userIds));
```

3. **Explicit JOIN:**
```typescript
const result = await db.select()
  .from(users)
  .leftJoin(posts, eq(users.id, posts.userId));
```

**Detection:** Any loop with a database call inside is suspect.

## Row-Level Security

Database-enforced access control for multi-tenancy. See **references/rls.md** for full patterns.

**Pattern:** Enable RLS → Create policy with `current_setting('app.tenant_id')` → Set context in hooks.server.ts with `SET LOCAL`.

**Critical:** Use non-superuser roles (superusers bypass RLS).

## Performance

### EXPLAIN ANALYZE

```sql
-- See execution plan without running
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';

-- Run and show actual performance
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- Include I/O statistics
EXPLAIN (ANALYZE, BUFFERS) SELECT ...;
```

### What to Look For

| Indicator | Good | Bad |
|-----------|------|-----|
| Scan type | Index Scan, Index Seek | Seq Scan on large table |
| Rows | Estimated ≈ Actual | Large discrepancy |
| Buffers | Low | High (excessive I/O) |
| Sort | Using index | Sort operation |

### Optimization Techniques

1. **Add missing indexes** (13s → 0.5ms possible)
2. **Update statistics** - `ANALYZE tablename`
3. **Reduce returned columns** - Don't `SELECT *`
4. **Aggregate early** - Reduce cardinality before expensive ops
5. **Use prepared statements** - Plan caching

### Batch Operations

```typescript
// WRONG - Multiple round trips
for (const item of items) {
  await db.insert(itemsTable).values(item);
}

// RIGHT - Single round trip
await db.insert(itemsTable).values(items);

// Batch updates with CASE
await db.execute(sql`
  UPDATE items SET status = CASE id
    WHEN 1 THEN 'active'
    WHEN 2 THEN 'inactive'
    WHEN 3 THEN 'pending'
  END
  WHERE id IN (1, 2, 3)
`);
```

## Security

### SQL Injection Prevention

**Always use parameterized queries:**

```typescript
// WRONG - SQL injection vulnerable
await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`); // Actually safe in Drizzle
await db.execute(`SELECT * FROM users WHERE id = '${userId}'`);  // DANGEROUS

// RIGHT - Parameterized (Drizzle does this automatically)
await db.select().from(users).where(eq(users.id, userId));

// RIGHT - Raw SQL with sql template tag
await db.execute(sql`SELECT * FROM users WHERE id = ${userId}`);
```

Drizzle's `sql` template tag automatically parameterizes values.

### Connection String Security

```typescript
// Use environment variables
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Never log connection strings
console.log('Connecting to database...'); // Good
console.log(process.env.DATABASE_URL);    // NEVER

// Different credentials per environment
// .env.development, .env.production
```

### Least Privilege Roles

```sql
-- Application role with limited permissions
CREATE ROLE app_user WITH LOGIN PASSWORD 'secure';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- No CREATE, DROP, ALTER permissions
-- No superuser or BYPASSRLS
```

### Sensitive Data

| Approach | Use For |
|----------|---------|
| **RLS** | Access control, multi-tenancy |
| **Column encryption** | SSN, credit cards (pgcrypto) |
| **Storage encryption** | Data at rest (Neon provides) |
| **Audit logging** | Compliance (pgAudit) |

**Trade-off:** Encrypted columns can't be indexed effectively.

## Transactions

See **references/transactions.md** for isolation levels and patterns.

```typescript
await db.transaction(async (tx) => {
  const user = await tx.insert(users).values({ email }).returning();
  await tx.insert(profiles).values({ userId: user[0].id });
  // Commits if no errors, rolls back on exception
});
```

**Rules:** Keep short, no external APIs inside, Read Committed is usually fine.

## Migrations

### Codebase-First (Recommended)

Schema in TypeScript is source of truth:

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
DATABASE_URL=$DIRECT_URL npx drizzle-kit migrate

# Dev: Push without migration files
npx drizzle-kit push
```

### Migration Best Practices

1. **Review generated SQL** before applying
2. **Use direct (non-pooled) connection** for migrations
3. **Test on branch first** (Neon branching)
4. **Make migrations reversible** when possible
5. **Small, focused migrations** - Easier to debug

### Schema Organization

Re-export all tables from `src/lib/server/db/schema/index.ts` for Drizzle Kit to find.

## Anti-Patterns

### Missing FK Indexes

```typescript
// WRONG - FK without index
userId: integer('user_id').references(() => users.id)

// RIGHT - FK with index
userId: integer('user_id').references(() => users.id)
// Plus: index in table config
```

### SELECT *

```typescript
// WRONG - Fetches all columns
const users = await db.select().from(usersTable);

// RIGHT - Fetch only needed columns
const users = await db.select({
  id: usersTable.id,
  email: usersTable.email,
}).from(usersTable);
```

### Unbounded Queries

```typescript
// WRONG - Could return millions of rows
const all = await db.select().from(logs);

// RIGHT - Always paginate
const page = await db.select().from(logs)
  .limit(100)
  .offset(pageNum * 100);
```

### N+1 in Loops

```typescript
// WRONG - N+1 pattern
for (const user of users) {
  const posts = await db.query.posts.findMany({
    where: eq(posts.userId, user.id)
  });
}

// RIGHT - Use relations
const usersWithPosts = await db.query.users.findMany({
  with: { posts: true }
});
```

### Over-Indexing

```typescript
// WRONG - Index on every column
(table) => ({
  idx1: index().on(table.col1),
  idx2: index().on(table.col2),
  idx3: index().on(table.col3),
  // ... slows down all writes
})

// RIGHT - Index what you query
(table) => ({
  emailIdx: index().on(table.email),        // Lookup
  tenantCreatedIdx: index().on(table.tenantId, table.createdAt), // Filter + sort
})
```

## References

- **references/neon.md** - Neon serverless specifics, connection pooling, branching
- **references/rls.md** - Row-Level Security patterns, multi-tenancy
- **references/transactions.md** - Isolation levels, error handling, savepoints
- **See also:** `drizzle` skill for ORM-specific patterns
