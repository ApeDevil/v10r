# Data Layer

Velociraptor uses a polyglot persistence strategy: the right database for each job.

## Databases

| Database | Provider | Use For |
|----------|----------|---------|
| **PostgreSQL** | [Neon](../../stack/vendors.md#neon) | Users, sessions, CRUD entities, transactional data |
| **Neo4j** | [Neo4j Aura](../../stack/vendors.md#neo4j-aura) | Relationships, navigation graphs, future RAG |
| **S3 API** | [Cloudflare R2](../../stack/vendors.md#cloudflare-r2) | Binary files, images, uploads |

See [vendors.md](../../stack/vendors.md) for costs, alternatives, and migration guides.

## Decision Tree

```
Need to store data?
├── Is it a file/binary?
│   └── Yes → R2 (files.md)
│
├── Does it need ACID transactions?
│   └── Yes → PostgreSQL (relational.md)
│
├── Is it primarily about relationships between entities?
│   └── Yes → Neo4j (graph.md)
│
└── Default → PostgreSQL
```

## Cross-Store Freshness

No foreign keys across stores. References between Postgres, Neo4j, and R2 must be validated at the application level. See [polyglot-freshness.md](./polyglot-freshness.md) for:

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

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        SvelteKit App                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Drizzle   │  │  Neo4j      │  │   S3 Client         │ │
│  │   ORM       │  │  Driver     │  │   (@aws-sdk)        │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │           │
└─────────┼────────────────┼─────────────────────┼───────────┘
          │                │                     │
          ▼                ▼                     ▼
   ┌────────────┐   ┌────────────┐      ┌─────────────┐
   │   Neon     │   │  Neo4j     │      │ Cloudflare  │
   │ PostgreSQL │   │   Aura     │      │     R2      │
   └────────────┘   └────────────┘      └─────────────┘
```

## Documents

| File | Contents |
|------|----------|
| [relational.md](./relational.md) | Drizzle schema, Better Auth tables, migrations |
| [graph.md](./graph.md) | Neo4j connection, Cypher queries, graph model |
| [polyglot-freshness.md](./polyglot-freshness.md) | Cross-database reference integrity, orphan cleanup |

## File Storage

File storage (R2) will be documented in `files.md` (future addition).

## Local Development

All three services run in containers:

```yaml
# compose.yaml
services:
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: velociraptor
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres

  neo4j:
    image: neo4j:5-community
    ports: ["7474:7474", "7687:7687"]
    environment:
      NEO4J_AUTH: neo4j/password

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
```

## Environment Variables

```bash
# PostgreSQL (Neon in prod, local in dev)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/velociraptor"

# Neo4j
NEO4J_URI="bolt://localhost:7687"
NEO4J_USER="neo4j"
NEO4J_PASSWORD="password"

# R2 (MinIO in dev, Cloudflare in prod)
R2_ENDPOINT="http://localhost:9000"
R2_ACCESS_KEY_ID="minioadmin"
R2_SECRET_ACCESS_KEY="minioadmin"
R2_BUCKET="velociraptor"
```
