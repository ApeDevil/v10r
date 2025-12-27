# Superforms

## What is it?

SvelteKit form library providing server and client-side validation with a minimal API. Uses a single method on server and client while offering extensive configuration options.

## What is it for?

- Full-stack form validation (same schema on server and client)
- Progressive enhancement (works without JavaScript)
- Nested data structures beyond FormData limitations
- Type-safe form handling with TypeScript
- Multiple forms per page

## Why was it chosen?

| Aspect | Superforms | Native SvelteKit |
|--------|------------|------------------|
| Validation | Schema-based | Manual |
| Error handling | Automatic | Manual |
| Progressive enhancement | Built-in | Manual |
| Nested data | Supported | Complex |
| Loading states | Built-in | Manual |

**Key advantages:**
- Progressive enhancement by default (forms work without JS)
- Single source of truth (one schema for server + client)
- Type safety across PageData, ActionData, form state
- Minimal API with extensive functionality
- Validation library agnostic (Valibot, Zod, Yup, etc.)
- SuperDebug component for development

**Form states available:**
| State | Purpose |
|-------|---------|
| `$form` | Current form data |
| `$errors` | Field-level errors |
| `$constraints` | HTML validation attributes |
| `$submitting` | Form is submitting |
| `$delayed` | Submission taking long |
| `$timeout` | Submission timed out |

## Known limitations

**Svelte 5 compatibility:**
- v2.x works with Svelte 5 but uses Svelte stores (not runes)
- Must mix store syntax (`$formData`) with runes syntax (`$props()`)
- Native runes support planned for **v3** (no release date)
- Multi-form pages require extracting stores separately

**Complexity considerations:**
- Core API is minimal and straightforward
- Component-based forms become complex
- Formsnap wrapper library exists for simplification

**Technical requirements:**
- Valibot peer dependency: 1.0.0+ required
- Schema must be defined at module top-level (not inside load functions)

## Related

- [valibot.md](./valibot.md) - Schema validation
- [../ui/bits-ui.md](../ui/bits-ui.md) - Form components
