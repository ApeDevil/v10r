# Valibot v1 API Reference

Tree-shakeable schema validation library. ~1kB bundle size.

## Contents

- [Import](#import)
- [Schemas](#schemas) - Primitives, Literals, Objects, Arrays, Records, Union, Special
- [The pipe() Function](#the-pipe-function) - Chaining validations and transformations
- [Validation Actions](#validation-actions) - String, Number, Array, Object, Custom validators
- [Transformation Actions](#transformation-actions) - Type conversions, String/Value/Array transforms
- [Optional and Default Values](#optional-and-default-values) - optional, nullable, nullish, exactOptional
- [Type Inference](#type-inference) - InferOutput, InferInput
- [Error Messages](#error-messages) - Per-action, schema-level, i18n
- [Parsing](#parsing) - safeParse, parse, async
- [Common Patterns](#common-patterns) - Email, Password, URL, Phone, Price fields

## Import

```typescript
import * as v from 'valibot';
```

## Schemas

### Primitives

```typescript
v.string()      // string
v.number()      // number (includes NaN, Infinity)
v.boolean()     // boolean
v.bigint()      // bigint
v.date()        // Date
v.symbol()      // symbol
v.undefined()   // undefined
v.null()        // null
v.void()        // void (undefined)
v.never()       // never
v.any()         // any
v.unknown()     // unknown
```

### Literals and Enums

```typescript
// Literal value
v.literal('active')           // 'active'
v.literal(42)                 // 42
v.literal(true)               // true

// Enum (multiple literals)
v.enum(['draft', 'published', 'archived'])
// 'draft' | 'published' | 'archived'

// Picklist (alias for enum)
v.picklist(['a', 'b', 'c'])
```

### Objects

```typescript
// Basic object
v.object({
  name: v.string(),
  age: v.number()
})

// With optional fields
v.object({
  name: v.string(),
  bio: v.optional(v.string())
})

// Strict (no extra keys)
v.strictObject({
  name: v.string()
})

// Loose (extra keys allowed, typed as unknown)
v.looseObject({
  name: v.string()
})

// Object with rest (extra keys typed)
v.objectWithRest({
  name: v.string()
}, v.number())  // extra keys must be numbers
```

### Arrays and Tuples

```typescript
// Array of type
v.array(v.string())          // string[]
v.array(v.number())          // number[]

// Tuple (fixed length, mixed types)
v.tuple([v.string(), v.number(), v.boolean()])
// [string, number, boolean]

// Tuple with rest
v.tupleWithRest([v.string()], v.number())
// [string, ...number[]]
```

### Records and Maps

```typescript
// Record (object with dynamic keys)
v.record(v.string(), v.number())
// Record<string, number>

// Map
v.map(v.string(), v.number())
// Map<string, number>

// Set
v.set(v.string())
// Set<string>
```

### Union and Intersection

```typescript
// Union (OR)
v.union([v.string(), v.number()])
// string | number

// Intersection (AND)
v.intersect([
  v.object({ a: v.string() }),
  v.object({ b: v.number() })
])
// { a: string } & { b: number }

// Variant (discriminated union)
v.variant('type', [
  v.object({ type: v.literal('text'), content: v.string() }),
  v.object({ type: v.literal('image'), url: v.string() })
])
```

### Special

```typescript
// Instance of class
v.instance(Date)
v.instance(Error)

// Lazy (recursive schemas)
type Node = { value: string; children: Node[] };
const nodeSchema: v.GenericSchema<Node> = v.object({
  value: v.string(),
  children: v.lazy(() => v.array(nodeSchema))
});

// Custom schema
v.custom<MyType>((input) => isMyType(input))
```

## The pipe() Function

Chain validations and transformations:

```typescript
v.pipe(
  schema,     // Base schema
  action1,    // First action
  action2,    // Second action
  ...         // Up to 19 actions
)
```

### Execution Order

```typescript
const schema = v.pipe(
  v.string(),           // 1. Type check
  v.trim(),             // 2. Transform: trim whitespace
  v.minLength(1),       // 3. Validate: not empty
  v.email(),            // 4. Validate: email format
  v.toLowerCase()       // 5. Transform: lowercase
);

// Input: "  HELLO@WORLD.COM  "
// Output: "hello@world.com"
```

### Async Pipelines

```typescript
v.pipeAsync(
  v.string(),
  v.email(),
  v.checkAsync(async (email) => {
    return !(await emailExists(email));
  }, 'Email taken')
)
```

## Validation Actions

### String Validators

```typescript
// Format
v.email()              // Email format
v.url()                // URL format
v.uuid()               // UUID format
v.cuid2()              // CUID2 format
v.ulid()               // ULID format
v.base64()             // Base64 encoded
v.hexColor()           // Hex color (#fff, #ffffff)
v.ip()                 // IP address (v4 or v6)
v.ipv4()               // IPv4 address
v.ipv6()               // IPv6 address
v.mac()                // MAC address
v.creditCard()         // Credit card number
v.isbn()               // ISBN number

// Date/Time
v.isoDate()            // YYYY-MM-DD
v.isoDateTime()        // YYYY-MM-DDTHH:mm:ss
v.isoTime()            // HH:mm:ss
v.isoTimestamp()       // ISO 8601 timestamp
v.isoWeek()            // YYYY-Www

// Length
v.minLength(n)         // Min length
v.maxLength(n)         // Max length
v.length(n)            // Exact length

// Content
v.startsWith(str)      // Starts with string
v.endsWith(str)        // Ends with string
v.includes(str)        // Contains string
v.excludes(str)        // Does not contain
v.regex(pattern)       // Matches regex
v.slug()               // URL slug (a-z, 0-9, -)
v.digits()             // Only digits
v.nonEmpty()           // Not empty string
v.empty()              // Empty string
```

### Number Validators

```typescript
v.minValue(n)          // >= n
v.maxValue(n)          // <= n
v.value(n)             // === n

v.integer()            // Integer only
v.finite()             // Not Infinity/NaN
v.safeInteger()        // Safe integer range
v.multipleOf(n)        // Multiple of n

v.notValue(n)          // !== n
```

### Array Validators

```typescript
v.minLength(n)         // Min items
v.maxLength(n)         // Max items
v.length(n)            // Exact items
v.nonEmpty()           // At least 1 item
v.empty()              // Empty array
v.includes(item)       // Contains item
v.excludes(item)       // Doesn't contain
```

### Object Validators

```typescript
v.minEntries(n)        // Min properties
v.maxEntries(n)        // Max properties
```

### Custom Validation

```typescript
// Synchronous check
v.check(
  (value) => value > 0,
  'Must be positive'
)

// Async check
v.checkAsync(
  async (value) => await isUnique(value),
  'Must be unique'
)

// With context access
v.rawCheck(({ dataset, addIssue }) => {
  if (dataset.value < 0) {
    addIssue({ message: 'Must be positive' });
  }
})
```

## Transformation Actions

### Type Conversions

```typescript
v.toString()           // Convert to string
v.toNumber()           // Convert to number (via Number())
v.toBoolean()          // Convert to boolean
v.toDate()             // Convert to Date
v.toBigint()           // Convert to bigint
```

### String Transformations

```typescript
v.trim()               // Trim whitespace
v.trimStart()          // Trim start
v.trimEnd()            // Trim end
v.toLowerCase()        // To lowercase
v.toUpperCase()        // To uppercase
v.normalize()          // Unicode normalize
```

### Value Transformations

```typescript
v.toMinValue(n)        // Clamp to min
v.toMaxValue(n)        // Clamp to max
```

### Array Transformations

```typescript
v.filterItems(fn)      // Filter array
v.mapItems(fn)         // Map array
v.sortItems(fn?)       // Sort array
v.reduceItems(fn, init) // Reduce array
v.findItem(fn)         // Find first match
```

### Custom Transformation

```typescript
v.transform((value) => {
  // Return transformed value
  return value.split(',').map(s => s.trim());
})

// With type change
v.transform((str): number => parseInt(str))
```

## Optional and Default Values

### Optional

```typescript
// Allows undefined
v.optional(v.string())              // string | undefined

// With default (changes output type)
v.optional(v.string(), 'default')   // string (not undefined)

// Dynamic default
v.optional(v.date(), () => new Date())
```

### Nullable

```typescript
// Allows null
v.nullable(v.string())              // string | null

// With default
v.nullable(v.string(), '')          // string (not null)
```

### Nullish

```typescript
// Allows null or undefined
v.nullish(v.string())               // string | null | undefined

// With default
v.nullish(v.string(), 'N/A')        // string
```

### Exact Optional

```typescript
// Allows missing key, but not explicit undefined
v.exactOptional(v.string())

// Object example
v.object({
  name: v.string(),
  bio: v.exactOptional(v.string())  // Can omit, can't be undefined
})

// Valid: { name: 'Ada' }
// Valid: { name: 'Ada', bio: 'Engineer' }
// Invalid: { name: 'Ada', bio: undefined }
```

## Type Inference

```typescript
// Output type (most common)
type User = v.InferOutput<typeof UserSchema>;

// Input type (before transformation)
type UserInput = v.InferInput<typeof UserSchema>;
```

### When Types Differ

```typescript
const schema = v.object({
  // Transformation: string → number
  age: v.pipe(v.string(), v.transform(Number)),
  // Default: string | undefined → string
  role: v.optional(v.string(), 'user')
});

type Input = v.InferInput<typeof schema>;
// { age: string; role?: string | undefined }

type Output = v.InferOutput<typeof schema>;
// { age: number; role: string }
```

## Error Messages

### Per-Action Messages

```typescript
v.pipe(
  v.string('Email is required'),
  v.email('Invalid email format'),
  v.maxLength(100, 'Email too long')
)
```

### Schema-Level Message

```typescript
v.message(
  v.pipe(v.string(), v.email(), v.maxLength(100)),
  'Please enter a valid email address'
)
```

### Internationalization

```typescript
import { setGlobalConfig } from 'valibot';

// Set global language
setGlobalConfig({ lang: 'de' });

// Per-parse language
v.parse(schema, data, { lang: 'de' });
```

## Parsing

### Safe Parse (Recommended)

```typescript
const result = v.safeParse(schema, data);

if (result.success) {
  console.log(result.output);  // Typed output
} else {
  console.log(result.issues);  // Validation errors
}
```

### Parse (Throws)

```typescript
try {
  const output = v.parse(schema, data);
} catch (error) {
  if (v.isValiError(error)) {
    console.log(error.issues);
  }
}
```

### Async Parsing

```typescript
const result = await v.safeParseAsync(asyncSchema, data);
const output = await v.parseAsync(asyncSchema, data);
```

## Common Patterns

### Email Field

```typescript
const email = v.pipe(
  v.string('Email required'),
  v.trim(),
  v.toLowerCase(),
  v.email('Invalid email'),
  v.maxLength(255, 'Too long')
);
```

### Password Field

```typescript
const password = v.pipe(
  v.string('Password required'),
  v.minLength(8, 'Min 8 characters'),
  v.regex(/[A-Z]/, 'Need uppercase letter'),
  v.regex(/[a-z]/, 'Need lowercase letter'),
  v.regex(/[0-9]/, 'Need number'),
  v.regex(/[^A-Za-z0-9]/, 'Need special character')
);
```

### URL Field

```typescript
const website = v.pipe(
  v.string(),
  v.trim(),
  v.url('Invalid URL'),
  v.startsWith('https://', 'Must be HTTPS')
);
```

### Phone Field

```typescript
const phone = v.pipe(
  v.string(),
  v.trim(),
  v.regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number')
);
```

### Price Field

```typescript
const price = v.pipe(
  v.number('Price required'),
  v.minValue(0, 'Cannot be negative'),
  v.maxValue(1000000, 'Too high'),
  v.transform((n) => Math.round(n * 100) / 100)  // 2 decimals
);
```
