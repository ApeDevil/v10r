# TOON (Token-Oriented Object Notation)

Compact serialization format optimized for LLM input. Reduces tokens by 30-60% compared to JSON.

---

## Overview

TOON is a data format designed specifically for passing structured data to LLMs. It combines YAML-style indentation with CSV-like tabular layouts.

```
JSON (257 tokens):
{
  "users": [
    {"id": 1, "name": "Alice", "role": "admin"},
    {"id": 2, "name": "Bob", "role": "user"}
  ]
}

TOON (166 tokens):
users[2]{id,name,role}:
  1,Alice,admin
  2,Bob,user
```

| Metric | JSON | TOON | Improvement |
|--------|------|------|-------------|
| Tokens | 257 | 166 | **35% fewer** |
| LLM Accuracy | 70% | 74% | **+4%** |

---

## Why TOON?

| Benefit | Impact |
|---------|--------|
| **Token savings** | 30-60% fewer tokens = lower API costs |
| **Better accuracy** | Explicit structure helps LLMs parse data |
| **Context density** | More data fits in context window |
| **Streaming-friendly** | Line-oriented format, no closing braces |

---

## Dependencies

```json
"@toon-format/toon": "^0.x"
```

> See [development-environment.md](../development-environment.md) for installation workflow.

---

## Usage

### Encode (JSON → TOON)

```typescript
import { encode } from '@toon-format/toon';

const data = {
  documents: [
    { id: 1, title: 'Setup Guide', content: 'Install dependencies...' },
    { id: 2, title: 'API Reference', content: 'Available endpoints...' },
  ]
};

const toon = encode(data);
// documents[2]{id,title,content}:
//   1,Setup Guide,Install dependencies...
//   2,API Reference,Available endpoints...
```

### Decode (TOON → JSON)

```typescript
import { decode } from '@toon-format/toon';

const toonString = `users[2]{id,name}:
  1,Alice
  2,Bob`;

const data = decode(toonString);
// { users: [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }] }
```

### Streaming (Large Datasets)

```typescript
import { encodeLines, decodeFromLines } from '@toon-format/toon';

// Encode line-by-line
for (const line of encodeLines(largeData)) {
  process.stdout.write(`${line}\n`);
}

// Decode line-by-line
for (const object of decodeFromLines(lines)) {
  // process each object
}
```

### Redact Sensitive Data

```typescript
import { encode } from '@toon-format/toon';

const user = { name: 'Alice', password: 'secret', email: 'alice@example.com' };

const safe = encode(user, {
  replacer: (key, value) => key === 'password' ? undefined : value
});
// name: Alice
// email: alice@example.com
```

---

## RAG Integration

TOON is ideal for formatting retrieved documents before sending to the LLM.

```typescript
// src/routes/api/ai/chat/+server.ts
import { encode } from '@toon-format/toon';
import { streamText } from 'ai';
import { providers } from '$lib/server/ai/providers';

export const POST: RequestHandler = async ({ request, locals }) => {
  const { question } = await request.json();

  // 1. Embed question with Mistral
  const { embedding } = await embed({
    model: providers.embeddings.embedding('mistral-embed'),
    value: question,
  });

  // 2. Search vector DB
  const results = await db.execute(sql`
    SELECT id, title, content, 1 - (embedding <=> ${embedding}::vector) as score
    FROM documents
    ORDER BY embedding <=> ${embedding}::vector
    LIMIT 5
  `);

  // 3. Format as TOON (saves 30-60% tokens!)
  const context = encode({
    documents: results.rows.map(r => ({
      id: r.id,
      title: r.title,
      content: r.content,
      relevance: r.score.toFixed(2),
    }))
  });

  // 4. Pass TOON context to Groq
  const result = streamText({
    model: providers.chat('llama-3.3-70b-versatile'),
    messages: [
      {
        role: 'system',
        content: `Answer based on these documents:\n\n${context}`
      },
      { role: 'user', content: question }
    ],
  });

  return result.toUIMessageStreamResponse();
};
```

---

## Tool Calling

Format tool response data as TOON:

```typescript
// src/lib/server/ai/tools.ts
import { encode } from '@toon-format/toon';
import { tool } from 'ai';
import * as v from 'valibot';

export const searchProducts = tool({
  description: 'Search for products in the catalog',
  parameters: v.object({
    query: v.string(),
    limit: v.optional(v.number(), 10),
  }),
  execute: async ({ query, limit }) => {
    const products = await db.query.products.findMany({
      where: ilike(products.name, `%${query}%`),
      limit,
    });

    // Return as TOON for token efficiency
    return encode({ products });
  },
});
```

---

## Benchmarks

Real-world token savings:

| Dataset | JSON Tokens | TOON Tokens | Savings |
|---------|-------------|-------------|---------|
| 3 employee records | 257 | 166 | **35%** |
| 100 GitHub repos | 15,145 | 8,745 | **42%** |
| 180 days analytics | 10,977 | 4,507 | **59%** |
| E-commerce orders | 992 | 846 | **15%** |

**Rule of thumb:** More repetitive keys = more savings.

---

## When to Use

### Use TOON

| Use Case | Why |
|----------|-----|
| RAG context | Large document sets, uniform structure |
| Tool responses | Structured data, tabular results |
| Analytics data | Time-series, repeated schema |
| Batch records | User lists, order history |

### Use JSON Instead

| Use Case | Why |
|----------|-----|
| LLM output parsing | Better tool support |
| Tool schemas | OpenAPI spec requires JSON |
| Deeply nested data | TOON less efficient |
| REST APIs | Standard interchange format |
| Irregular structures | Varying fields per record |

---

## Format Syntax

### Nested Objects (YAML-style)

```
context:
  task: Generate report
  format: markdown
  maxLength: 1000
```

### Simple Arrays

```
tags[3]: typescript,svelte,ai
```

### Uniform Object Arrays (Tabular)

```
users[3]{id,name,role,active}:
  1,Alice,admin,true
  2,Bob,user,true
  3,Charlie,user,false
```

### Mixed Structures

```
config:
  version: 2
  features[2]: auth,analytics
users[2]{id,name}:
  1,Alice
  2,Bob
```

---

## CLI

```bash
# Convert JSON to TOON
npx @toon-format/cli data.json -o data.toon

# Convert TOON to JSON
npx @toon-format/cli data.toon -o data.json

# Pipe from stdin
cat data.json | npx @toon-format/cli

# Show token statistics
npx @toon-format/cli data.json --stats
```

---

## Configuration Options

```typescript
import { encode } from '@toon-format/toon';

encode(data, {
  // Custom delimiter (default: comma)
  delimiter: '\t',  // Tab-separated
  delimiter: '|',   // Pipe-separated

  // Transform values during encoding
  replacer: (key, value) => {
    if (key === 'password') return undefined;  // Omit
    if (key === 'email') return '[REDACTED]';  // Mask
    return value;
  },
});
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RAG Pipeline                              │
├─────────────────────────────────────────────────────────────────┤
│  User Question                                                   │
│       ↓                                                          │
│  Embed (Mistral) → Vector                                        │
│       ↓                                                          │
│  Vector Search → Retrieved Documents (JSON)                      │
│       ↓                                                          │
│  ★ encode(documents) → TOON ★  ←── 30-60% token savings         │
│       ↓                                                          │
│  LLM Prompt (Groq) → Response                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Limitations

| Limitation | Mitigation |
|------------|------------|
| New format (Nov 2025) | Mature TypeScript SDK, active development |
| Not for outputs | Use JSON for LLM structured output |
| Encoding overhead | Negligible vs. LLM inference time |
| Deep nesting | Falls back to JSON-like syntax |

---

## Related

- [README.md](./README.md) - AI architecture overview
- [../../stack/vendors.md](../../stack/vendors.md) - Provider details

---

## Sources

- [GitHub - toon-format/toon](https://github.com/toon-format/toon)
- [TOON vs JSON: The New Format Designed for AI](https://dev.to/akki907/toon-vs-json-the-new-format-designed-for-ai-nk5)
- [TOON: Save 60% on Tokens](https://www.analyticsvidhya.com/blog/2025/11/toon-token-oriented-object-notation/)
- [Spring AI Tool Response Formats](https://spring.io/blog/2025/11/25/spring-ai-tool-response-formats/)
