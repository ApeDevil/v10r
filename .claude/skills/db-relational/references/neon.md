# Neon Serverless Postgres Reference

Neon-specific implementation details for Velociraptor.

## Contents

- [Connection Strings](#connection-strings) - Pooled vs direct
- [Serverless Driver](#serverless-driver) - @neondatabase/serverless
- [Connection Pooling](#connection-pooling) - Vercel Fluid Compute
- [Database Branching](#database-branching) - Dev/preview workflows
- [Free Tier Limits](#free-tier-limits) - Quotas and gotchas
- [Drizzle Setup](#drizzle-setup) - Configuration patterns

## Connection Strings

### Pooled vs Direct

Neon provides two connection string formats:

| Type | Hostname | Use For |
|------|----------|---------|
| **Pooled** | `*-pooler.*.neon.tech` | App queries, serverless functions |
| **Direct** | `*.*.neon.tech` | Migrations, schema changes, admin |

```env
# Pooled - for application (via PgBouncer)
DATABASE_URL=postgres://user:pass@ep-xxx-pooler.region.neon.tech/db?sslmode=require

# Direct - for migrations
DATABASE_URL_DIRECT=postgres://user:pass@ep-xxx.region.neon.tech/db?sslmode=require
```

### Pooled Connection Behavior

- Up to **10,000 concurrent connections** via PgBouncer
- **Transaction mode** - Session variables don't persist across transactions
- Sub-100ms subsequent queries (warm pool)

### Transaction Mode Limitations

```typescript
// WRONG - search_path won't persist
await db.execute(sql`SET search_path TO tenant_schema`);
await db.select().from(users); // Uses public schema!

// RIGHT - Set within same transaction
await db.transaction(async (tx) => {
  await tx.execute(sql`SET LOCAL search_path TO tenant_schema`);
  await tx.select().from(users); // Uses tenant_schema
});
```

**Symptoms:** "relation does not exist" errors with pooled connections.

## Serverless Driver

### When to Use Which Driver

| Environment | Driver | Why |
|-------------|--------|-----|
| Vercel Edge | `@neondatabase/serverless` | WebSocket/HTTP transport |
| Vercel Functions | Either | Both work with Fluid Compute |
| Cloudflare Workers | `@neondatabase/serverless` | No TCP sockets |
| Traditional Node.js | `pg` or `postgres` | Standard TCP |

### Connection Methods

**HTTP (one-shot queries):**
```typescript
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

// Single query - fastest for simple operations
const result = await sql`SELECT * FROM users WHERE id = ${userId}`;
```

**WebSocket (sessions/transactions):**
```typescript
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Supports transactions and session-level features
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // ... multiple queries
  await client.query('COMMIT');
} finally {
  client.release();
}
```

### With Drizzle

```typescript
// HTTP mode (simple queries)
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// WebSocket mode (transactions)
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

## Connection Pooling

### The Serverless Challenge

- Functions scale independently → many connections
- Each cold start opens new connection
- Connection limits exhausted under load
- Suspended functions may leak connections

### Vercel Fluid Compute Solution

Since April 2025, Vercel Fluid Compute allows connection reuse:

```typescript
// src/lib/server/db/index.ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';

// Global pool - reused across invocations
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Critical: Prevents connection leaks on suspension
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
```

**How it works:**
1. Multiple invocations share single function instance
2. Pool connections reused across requests
3. `attachDatabasePool` closes idle connections before suspension
4. No connection leaks

### Without Fluid Compute

If Fluid Compute is disabled (legacy):

```typescript
// +page.server.ts - Create per request
export const load: PageServerLoad = async () => {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql); // HTTP mode, no persistent connection

  return { users: await db.select().from(users) };
};
```

### Cold Start Performance

| Scenario | Latency |
|----------|---------|
| Cold start (endpoint wake + Lambda) | ~800ms |
| Warm (subsequent requests) | ~350ms |
| With Fluid Compute (reused connection) | ~50-100ms |

## Database Branching

### Key Features

- Create branch in **~1 second** (any DB size)
- **Copy-on-write** - Branches share base data
- Unique connection string per branch
- Only billed for unique data
- Branches scale to zero when inactive

### Workflows

#### Developer Branches

```bash
# Create developer branch
neon branches create --name dev/alice --project-id $PROJECT_ID

# Get connection string
neon connection-string dev/alice --project-id $PROJECT_ID

# Reset to latest production
neon branches reset dev/alice --parent main --project-id $PROJECT_ID
```

#### Preview Branches (PR-based)

```yaml
# .github/workflows/preview.yml
name: Preview Environment

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  create-preview:
    runs-on: ubuntu-latest
    steps:
      - name: Create Neon branch
        uses: neondatabase/create-branch-action@v5
        with:
          project_id: ${{ secrets.NEON_PROJECT_ID }}
          api_key: ${{ secrets.NEON_API_KEY }}
          branch_name: preview/pr-${{ github.event.number }}
          parent: main

      - name: Deploy to Vercel
        # Branch connection string available as output
        run: vercel deploy --env DATABASE_URL=${{ steps.branch.outputs.connection_string }}
```

#### Test Isolation

```typescript
// tests/setup.ts
import { createNeonBranch, deleteNeonBranch } from './neon-helpers';

let branchName: string;

beforeAll(async () => {
  branchName = `test/${Date.now()}`;
  const { connectionString } = await createNeonBranch(branchName);
  process.env.DATABASE_URL = connectionString;
});

afterAll(async () => {
  await deleteNeonBranch(branchName);
});
```

### Vercel Integration

Neon + Vercel integration auto-creates branches:

1. Install Neon integration in Vercel
2. Link Neon project to Vercel project
3. Preview deployments auto-get branch databases
4. Production uses main branch

```
main branch     → production deployment
preview/pr-123  → preview deployment (auto-created)
dev/feature-x   → development (manual)
```

### Branch Naming Conventions

```
main              # Production
dev/{developer}   # Long-lived developer branches
preview/pr-{num}  # PR preview branches (auto-delete on merge)
test/{timestamp}  # Ephemeral test branches
staging           # Staging environment
```

## Free Tier Limits

### Quotas (October 2025)

| Resource | Limit |
|----------|-------|
| Projects | 100 |
| Compute hours | 100 CU-hours/month/project |
| Storage | 0.5 GB per branch |
| Egress | 5 GB |
| Max autoscaling | 2 CU (vs 16 on paid) |
| Point-in-time recovery | 6 hours, 1 GB changes |

**1 CU = 1 vCPU + 4 GB RAM**

### Scale-to-Zero

- Always enabled on free tier
- **5-minute idle timeout** (cannot disable)
- Cold start ~800ms (first query wakes endpoint)
- No charges during idle

### Gotchas

1. **Storage per branch** - Each branch has 0.5 GB limit
2. **Compute hours** - Heavy usage can exhaust monthly quota
3. **Can't disable scale-to-zero** - Cold starts unavoidable on free
4. **Limited PITR** - Only 6 hours of history

### Is Free Tier Production-Ready?

| Use Case | Recommendation |
|----------|----------------|
| Side projects | Yes |
| Prototypes | Yes |
| Low-traffic production | Probably (monitor usage) |
| High-traffic production | No (upgrade) |

Commercial use is allowed, never expires, no credit card required.

## Drizzle Setup

### Project Structure

```
src/lib/server/db/
├── index.ts        # Database client export
├── schema/
│   ├── index.ts    # Re-export all schemas
│   ├── users.ts    # User tables
│   ├── posts.ts    # Post tables
│   └── auth.ts     # Better Auth tables
└── migrations/     # Generated migrations
```

### Database Client

```typescript
// src/lib/server/db/index.ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { attachDatabasePool } from '@vercel/functions';
import * as schema from './schema';
import { DATABASE_URL } from '$env/static/private';

const pool = new Pool({ connectionString: DATABASE_URL });
attachDatabasePool(pool);

export const db = drizzle(pool, { schema });
```

### Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/db/schema/index.ts',
  out: './src/lib/server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use DIRECT connection for migrations (no pooler)
    url: process.env.DATABASE_URL_DIRECT!,
  },
});
```

### Migration Commands

```bash
# Generate migration from schema changes
bunx drizzle-kit generate

# Apply migrations (use direct connection)
DATABASE_URL=$DATABASE_URL_DIRECT bunx drizzle-kit migrate

# Push schema directly (dev only)
bunx drizzle-kit push

# Open Drizzle Studio
bunx drizzle-kit studio
```

### Type-Safe Queries

```typescript
// Full type inference from schema
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';

// In +page.server.ts
export const load: PageServerLoad = async () => {
  // Fully typed result
  const allUsers = await db.query.users.findMany({
    with: { posts: true },
    where: eq(users.status, 'active'),
  });

  return { users: allUsers };
};
```

## Troubleshooting

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `ECONNREFUSED` | Endpoint asleep | Wait for wake (~800ms) |
| `too many connections` | Exhausted pool | Use pooled connection string |
| `relation does not exist` | Schema mismatch or search_path | Run migrations, check schema |
| `connection terminated` | Idle timeout | Reconnect, use pool |
| `prepared statement already exists` | Driver issue | Use HTTP mode or fresh connections |

### Debug Queries

```typescript
// Enable query logging
const db = drizzle(pool, {
  schema,
  logger: true, // Logs all queries
});

// Or custom logger
const db = drizzle(pool, {
  schema,
  logger: {
    logQuery(query, params) {
      console.log('Query:', query);
      console.log('Params:', params);
    },
  },
});
```

### Check Connection

```typescript
// Health check endpoint
export const GET: RequestHandler = async () => {
  try {
    await db.execute(sql`SELECT 1`);
    return json({ status: 'healthy' });
  } catch (error) {
    return json({ status: 'unhealthy', error: String(error) }, { status: 500 });
  }
};
```

### Monitor Usage

```bash
# Check compute usage
neon projects get $PROJECT_ID --output json | jq '.consumption'

# List branches and sizes
neon branches list --project-id $PROJECT_ID
```

## Environment Variables

```env
# Application (pooled)
DATABASE_URL=postgres://user:pass@ep-xxx-pooler.region.neon.tech/db?sslmode=require

# Migrations (direct)
DATABASE_URL_DIRECT=postgres://user:pass@ep-xxx.region.neon.tech/db?sslmode=require

# Neon API (for branching)
NEON_API_KEY=neon_api_key_xxx
NEON_PROJECT_ID=project-xxx
```

### SvelteKit Environment

```typescript
// src/lib/server/db/index.ts
import { DATABASE_URL } from '$env/static/private';

// TypeScript knows DATABASE_URL exists and is string
const pool = new Pool({ connectionString: DATABASE_URL });
```

Ensure variables are in `.env` and listed in `$env/static/private` types.
