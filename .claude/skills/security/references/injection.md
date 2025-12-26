# Injection Prevention

## SQL Injection (Drizzle ORM)

### How Drizzle Protects You

Drizzle uses parameterized queries by default. The `sql` template literal automatically separates user input from SQL structure.

### Safe Patterns

**Query Builder (Always Safe):**
```typescript
import { eq, and, like } from 'drizzle-orm';

// All values automatically parameterized
await db.select()
  .from(users)
  .where(
    and(
      eq(users.id, userId),        // Parameterized
      like(users.name, `%${name}%`) // Parameterized
    )
  );
```

**SQL Template Literal (Safe):**
```typescript
import { sql } from 'drizzle-orm';

const userId = req.params.id;

// Template interpolation creates parameters
await db.execute(
  sql`SELECT * FROM ${users} WHERE ${users.id} = ${userId}`
);
// Generated: SELECT * FROM "users" WHERE "users"."id" = $1
// Parameters: [userId]
```

**Dynamic Column Selection (Safe):**
```typescript
const columns = { id: users.id, name: users.name };
await db.select(columns).from(users);
```

### DANGEROUS: sql.raw()

**Never use with user input:**
```typescript
// VULNERABLE TO SQL INJECTION
const sortColumn = req.query.sort;
await db.execute(
  sql.raw(`SELECT * FROM users ORDER BY ${sortColumn}`)
);
// Attacker: sort=id; DROP TABLE users; --
```

**Only safe uses for sql.raw():**
```typescript
// Pre-defined, trusted SQL fragments
const ORDER_CLAUSES = {
  newest: sql.raw('ORDER BY created_at DESC'),
  oldest: sql.raw('ORDER BY created_at ASC'),
};

const orderBy = ORDER_CLAUSES[validatedInput] || ORDER_CLAUSES.newest;
await db.execute(sql`SELECT * FROM users ${orderBy}`);
```

### Dynamic Table/Column Names

**Problem:** Table and column names cannot be parameterized.

**Safe Pattern:**
```typescript
// Whitelist approach
const ALLOWED_TABLES = ['users', 'posts', 'comments'] as const;
type AllowedTable = typeof ALLOWED_TABLES[number];

function isAllowedTable(name: string): name is AllowedTable {
  return ALLOWED_TABLES.includes(name as AllowedTable);
}

const tableName = req.params.table;
if (!isAllowedTable(tableName)) {
  throw new Error('Invalid table');
}

// Now safe to use
const table = { users, posts, comments }[tableName];
await db.select().from(table);
```

## Cypher Injection (Neo4j)

### Parameterization Limits

| Element | Parameterizable | Workaround |
|---------|-----------------|------------|
| Property values | Yes | Use `$param` |
| Node labels | **No** | Whitelist + sanitize |
| Relationship types | **No** | Whitelist + sanitize |
| Property keys | **No** | Whitelist |

### Safe Patterns

**Parameterized Values:**
```typescript
const session = driver.session();

// Property values are safe
await session.run(
  `
  MATCH (u:User {email: $email})
  SET u.lastLogin = $now
  RETURN u
  `,
  { email: userInput, now: new Date().toISOString() }
);
```

**Multiple Parameters:**
```typescript
await session.run(
  `
  CREATE (p:Post {
    title: $title,
    content: $content,
    authorId: $authorId
  })
  `,
  {
    title: input.title,
    content: input.content,
    authorId: userId,
  }
);
```

### Dangerous: Dynamic Labels

```typescript
// VULNERABLE
const nodeType = req.params.type;
await session.run(`MATCH (n:${nodeType}) RETURN n`);
// Attacker: type=User) DETACH DELETE n //
```

**Safe Pattern - Whitelist:**
```typescript
const ALLOWED_LABELS = ['User', 'Post', 'Comment'] as const;

const label = req.params.type;
if (!ALLOWED_LABELS.includes(label as any)) {
  throw new Error('Invalid node type');
}

await session.run(`MATCH (n:${label}) RETURN n`);
```

**Safe Pattern - Restructure:**
```typescript
// Use property instead of label
await session.run(
  `MATCH (n {type: $type}) RETURN n`,
  { type: userInput }
);
```

### If Dynamic Labels Unavoidable

```typescript
// Strict sanitization - alphanumeric + underscore only
function sanitizeCypherIdentifier(input: string): string {
  const sanitized = input.replace(/[^a-zA-Z0-9_]/g, '');
  if (sanitized.length === 0) {
    throw new Error('Invalid identifier');
  }
  return sanitized;
}

// Escape with backticks
const label = sanitizeCypherIdentifier(userInput);
await session.run(`MATCH (n:\`${label}\`) RETURN n`);
```

### APOC Procedure Dangers

```typescript
// VULNERABLE - string concatenation in APOC
await session.run(
  `CALL apoc.cypher.doIt(
    "CREATE (s:Student) SET s.name = '" + $name + "'",
    {}
  )`
);

// SAFE - pass parameters through
await session.run(
  `CALL apoc.cypher.doIt(
    "CREATE (s:Student) SET s.name = $name",
    {name: $studentName}
  )`,
  { studentName: userInput }
);
```

## Command Injection (Bun Shell)

### How Bun Protects You

Bun's `$` template does NOT invoke `/bin/sh`. Each interpolation is a single argument.

```typescript
import { $ } from 'bun';

const userInput = 'file.txt; rm -rf /';

// SAFE - "file.txt; rm -rf /" is ONE argument
await $`cat ${userInput}`;
// Equivalent to: cat "file.txt; rm -rf /"
// rm is NOT executed
```

### Still Dangerous: Argument Injection

```typescript
// VULNERABLE - path traversal
const filename = '../../../etc/passwd';
await $`cat ${filename}`; // Reads /etc/passwd

// SAFE - validate/sanitize input
function sanitizeFilename(name: string): string {
  // Remove path traversal
  return name.replace(/\.\./g, '').replace(/\//g, '');
}
```

### Vulnerable: Child Process spawn()

```typescript
import { spawn } from 'child_process';

// VULNERABLE if userInput contains shell metacharacters
spawn('sh', ['-c', `echo ${userInput}`]);

// SAFE - use array form without shell
spawn('echo', [userInput]);
```
