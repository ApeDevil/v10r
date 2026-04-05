# OpenAPI and API Governance

Tooling for documenting, linting, and protecting API contracts.

## OpenAPI Generation for SvelteKit

### Option A: sveltekit-valibot-openapi (Most Idiomatic)

Generates OpenAPI 3.1 from exported metadata in SvelteKit route files using Valibot schemas. No runtime hooks, pure documentation generation.

```typescript
// src/routes/api/v1/items/+server.ts
import * as v from 'valibot';

const CreateItemSchema = v.object({
  name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
  price: v.pipe(v.number(), v.minValue(0)),
});

const ItemResponse = v.object({
  id: v.string(),
  name: v.string(),
  price: v.number(),
  created_at: v.string(),
});

// Export OpenAPI metadata alongside handlers
export const _openapi = {
  POST: {
    summary: 'Create a new item',
    tags: ['Items'],
    requestBody: { schema: CreateItemSchema },
    responses: {
      201: { schema: ItemResponse, description: 'Created item' },
      422: { description: 'Validation failed' },
    },
  },
};
```

### Option B: openapi-fetch + openapi-typescript (Most Mature)

Write or generate an OpenAPI spec, then produce TypeScript types for consumption.

```bash
# Generate types from spec
bunx openapi-typescript ./openapi.yaml -o ./src/lib/api/types.d.ts
```

```typescript
// src/lib/api/client.ts
import createClient from 'openapi-fetch';
import type { paths } from './types';

const api = createClient<paths>({ baseUrl: '/api/v1' });

// Fully typed — path, method, params, response
const { data, error } = await api.GET('/items/{id}', {
  params: { path: { id: 'item_123' } },
});
```

### Option C: Manual OpenAPI Spec

For smaller APIs, a hand-maintained `openapi.yaml` is viable:

```yaml
openapi: '3.1.0'
info:
  title: Velociraptor API
  version: '1.0.0'
paths:
  /api/v1/items:
    get:
      summary: List items
      parameters:
        - name: cursor
          in: query
          schema: { type: string }
        - name: limit
          in: query
          schema: { type: integer, default: 20, maximum: 100 }
      responses:
        '200':
          description: Paginated list of items
```

## API Linting with Spectral

Spectral is the dominant OpenAPI linter. Supports custom rulesets.

### Setup

```bash
bun add -d @stoplight/spectral-cli
```

```yaml
# .spectral.yaml
extends:
  - spectral:oas        # Built-in OpenAPI rules
  - spectral:asyncapi   # If using WebSocket/SSE specs

rules:
  # Enforce consistent naming
  oas3-valid-schema-example: warn
  operation-operationId: error

  # Custom rules
  snake-case-properties:
    description: All response properties must be snake_case
    given: "$.paths..responses..properties.*~"
    then:
      function: pattern
      functionOptions:
        match: "^[a-z][a-z0-9]*(_[a-z0-9]+)*$"

  pagination-on-lists:
    description: List endpoints must include pagination parameters
    given: "$.paths[*].get"
    then:
      - field: parameters
        function: truthy
```

### OWASP Security Ruleset

```bash
bun add -d @stoplight/spectral-owasp-ruleset
```

```yaml
# .spectral.yaml
extends:
  - spectral:oas
  - "@stoplight/spectral-owasp-ruleset"
```

Covers OWASP API Security Top 10 (2023): broken auth, excessive data exposure, injection, rate limiting, etc.

### CI Integration

```yaml
# .github/workflows/api-lint.yml
- name: Lint OpenAPI spec
  run: bunx spectral lint openapi.yaml --fail-severity warn
```

## Breaking Change Detection with oasdiff

Compares two OpenAPI specs and flags breaking changes.

### Setup

```bash
# Install
go install github.com/tufin/oasdiff@latest

# Or use Docker
docker run --rm -v $(pwd):/specs tufin/oasdiff breaking /specs/openapi-old.yaml /specs/openapi-new.yaml
```

### GitHub Action

```yaml
# .github/workflows/api-breaking.yml
name: API Breaking Changes
on:
  pull_request:
    paths: ['openapi.yaml', 'src/routes/api/**']

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get base spec
        run: git show origin/main:openapi.yaml > openapi-base.yaml

      - name: Check for breaking changes
        uses: oasdiff/oasdiff-action/breaking@main
        with:
          base: openapi-base.yaml
          revision: openapi.yaml
```

### What oasdiff Catches

| Change | Severity |
|--------|----------|
| Removed endpoint | Breaking |
| Removed response field | Breaking |
| Changed field type | Breaking |
| New required request field | Breaking |
| Changed error code | Breaking |
| New optional field | Non-breaking |
| New endpoint | Non-breaking |
| Expanded enum values | Non-breaking |

## API Design Governance

### Pre-Merge Checklist (for PRs touching `/api/`)

1. **Spec updated** — If adding/changing endpoints, OpenAPI spec reflects changes
2. **Spectral passes** — No lint errors on the spec
3. **No breaking changes** — oasdiff confirms backward compatibility (or breaking change is intentional and documented)
4. **Endpoint review** — Checklist from `endpoint-review.md` completed
5. **Error codes registered** — Any new error codes added to the error code registry

### Naming Convention Enforcement

Use Spectral custom rules to enforce:
- snake_case for all JSON properties
- Plural nouns for collection paths
- Consistent ID format in path parameters
- Version prefix on all paths
