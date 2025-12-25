# Polyglot Freshness

Cross-database reference integrity in a multi-store architecture.

---

## The Problem

Polyglot persistence means no foreign keys across stores. A user ID in Neo4j doesn't automatically cascade when deleted from Postgres. A file URL in Postgres doesn't validate against R2. This is the hidden cost of using the right database for each job.

**Your responsibility:** Ensure references between stores remain valid and current.

---

## Reference Map

| From | To | Reference | Freshness Concern |
|------|-----|-----------|-------------------|
| Neo4j node | Postgres user | `userId` property | User deletion must invalidate/remove nodes |
| Postgres `files` | R2 object | `storageKey` | File deletion must remove object |
| Postgres `items` | Neo4j node | Entity ID | Item deletion must clean graph refs |
| Neo4j `:RELATES_TO` | Neo4j nodes | Both endpoints | Node deletion cascades automatically |

---

## Strategy Overview

Choose based on consistency requirements and complexity tolerance:

| Strategy | Consistency | Complexity | When to Use |
|----------|-------------|------------|-------------|
| **Read-time validation** | Eventual | Low | Non-critical refs, can tolerate stale |
| **Soft delete + propagation** | Eventual | Low-Medium | Need audit trail, async cleanup OK |
| **Transactional outbox** | Strong (local) | Medium | Critical events, need reliability |
| **Periodic reconciliation** | Eventual | Low | Orphan cleanup, batch operations |
| **CDC (Debezium)** | Near-real-time | High | Enterprise scale, many consumers |

**Recommendation:** Start with soft deletes + periodic reconciliation. Add outbox for critical paths. CDC only at scale.

---

## Pattern 1: Read-Time Validation

Check reference validity when reading. Simplest approach, handles stale refs gracefully.

```typescript
// src/lib/server/graph/queries.ts
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

export async function getPageWithFeatures(pagePath: string) {
  const session = await getSession();
  try {
    const result = await session.run(
      `MATCH (p:Page {path: $path})-[:CREATED_BY]->(u:User)
       RETURN p, u.userId as userId`,
      { path: pagePath }
    );

    if (result.records.length === 0) return null;

    const page = result.records[0].get('p').properties;
    const userId = result.records[0].get('userId');

    // Validate user still exists in Postgres
    const [dbUser] = await db
      .select()
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);

    if (!dbUser) {
      // Reference is stale - handle gracefully
      return { ...page, user: null, userDeleted: true };
    }

    return { ...page, user: dbUser };
  } finally {
    await session.close();
  }
}
```

**Pros:** Zero infrastructure, immediate implementation.
**Cons:** Extra queries, doesn't clean up stale data.

---

## Pattern 2: Soft Delete with Propagation

Never hard-delete. Mark as deleted, then propagate asynchronously.

### Schema Addition

```typescript
// src/lib/server/db/schema/common.ts
import { timestamp, boolean } from 'drizzle-orm/pg-core';

// Add to tables that need soft delete
export const softDeleteColumns = {
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  isDeleted: boolean('is_deleted').notNull().default(false),
};
```

### Soft Delete Helper

```typescript
// src/lib/server/db/soft-delete.ts
import { db } from './index';
import { eq, and, isNull } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';

export async function softDelete<T extends PgTable>(
  table: T,
  id: string,
  idColumn: keyof T
) {
  return db
    .update(table)
    .set({
      deletedAt: new Date(),
      isDeleted: true
    })
    .where(eq(table[idColumn], id));
}

// Query helper - exclude deleted by default
export function notDeleted<T extends PgTable>(table: T) {
  return isNull(table.deletedAt);
}
```

### Propagation Service

```typescript
// src/lib/server/services/deletion-propagation.ts
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { getSession } from '$lib/server/graph';
import { deleteR2Object } from '$lib/server/storage';
import { eq, and, isNotNull } from 'drizzle-orm';

export async function propagateUserDeletion(userId: string) {
  // 1. Clean up Neo4j nodes owned by this user
  const graphSession = await getSession();
  try {
    await graphSession.run(
      `MATCH (n {userId: $userId}) DETACH DELETE n`,
      { userId }
    );
  } finally {
    await graphSession.close();
  }

  // 2. Clean up R2 files owned by this user
  const userFiles = await db
    .select({ storageKey: files.storageKey })
    .from(files)
    .where(eq(files.userId, userId));

  for (const file of userFiles) {
    await deleteR2Object(file.storageKey);
  }

  // 3. Hard delete now that refs are cleaned
  await db.delete(files).where(eq(files.userId, userId));
  await db.delete(user).where(eq(user.id, userId));
}
```

**Pros:** Audit trail, controlled cleanup, recoverable.
**Cons:** Queries must filter deleted records, storage overhead.

---

## Pattern 3: Transactional Outbox

For critical operations where you need guaranteed event delivery.

### Outbox Table

```typescript
// src/lib/server/db/schema/outbox.ts
import { pgTable, text, timestamp, jsonb, pgEnum } from 'drizzle-orm/pg-core';

export const outboxStatusEnum = pgEnum('outbox_status', [
  'pending',
  'processing',
  'completed',
  'failed'
]);

export const outbox = pgTable('outbox', {
  id: text('id').primaryKey(),
  aggregateType: text('aggregate_type').notNull(), // 'user', 'item', 'file'
  aggregateId: text('aggregate_id').notNull(),
  eventType: text('event_type').notNull(), // 'deleted', 'updated'
  payload: jsonb('payload'),
  status: outboxStatusEnum('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  retryCount: integer('retry_count').notNull().default(0),
  error: text('error'),
});
```

### Write with Outbox (Same Transaction)

```typescript
// src/lib/server/services/user.ts
import { db } from '$lib/server/db';
import { user, outbox } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function deleteUser(userId: string) {
  // Single transaction: soft delete + outbox event
  await db.transaction(async (tx) => {
    // Soft delete the user
    await tx
      .update(user)
      .set({ deletedAt: new Date(), isDeleted: true })
      .where(eq(user.id, userId));

    // Write event to outbox (same transaction = atomic)
    await tx.insert(outbox).values({
      id: `obx_${nanoid(12)}`,
      aggregateType: 'user',
      aggregateId: userId,
      eventType: 'deleted',
      payload: { userId },
    });
  });
}
```

### Outbox Processor (Background Job)

```typescript
// src/lib/server/jobs/outbox-processor.ts
import { db } from '$lib/server/db';
import { outbox } from '$lib/server/db/schema';
import { eq, and, lt } from 'drizzle-orm';
import { propagateUserDeletion } from '../services/deletion-propagation';

const MAX_RETRIES = 3;

export async function processOutbox() {
  // Get pending events (oldest first)
  const events = await db
    .select()
    .from(outbox)
    .where(
      and(
        eq(outbox.status, 'pending'),
        lt(outbox.retryCount, MAX_RETRIES)
      )
    )
    .orderBy(outbox.createdAt)
    .limit(10);

  for (const event of events) {
    try {
      // Mark as processing
      await db
        .update(outbox)
        .set({ status: 'processing' })
        .where(eq(outbox.id, event.id));

      // Process based on event type
      if (event.aggregateType === 'user' && event.eventType === 'deleted') {
        await propagateUserDeletion(event.aggregateId);
      }
      // Add more handlers...

      // Mark completed
      await db
        .update(outbox)
        .set({
          status: 'completed',
          processedAt: new Date()
        })
        .where(eq(outbox.id, event.id));

    } catch (error) {
      // Increment retry, mark failed if max reached
      await db
        .update(outbox)
        .set({
          status: event.retryCount + 1 >= MAX_RETRIES ? 'failed' : 'pending',
          retryCount: event.retryCount + 1,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(outbox.id, event.id));
    }
  }
}
```

### Cron Trigger

```typescript
// src/routes/api/cron/outbox/+server.ts
import { json } from '@sveltejs/kit';
import { processOutbox } from '$lib/server/jobs/outbox-processor';

// Secure with API key or Vercel Cron
export async function GET({ request }) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  await processOutbox();
  return json({ success: true });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/outbox",
    "schedule": "* * * * *"
  }]
}
```

**Pros:** Guaranteed delivery, retry logic, audit trail.
**Cons:** Additional table, background job infrastructure.

---

## Pattern 4: Periodic Reconciliation

Batch detection and cleanup of orphaned records. Run hourly or daily.

### Orphan Detection Queries

```typescript
// src/lib/server/jobs/reconciliation.ts
import { db } from '$lib/server/db';
import { files, user } from '$lib/server/db/schema';
import { getSession } from '$lib/server/graph';
import { listR2Objects, deleteR2Object } from '$lib/server/storage';
import { sql, notInArray } from 'drizzle-orm';

export async function reconcileOrphans() {
  const results = {
    graphNodesWithoutUsers: 0,
    r2ObjectsWithoutRecords: 0,
    fileRecordsWithoutObjects: 0,
  };

  // 1. Find Neo4j nodes referencing deleted users
  const graphSession = await getSession();
  try {
    // Get all userIds from graph
    const graphResult = await graphSession.run(
      `MATCH (n) WHERE n.userId IS NOT NULL
       RETURN DISTINCT n.userId as userId`
    );
    const graphUserIds = graphResult.records.map(r => r.get('userId'));

    // Check which exist in Postgres
    const existingUsers = await db
      .select({ id: user.id })
      .from(user)
      .where(sql`${user.id} = ANY(${graphUserIds})`);

    const existingIds = new Set(existingUsers.map(u => u.id));
    const orphanedIds = graphUserIds.filter(id => !existingIds.has(id));

    // Clean up orphaned nodes
    if (orphanedIds.length > 0) {
      await graphSession.run(
        `MATCH (n) WHERE n.userId IN $ids DETACH DELETE n`,
        { ids: orphanedIds }
      );
      results.graphNodesWithoutUsers = orphanedIds.length;
    }
  } finally {
    await graphSession.close();
  }

  // 2. Find R2 objects not referenced in database
  const r2Objects = await listR2Objects();
  const dbFiles = await db.select({ storageKey: files.storageKey }).from(files);
  const dbKeys = new Set(dbFiles.map(f => f.storageKey));

  for (const obj of r2Objects) {
    if (!dbKeys.has(obj.key)) {
      await deleteR2Object(obj.key);
      results.r2ObjectsWithoutRecords++;
    }
  }

  // 3. Find file records pointing to missing R2 objects
  const r2Keys = new Set(r2Objects.map(o => o.key));
  const orphanedRecords = dbFiles.filter(f => !r2Keys.has(f.storageKey));

  if (orphanedRecords.length > 0) {
    await db
      .delete(files)
      .where(sql`${files.storageKey} = ANY(${orphanedRecords.map(r => r.storageKey)})`);
    results.fileRecordsWithoutObjects = orphanedRecords.length;
  }

  return results;
}
```

### Scheduled Execution

```typescript
// src/routes/api/cron/reconcile/+server.ts
import { json } from '@sveltejs/kit';
import { reconcileOrphans } from '$lib/server/jobs/reconciliation';

export async function GET({ request }) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = await reconcileOrphans();

  // Log for monitoring
  console.log('[Reconciliation]', results);

  return json({ success: true, ...results });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/reconcile",
    "schedule": "0 * * * *"
  }]
}
```

**Pros:** Simple, catches everything eventually, low overhead.
**Cons:** Delayed cleanup, stale data visible until next run.

---

## Pattern 5: Change Data Capture (CDC)

For enterprise scale with real-time requirements. Uses Debezium + Kafka.

### When to Consider CDC

- Multiple consumers need database change events
- Sub-second latency required
- 10K+ writes/second
- Need to replicate to data warehouse

### Architecture

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Postgres │───▶│ Debezium │───▶│  Kafka   │───▶│ Consumer │
│   WAL    │    │Connector │    │  Topic   │    │ Services │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
                              ┌──────────────────────┐
                              │ Neo4j / R2 / etc.    │
                              └──────────────────────┘
```

**Not covered in detail** — this requires Kafka infrastructure (Confluent Cloud, Upstash Kafka, or self-hosted). Only implement when simpler patterns hit limits.

---

## Decision Tree

```
Need cross-store consistency?
│
├── Can tolerate stale reads?
│   └── Yes → Read-time validation (Pattern 1)
│
├── Need audit trail?
│   └── Yes → Soft delete + propagation (Pattern 2)
│
├── Critical operation, must not lose events?
│   └── Yes → Transactional outbox (Pattern 3)
│
├── Batch cleanup is acceptable?
│   └── Yes → Periodic reconciliation (Pattern 4)
│
└── Need real-time at scale?
    └── Yes → CDC with Debezium (Pattern 5)
```

---

## Implementation Priority

### Phase 1: Foundation (Start Here)
- [ ] Add soft delete columns to relevant tables
- [ ] Implement `notDeleted()` query helper
- [ ] Create basic reconciliation job
- [ ] Run reconciliation on cron (daily)

### Phase 2: Reliability
- [ ] Add outbox table
- [ ] Wrap critical operations with outbox writes
- [ ] Create outbox processor job
- [ ] Run outbox processor on cron (every minute)

### Phase 3: Monitoring
- [ ] Add metrics for orphan counts
- [ ] Alert on failed outbox events
- [ ] Dashboard for reconciliation results

### Phase 4: Scale (If Needed)
- [ ] Evaluate CDC requirements
- [ ] Set up Kafka infrastructure
- [ ] Deploy Debezium connectors

---

## Testing Freshness

### Integration Test: User Deletion Cascade

```typescript
// tests/integration/user-deletion.test.ts
import { describe, it, expect } from 'vitest';
import { db, schema } from '$lib/server/db';
import { getSession } from '$lib/server/graph';
import { deleteUser } from '$lib/server/services/user';
import { processOutbox } from '$lib/server/jobs/outbox-processor';

describe('User deletion cascade', () => {
  it('should clean up Neo4j nodes when user is deleted', async () => {
    // Setup: Create user and graph node
    const userId = 'test_user_123';
    await db.insert(schema.user).values({
      id: userId,
      email: 'test@example.com'
    });

    const graphSession = await getSession();
    await graphSession.run(
      `CREATE (n:Page {id: 'page_1', userId: $userId})`,
      { userId }
    );
    await graphSession.close();

    // Act: Delete user
    await deleteUser(userId);
    await processOutbox(); // Process async events

    // Assert: Graph node should be gone
    const verifySession = await getSession();
    const result = await verifySession.run(
      `MATCH (n {userId: $userId}) RETURN count(n) as count`,
      { userId }
    );
    await verifySession.close();

    expect(result.records[0].get('count').toNumber()).toBe(0);
  });
});
```

---

## File Structure

```
src/lib/server/
├── db/
│   └── schema/
│       ├── outbox.ts         # Outbox table
│       └── common.ts         # Soft delete columns
├── jobs/
│   ├── outbox-processor.ts   # Process outbox events
│   └── reconciliation.ts     # Orphan detection
└── services/
    └── deletion-propagation.ts # Cross-store cleanup

src/routes/api/cron/
├── outbox/+server.ts         # Outbox cron endpoint
└── reconcile/+server.ts      # Reconciliation cron endpoint
```

---

## Related

- [README.md](./README.md) - Polyglot persistence overview
- [postgres.md](./postgres.md) - Drizzle schema
- [graph.md](./graph.md) - Neo4j queries
- [../api.md](../api.md) - API endpoints

---

## Sources

- [Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Saga Pattern](https://microservices.io/patterns/data/saga.html)
- [Azure Saga Design Pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga)
- [Debezium CDC](https://debezium.io/)
- [AWS Prescriptive Guidance: Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
- [Martin Fowler: Polyglot Persistence](https://martinfowler.com/bliki/PolyglotPersistence.html)
- [PostgreSQL Application-Level Consistency](https://www.postgresql.org/docs/current/applevel-consistency.html)
