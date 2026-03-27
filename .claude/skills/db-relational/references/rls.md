# Row-Level Security (RLS)

Database-enforced access control for multi-tenancy.

## Contents

- [Why RLS](#why-rls) - Benefits of database-level security
- [Implementation Pattern](#implementation-pattern) - Basic setup
- [SvelteKit Integration](#sveltekit-integration) - Setting tenant context
- [Best Practices](#best-practices) - Session variables, testing

## Why RLS

- **Defense in depth** - Buggy code can't access wrong tenant's data
- **Centralized** - Security at DB level, not scattered in app
- **Query-planner aware** - PostgreSQL optimizes with tenant_id indexes

## Implementation Pattern

```sql
-- 1. Enable RLS on table
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 2. Create policy using session variable
CREATE POLICY tenant_isolation ON documents
FOR ALL
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- 3. Set tenant context per request (in app code)
SET LOCAL app.current_tenant_id = 'tenant-uuid-here';
```

## SvelteKit Integration

```typescript
// hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const session = await getSession(event);

  // Set tenant context for all queries in this request
  if (session?.tenantId) {
    await db.execute(sql`
      SET LOCAL app.current_tenant_id = ${session.tenantId}
    `);
  }

  return resolve(event);
};
```

## Best Practices

1. **Use session variables, not per-tenant DB users**
2. **Include tenant_id in every tenant table**
3. **Use non-superuser roles** (superusers bypass RLS)
4. **Test thoroughly** - Complex queries may have unintended behavior
5. **Combine with application-level checks** for complex logic

## Drizzle Schema Pattern

```typescript
// Include tenant_id in all tenant-scoped tables
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull(),
  title: text('title').notNull(),
  // ...
}, (table) => ({
  tenantIdx: index('documents_tenant_idx').on(table.tenantId),
}));
```

## Policy Examples

```sql
-- Read-only for non-owners
CREATE POLICY read_own ON documents
FOR SELECT
USING (user_id = current_setting('app.current_user_id')::uuid);

-- Write only for admins
CREATE POLICY admin_write ON documents
FOR ALL
USING (current_setting('app.user_role') = 'admin');

-- Org-based isolation
CREATE POLICY org_isolation ON projects
FOR ALL
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = current_setting('app.current_user_id')::uuid
  )
);
```
