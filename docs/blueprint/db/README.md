# Data Layer

Velociraptor uses a polyglot persistence strategy: the right database for each job.

## Databases

| Database | Provider | Use For |
|----------|----------|---------|
| **PostgreSQL** | Neon | Users, sessions, CRUD entities, transactional data |
| **Neo4j** | Neo4j Aura | Relationships, navigation graphs, future RAG |
| **R2** | Cloudflare | Binary files, images, uploads |

## Decision Tree

```
Need to store data?
├── Is it a file/binary?
│   └── Yes → R2 (files.md)
│
├── Does it need ACID transactions?
│   └── Yes → PostgreSQL (postgres.md)
│
├── Is it primarily about relationships between entities?
│   └── Yes → Neo4j (graph.md)
│
└── Default → PostgreSQL
```

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

### Cloudflare R2

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
| [postgres.md](./postgres.md) | Drizzle schema, Better Auth tables, migrations |
| [graph.md](./graph.md) | Neo4j connection, Cypher queries, graph model |

## File Storage

File storage (R2) is documented separately in [files.md](../files.md) (future).

For now, see [stack/core.md](../../stack/core.md) for R2 configuration.

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
