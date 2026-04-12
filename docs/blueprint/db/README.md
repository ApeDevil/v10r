# Data Layer

Velociraptor uses a polyglot persistence strategy: the right database for each job.

## Databases

| Database | Provider | Use For |
|----------|----------|---------|
| **PostgreSQL** | [Neon](../../stack/vendors.md#neon) | Users, sessions, CRUD entities, transactional data |
| **Neo4j** | [Neo4j Aura](../../stack/vendors.md#neo4j-aura) | Relationships, navigation graphs, future RAG |
| **S3 API** | [Cloudflare R2](../../stack/vendors.md#cloudflare-r2) | Binary files, images, uploads |
| **Redis** | [Upstash](../../stack/vendors.md#upstash) | Cache, rate limiting, sessions, counters, leaderboards |

See [vendors.md](../../stack/vendors.md) for costs, alternatives, and migration guides.

## Decision Tree

```
Need to store data?
├── Is it a file/binary?
│   └── Yes → R2
│
├── Is it ephemeral, needs sub-10ms access, or can be lost?
│   └── Yes → Redis (cache layer)
│
├── Does it need ACID transactions?
│   └── Yes → PostgreSQL
│
├── Is it primarily about relationships between entities?
│   └── Yes → Neo4j
│
└── Default → PostgreSQL
```

## Cross-Store Freshness

No foreign keys across stores. References between Postgres, Neo4j, R2, and Redis must be validated at the application level. See [polyglot-freshness.md](./polyglot-freshness.md) for:

- Read-time validation patterns
- Soft delete with cascade propagation
- Transactional outbox for guaranteed events
- Periodic reconciliation for orphan cleanup

## When to Use Each

### PostgreSQL

- User accounts and authentication
- Sessions (via Better Auth)
- Content with structured fields (items, tags, settings)
- Anything needing transactions
- Data that needs strong consistency

### Neo4j

- Entity relationships (page → feature, concept → concept)
- Graph traversal queries ("find all related pages")
- Navigation paths and recommendations
- Future: RAG for semantic search
- Knowledge graphs

### R2 / S3-Compatible Storage

- User uploads (images, documents)
- Generated files (exports, reports)
- Static assets that need CDN delivery
- Anything > 1MB

See [../../stack/data/r2.md](../../stack/data/r2.md) for implementation details.

### Redis / Upstash

- Rate limiting (sliding window counters per user/IP)
- Session tokens (short-lived, fast-access)
- Feature flags (per-user or global toggles)
- Leaderboards (sorted sets with automatic ranking)
- Atomic counters (view counts, download tallies)
- Caching hot queries (pre-computed results for expensive reads)

See [../../stack/data/redis.md](../../stack/data/redis.md) for implementation details.

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                            SvelteKit App                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │   Drizzle   │  │  Neo4j      │  │  S3 Client   │  │ @upstash/     │  │
│  │   ORM       │  │  Driver     │  │  (@aws-sdk)  │  │  redis        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                │                │                  │           │
└─────────┼────────────────┼────────────────┼──────────────────┼───────────┘
          │                │                │                  │
          ▼                ▼                ▼                  ▼
   ┌────────────┐   ┌────────────┐  ┌─────────────┐   ┌────────────┐
   │   Neon     │   │  Neo4j     │  │ Cloudflare  │   │  Upstash   │
   │ PostgreSQL │   │   Aura     │  │     R2      │   │   Redis    │
   └────────────┘   └────────────┘  └─────────────┘   └────────────┘
```

## Documents

| File | Contents |
|------|----------|
| [relational.md](./relational.md) | Drizzle schema, Better Auth tables, migrations |
| [graph.md](./graph.md) | Neo4j connection, Cypher queries, graph model |
| [polyglot-freshness.md](./polyglot-freshness.md) | Cross-database reference integrity, orphan cleanup |
## Local Development

All databases are cloud-hosted — no local containers needed:

- **PostgreSQL**: Neon (serverless, auto-scales to zero)
- **Neo4j**: Neo4j Aura Free (cloud graph database)
- **R2**: Cloudflare R2 (S3-compatible object storage)
- **Redis**: Upstash (HTTP-based, no local container needed)

## Environment Variables

```bash
# PostgreSQL (Neon)
DATABASE_URL="postgresql://..."

# Neo4j (Aura)
NEO4J_URI="neo4j+s://..."
NEO4J_USER="neo4j"
NEO4J_PASSWORD="..."

# R2 (Cloudflare)
R2_ENDPOINT="https://..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET="velociraptor"

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="https://..."
UPSTASH_REDIS_REST_TOKEN="..."
```
