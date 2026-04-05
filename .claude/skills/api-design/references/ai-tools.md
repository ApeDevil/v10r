# AI Tool Contracts

Design patterns for Vercel AI SDK tool definitions. Tool schemas are API contracts consumed by LLMs, not humans — design them accordingly.

## Schema Design Principles

### 1. Describe Everything

The LLM reads JSON Schema, not your TypeScript source. `description` fields are the primary signal for parameter understanding.

```typescript
// WRONG — LLM guesses from property names
inputSchema: z.object({
  q: z.string(),
  n: z.number(),
  s: z.enum(['active', 'archived']),
})

// RIGHT — LLM has clear guidance
inputSchema: z.object({
  query: z.string().describe(
    'Search text. Natural language is fine. Example: "unpaid invoices from March"'
  ),
  limit: z.number().min(1).max(50).default(10).describe(
    'Maximum results to return. Default is 10.'
  ),
  status: z.enum(['active', 'archived']).nullable().describe(
    'Filter by item status. Set null to include all statuses.'
  ),
})
```

### 2. Prefer Nullable over Optional

`z.nullable()` forces the LLM to explicitly choose null or a value. `z.optional()` allows silent omission, which produces less reliable behavior.

```typescript
// Less reliable — LLM may silently omit
status: z.enum(['draft', 'published']).optional()

// More reliable — LLM must decide
status: z.enum(['draft', 'published']).nullable()
  .describe('Filter by status. Set null for all.')
```

### 3. Enums over Booleans

```typescript
// Ambiguous for LLM — what does true mean?
readOnly: z.boolean()

// Clear — explicit states
mode: z.enum(['read', 'write']).describe('Access mode for the operation')
```

### 4. Flat Parameter Objects

Deeply nested schemas increase LLM error rates. Flatten and use name prefixes:

```typescript
// Higher error rate — nested structure
inputSchema: z.object({
  filter: z.object({
    start_date: z.string(),
    end_date: z.string(),
    status: z.enum(['active', 'archived']),
  }),
})

// Lower error rate — flat with prefixes
inputSchema: z.object({
  filter_start_date: z.string().describe('ISO date string for range start'),
  filter_end_date: z.string().describe('ISO date string for range end'),
  filter_status: z.enum(['active', 'archived']).nullable()
    .describe('Filter by status. Null for all.'),
})
```

### 5. Domain-Specific Names

```typescript
// Confusing — name conflicts with tool name, generic params
tool({ name: 'search', inputSchema: z.object({
  data: z.string(),    // What data?
  input: z.string(),   // What input?
})})

// Clear — domain-specific
tool({ name: 'searchItems', inputSchema: z.object({
  search_query: z.string().describe('Text to search item names and descriptions'),
  item_type: z.enum(['product', 'service']).describe('Type of item to search'),
})})
```

### 6. Tool Description Matters

The tool's top-level `description` is what the LLM uses to decide **when** to call the tool. Include what it does, when to use it, and an example.

```typescript
const listNotifications = tool({
  description: `List the user's notifications with unread count. Use this when the user asks about notifications, alerts, or mentions. Returns paginated results sorted by newest first.`,
  inputSchema: z.object({ /* ... */ }),
  execute: async () => { /* ... */ },
});
```

## Result Format

### Structured Data, Not Prose

```typescript
// WRONG — pre-formatted prose, LLM double-formats
execute: async () => {
  return { message: 'You have 3 unread notifications: mention from Alice...' };
}

// RIGHT — structured data, LLM composes response
execute: async () => {
  return {
    notifications: [
      { id: 'n1', type: 'mention', title: 'Alice mentioned you', created_at: '...' },
    ],
    unread_count: 3,
    has_more: true,
  };
}
```

### Error Returns (Never Throw)

```typescript
execute: async ({ itemId }) => {
  try {
    const item = await getItem(itemId, userId);
    if (!item) return { error: 'Item not found.' };
    return { id: item.id, name: item.name, status: item.status };
  } catch {
    return { error: 'Failed to fetch item. Try again.' };
  }
},
```

**Why never throw:** Throwing from `execute()` crashes the AI turn entirely. Returning an error object lets the LLM read it and communicate it naturally to the user.

### Safe Content in Results

User-generated content in tool results flows back into LLM context — prompt injection risk.

```typescript
execute: async () => {
  const notifications = await getNotifications(userId);
  return {
    notifications: notifications.map(n => ({
      id: n.id,
      // Wrap user-controlled fields in delimiters
      title: `[NOTIFICATION_TITLE]${n.title}[/NOTIFICATION_TITLE]`,
      body: n.body ? `[NOTIFICATION_BODY]${n.body}[/NOTIFICATION_BODY]` : null,
    })),
  };
},
```

## Permission Scoping

### Three-Tier Tool Classification

```typescript
// Read — safe for all contexts
const readTools = (userId: string) => ({
  searchItems: tool({ /* ... */ }),
  getItem: tool({ /* ... */ }),
  listNotifications: tool({ /* ... */ }),
});

// Write — authenticated sessions with write scope
const writeTools = (userId: string) => ({
  createItem: tool({ /* ... */ }),
  updateItem: tool({ /* ... */ }),
  markNotificationRead: tool({ /* ... */ }),
});

// Destructive — NEVER in automated agents
// deleteAccount, exportUserData, bulkDelete
// These require human-in-the-loop confirmation
```

### Composition in Route Handler

```typescript
// src/routes/api/ai/chat/+server.ts
export function createTools(userId: string) {
  return {
    ...readTools(userId),
    ...writeTools(userId),
    // NEVER include destructive tools
  };
}
```

### Auth via Closure

Auth happens once at the endpoint. `userId` flows into the tool factory via closure. Tools never re-authenticate.

```typescript
export const POST: RequestHandler = async ({ request, locals }) => {
  const { user } = requireApiUser(locals); // Auth happens HERE, once

  const result = streamText({
    model: chatModel,
    messages,
    tools: createTools(user.id), // userId flows into closures
    maxSteps: 5,
  });
};
```

## Tool vs REST API

| Dimension | REST API | AI Tool |
|-----------|----------|---------|
| Contract enforcer | HTTP client + JSON parsing | LLM interpreting JSON Schema |
| Documentation consumer | Human developer | The LLM itself |
| Error mechanism | HTTP status codes | Return `{ error: "..." }` |
| Versioning | URL path (`/v1/`, `/v2/`) | Tool name (`searchItemsV2`) |
| Auth | Per-request header/cookie | Closure capture in factory |
| Idempotency | `Idempotency-Key` header | `execute` should be idempotent by design |
| Partial results | Cursor pagination | Return `{ items, has_more, next_cursor }` |

## Schema Evolution

### Safe Changes (Non-Breaking)

- Add optional parameter with default value
- Expand enum with new values
- Add new fields to result object
- Improve description text

### Breaking Changes

- Rename a parameter
- Remove a parameter
- Add a required parameter
- Change parameter type
- Remove result field

### Migration Strategy

No established versioning protocol exists for AI tool schemas. Practical approach:

```typescript
// Keep old tool during transition
const searchItemsV1 = tool({
  description: '[DEPRECATED: use searchItemsV2] Search items by name.',
  // ... old schema
});

// New tool with expanded schema
const searchItemsV2 = tool({
  description: 'Search items with advanced filters. Prefer this over searchItemsV1.',
  // ... new schema
});

// Include both — LLM will prefer V2 based on description
const tools = { searchItemsV1, searchItemsV2 };
```

Remove V1 after confirming no active conversations depend on it.

## Known SDK Issues

| Issue | Impact | Workaround |
|-------|--------|------------|
| Tool called N times = `maxSteps` (#5195) | Runaway tool loop | Keep `maxSteps` low, monitor |
| `maxSteps` default varies by version | Zero or unlimited tool calls | Always set explicitly |
| `outputSchema` not validated (#10222) | Type safety illusion | Validate results manually |
| `AI_NoOutputGeneratedError` (#13075) | ToolLoopAgent stop condition | Pin SDK version or use manual loop |

## maxSteps Configuration

```typescript
streamText({
  model: chatModel,
  messages,
  tools: createTools(user.id),
  maxSteps: 5, // ALWAYS set explicitly
  // Claude models tend to use more tool calls than GPT
  // Start at 5, increase if legitimate use cases need more
});
```

**Monitor tool call counts in production.** If a tool is consistently hitting `maxSteps`, either the tool description is too broad (LLM keeps calling it) or the task genuinely needs more steps.
