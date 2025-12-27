# PostgreSQL

Relational database. Production-ready, rich features, JSON support.

## Why PostgreSQL

| Aspect | PostgreSQL | MySQL | SQLite |
|--------|------------|-------|--------|
| JSON Support | Native JSONB | JSON type | JSON functions |
| Full-text Search | Built-in | Plugin | Extension |
| Concurrent Writes | MVCC | Locks | Single-writer |
| Extensions | Rich ecosystem | Limited | Limited |

PostgreSQL wins: JSONB, full-text search, extensions, Drizzle-native.

## Provider: Neon

| Aspect | Neon | Supabase | PlanetScale |
|--------|------|----------|-------------|
| Free Tier | 0.5 GB, 1 project | 500 MB, 2 projects | 5 GB, 1 DB |
| Branching | Yes | No | Yes |
| Serverless | Native | Pooler needed | Native |
| Cold Start | ~500ms | None | None |

Neon wins: generous free tier, database branching, serverless-native.

See [../vendors.md](../vendors.md#neon) for pricing details.

## Data Responsibilities

| Data Type | Store in PostgreSQL |
|-----------|---------------------|
| Users | Yes |
| Sessions | Yes |
| Content | Yes |
| Settings | Yes |
| Relationships | No (use Neo4j) |
| Files | No (use R2) |

## Stack Integration

| Layer | Technology | Why |
|-------|------------|-----|
| Database | **PostgreSQL** | ACID, JSON support, Drizzle-native |
| Provider | **Neon** | Serverless, branching, generous free tier |
| ORM | **Drizzle** | Type-safe, lightweight |
| Sessions | **Better Auth** | Native Drizzle adapter |

## Related

- [drizzle.md](./drizzle.md) - ORM
- [neo4j.md](./neo4j.md) - Graph data
- [r2.md](./r2.md) - File storage
- [../auth/better-auth.md](../auth/better-auth.md) - Session storage
