# Valibot

Schema validation. Type-safe, tiny bundle, edge-friendly.

## Why Valibot

| Aspect | Valibot | Zod |
|--------|---------|-----|
| Bundle Size | **~1 KB** | ~12 KB |
| TypeScript | Full | Full |
| Tree-shaking | Modular (only imports) | Monolithic |
| Edge/Serverless | Perfect | Heavier |

Valibot wins: 10x smaller, modular imports, edge-friendly.

## Stack Integration

| Layer | Technology | Why |
|-------|------------|-----|
| Validation | **Valibot** | Type-safe, ~1 KB |
| Forms | **Superforms** | Native Valibot integration |
| Runtime | **Bun** | Fast validation |

## Key Features

- **Modular imports** (only import what you use)
- **Full TypeScript inference** (no codegen)
- **Composable schemas** (build complex from simple)
- **Custom error messages** (i18n-friendly)
- **Transforms** (coerce and transform values)

## Schema Pattern

```typescript
import * as v from 'valibot';

const UserSchema = v.object({
  email: v.pipe(v.string(), v.email()),
  name: v.pipe(v.string(), v.minLength(2)),
  age: v.optional(v.pipe(v.number(), v.minValue(0))),
});

type User = v.InferOutput<typeof UserSchema>;
```

## Common Validators

| Validator | Purpose |
|-----------|---------|
| `v.string()` | String type |
| `v.email()` | Email format |
| `v.minLength(n)` | Minimum length |
| `v.maxLength(n)` | Maximum length |
| `v.regex(pattern)` | Pattern match |
| `v.optional()` | Optional field |
| `v.nullable()` | Nullable field |

## Related

- [superforms.md](./superforms.md) - Form handling
- [../core/sveltekit.md](../core/sveltekit.md) - Server validation
- [../../blueprint/forms/](../../blueprint/forms/) - Implementation details
