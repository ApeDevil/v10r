# Superforms

Form handling for SvelteKit. Server validation, progressive enhancement.

## Why Superforms

| Aspect | Superforms | Native SvelteKit |
|--------|------------|------------------|
| Validation | Schema-based | Manual |
| Error handling | Automatic | Manual |
| Progressive enhancement | Built-in | Manual |
| Nested data | Supported | Complex |
| Loading states | Built-in | Manual |

Superforms wins: schema validation, automatic error handling, progressive enhancement.

## Stack Integration

| Layer | Technology | Why |
|-------|------------|-----|
| Forms | **Superforms** | SvelteKit-native, Valibot integration |
| Validation | **Valibot** | Type-safe schemas |
| Components | **Bits UI** | Accessible form controls |

## Key Features

- **Server-first validation** (secure, works without JS)
- **Progressive enhancement** (enhances with JS)
- **Schema integration** (Valibot, Zod)
- **Nested data** (arrays, objects)
- **File uploads** (multipart handling)
- **Flash messages** (cross-request feedback)

## Pattern

```typescript
// +page.server.ts
import { superValidate } from 'sveltekit-superforms';
import { valibot } from 'sveltekit-superforms/adapters';

export const load = async () => {
  const form = await superValidate(valibot(schema));
  return { form };
};

export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(schema));
    if (!form.valid) return fail(400, { form });
    // Process valid data
    return { form };
  }
};
```

## Form States

| State | Purpose |
|-------|---------|
| `$form` | Current form data |
| `$errors` | Field-level errors |
| `$constraints` | HTML validation attributes |
| `$submitting` | Form is submitting |
| `$delayed` | Submission taking long |
| `$timeout` | Submission timed out |

## Related

- [valibot.md](./valibot.md) - Schema validation
- [../ui/bits-ui.md](../ui/bits-ui.md) - Form components
- [../../blueprint/forms/](../../blueprint/forms/) - Implementation details
